using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Identity.DTOs;
using TravelCrm.Api.Features.Identity.Events;
using TravelCrm.Api.Features.Identity.Queries;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Identity.Commands;

/// <summary>
/// Creates a new user within the current tenant. Two modes:
/// <list type="bullet">
///   <item><description><c>SendInvite = true</c> → user's password is a throwaway; an invite
///     link (7-day TTL) is emailed so they can set their own password.</description></item>
///   <item><description><c>SendInvite = false</c> → admin supplies <c>Password</c> directly;
///     account is <c>Active</c> immediately.</description></item>
/// </list>
/// </summary>
public sealed record CreateUserCommand(
    string  Email,
    string  FirstName,
    string  LastName,
    string? Phone,
    string? JobTitle,
    Guid?   DepartmentId,
    Guid    RoleId,
    Guid?   TeamLeaderId,
    string? Password,
    bool    SendInvite
) : IRequest<Result<UserDto>>;

public sealed class CreateUserCommandValidator : AbstractValidator<CreateUserCommand>
{
    public CreateUserCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Phone).MaximumLength(50);
        RuleFor(x => x.JobTitle).MaximumLength(100);
        RuleFor(x => x.RoleId).NotEmpty();

        When(x => !x.SendInvite, () =>
        {
            RuleFor(x => x.Password)
                .NotEmpty().WithMessage("Password is required when not sending an invite.")
                .MinimumLength(8)
                .Matches("[A-Z]").WithMessage("Password must contain an uppercase letter.")
                .Matches("[a-z]").WithMessage("Password must contain a lowercase letter.")
                .Matches(@"\d").WithMessage("Password must contain a digit.");
        });
    }
}

public sealed class CreateUserCommandHandler(
    ApplicationDbContext db,
    UserManager<ApplicationUser> userManager,
    ITenantContext tenantContext,
    ICurrentUser currentUser,
    EmployeeIdGenerator empIds,
    PasswordResetTokenService tokens,
    IAppUrlProvider urls,
    IIdentityActivityWriter activity,
    IMediator mediator,
    ILogger<CreateUserCommandHandler> logger)
    : IRequestHandler<CreateUserCommand, Result<UserDto>>
{
    public async Task<Result<UserDto>> Handle(CreateUserCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null)
            return Result.Failure<UserDto>("Tenant context not resolved.");

        // Permission gate (defence-in-depth beyond controller policy)
        if (!currentUser.HasPermission("admin.users.create"))
            return Result.Failure<UserDto>("You don't have permission to create users.");

        var normalizedEmail = cmd.Email.ToUpperInvariant();

        // Email uniqueness within tenant
        if (await userManager.Users.AnyAsync(u =>
            u.TenantId == tenantId && u.NormalizedEmail == normalizedEmail && !u.IsDeleted, ct))
            return Result.Failure<UserDto>("A user with this email already exists in this tenant.");

        // Role must belong to this tenant (or be a shared system role)
        var role = await db.Roles.FindAsync([cmd.RoleId], ct);
        if (role is null || (role.TenantId != null && role.TenantId != tenantId))
            return Result.Failure<UserDto>("Role not found for this tenant.");

        // Team leader must be in same tenant with a 'team_leader' role slug
        if (cmd.TeamLeaderId is Guid tlId)
        {
            var tlExists = await db.Users.AnyAsync(u =>
                u.Id == tlId && u.TenantId == tenantId && !u.IsDeleted, ct);
            if (!tlExists)
                return Result.Failure<UserDto>("Team leader not found in this tenant.");

            var tlIsLeader = await db.UserRoles
                .Where(ur => ur.UserId == tlId)
                .Join(db.Roles, ur => ur.RoleId, r => r.Id, (_, r) => r.Slug)
                .AnyAsync(slug => slug == "team_leader", ct);
            if (!tlIsLeader)
                return Result.Failure<UserDto>("Team leader must hold a role with slug 'team_leader'.");
        }

        // Department must belong to this tenant
        if (cmd.DepartmentId is Guid dId &&
            !await db.Departments.AnyAsync(d => d.Id == dId && d.TenantId == tenantId, ct))
            return Result.Failure<UserDto>("Department not found in this tenant.");

        // Allocate an employee ID
        var employeeId = await empIds.NextAsync(tenantId.Value, ct);

        var actorId = currentUser.UserId == Guid.Empty ? (Guid?)null : currentUser.UserId;

        var user = new ApplicationUser
        {
            Id              = Guid.NewGuid(),
            TenantId        = tenantId,
            IsPlatformAdmin = false,
            UserName        = cmd.Email,
            Email           = cmd.Email,
            EmailConfirmed  = !cmd.SendInvite,
            FirstName       = cmd.FirstName,
            LastName        = cmd.LastName,
            PhoneNumber     = cmd.Phone,
            JobTitle        = cmd.JobTitle,
            DepartmentId    = cmd.DepartmentId,
            TeamLeaderId    = cmd.TeamLeaderId,
            EmployeeId      = employeeId,
            Status          = cmd.SendInvite ? UserStatus.PendingInvitation : UserStatus.Active,
            CreatedAt       = DateTime.UtcNow,
            CreatedBy       = actorId
        };

        // Invite flow uses a throwaway password — the real entry is the reset link
        var password = cmd.SendInvite
            ? Guid.NewGuid().ToString("N") + "Aa1!"
            : cmd.Password!;

        var result = await userManager.CreateAsync(user, password);
        if (!result.Succeeded)
            return Result.Failure<UserDto>(
                string.Join("; ", result.Errors.Select(e => e.Description)));

        await userManager.AddToRoleAsync(user, role.Name!);

        // Activity feed: record the creation (saved alongside AuditLog in next SaveChanges)
        activity.Record(
            subjectUserId: user.Id,
            activityType:  cmd.SendInvite ? "user.invited" : "user.created",
            description:   cmd.SendInvite
                ? $"{user.FullName} was invited to the tenant"
                : $"{user.FullName} was created",
            metadata: new { role = role.Name, employeeId = user.EmployeeId });
        await db.SaveChangesAsync(ct);

        // Mint invite token (if applicable) so the email handler has a URL
        string? inviteToken = null;
        string? inviteUrl   = null;
        if (cmd.SendInvite)
        {
            var (raw, url) = await tokens.CreateAsync(
                user.Id, tenantId, TimeSpan.FromDays(7), urls.PublicUrl, ipAddress: null, ct);
            inviteToken = raw;
            inviteUrl   = url;
        }

        // Fire-and-forget event for email / WhatsApp etc. (handlers are best-effort)
        await mediator.Publish(
            new UserCreatedEvent(user.Id, tenantId.Value, cmd.SendInvite, inviteToken, inviteUrl), ct);

        logger.LogInformation(
            "User {UserId} ({EmployeeId}) created in tenant {TenantId} by {ActorId}; invite={Invite}",
            user.Id, employeeId, tenantId, actorId, cmd.SendInvite);

        // Project to DTO
        var roleRef = new UserRoleRef(role.Id, role.Name!, role.Slug);
        var deptName = cmd.DepartmentId is Guid dd
            ? await db.Departments.Where(x => x.Id == dd).Select(x => x.Name).FirstOrDefaultAsync(ct)
            : null;
        var tlName = cmd.TeamLeaderId is Guid tt
            ? await db.Users.Where(x => x.Id == tt).Select(x => x.FirstName + " " + x.LastName).FirstOrDefaultAsync(ct)
            : null;

        return Result.Success(new UserDto(
            user.Id, user.TenantId, user.EmployeeId,
            user.Email!, user.FirstName, user.LastName, user.FullName,
            user.PhoneNumber, user.AvatarUrl, user.JobTitle,
            user.DepartmentId, deptName,
            user.TeamLeaderId, tlName,
            user.Status.ToString(),
            user.IsPlatformAdmin,
            new[] { roleRef },
            user.PreferredLanguage, user.TimeZone, user.CurrencyCode,
            user.CreatedAt, user.UpdatedAt, user.LastLoginAt));
    }
}
