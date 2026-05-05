using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Identity.DTOs;
using TravelCrm.Api.Features.Identity.Queries;
using TravelCrm.Api.Infrastructure.Authorization;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Identity.Commands;

public sealed record UpdateUserCommand(
    Guid    Id,
    string  FirstName,
    string  LastName,
    string? Phone,
    string? JobTitle,
    Guid?   DepartmentId,
    Guid    RoleId,
    Guid?   TeamLeaderId,
    string? PreferredLanguage,
    string? TimeZone,
    string? CurrencyCode
) : IRequest<Result<UserDto>>;

public sealed class UpdateUserCommandValidator : AbstractValidator<UpdateUserCommand>
{
    public UpdateUserCommandValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Phone).MaximumLength(50);
        RuleFor(x => x.JobTitle).MaximumLength(100);
        RuleFor(x => x.PreferredLanguage).MaximumLength(10);
        RuleFor(x => x.TimeZone).MaximumLength(50);
        RuleFor(x => x.CurrencyCode).MaximumLength(5);
        RuleFor(x => x.RoleId).NotEmpty();
    }
}

public sealed class UpdateUserCommandHandler(
    ApplicationDbContext db,
    UserManager<ApplicationUser> userManager,
    ITenantContext tenantContext,
    ICurrentUser currentUser,
    IAuthorizationService authService,
    IHttpContextAccessor httpContextAccessor,
    IIdentityActivityWriter activity,
    ILogger<UpdateUserCommandHandler> logger)
    : IRequestHandler<UpdateUserCommand, Result<UserDto>>
{
    public async Task<Result<UserDto>> Handle(UpdateUserCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null)
            return Result.Failure<UserDto>("Tenant context not resolved.");

        if (!currentUser.HasPermission("admin.users.update"))
            return Result.Failure<UserDto>("You don't have permission to update users.");

        var user = await db.Users.FirstOrDefaultAsync(u =>
            u.Id == cmd.Id && u.TenantId == tenantId && !u.IsDeleted, ct);
        if (user is null)
            return Result.Failure<UserDto>("User not found.");

        // Defence-in-depth: resource-based authorization. Even though the query
        // above already filters by tenant, this check runs the resource through
        // the auth pipeline and will reject cross-tenant access in a uniform way.
        var principal = httpContextAccessor.HttpContext?.User;
        if (principal is not null)
        {
            var authz = await authService.AuthorizeAsync(
                principal, user.TenantId, new SameTenantRequirement());
            if (!authz.Succeeded)
                return Result.Failure<UserDto>("Forbidden — resource belongs to another tenant.");
        }

        var role = await db.Roles.FindAsync([cmd.RoleId], ct);
        if (role is null || (role.TenantId != null && role.TenantId != tenantId))
            return Result.Failure<UserDto>("Role not found for this tenant.");

        if (cmd.TeamLeaderId is Guid tlId && tlId == cmd.Id)
            return Result.Failure<UserDto>("A user cannot be their own team leader.");

        if (cmd.TeamLeaderId is Guid tl &&
            !await db.Users.AnyAsync(u => u.Id == tl && u.TenantId == tenantId && !u.IsDeleted, ct))
            return Result.Failure<UserDto>("Team leader not found in this tenant.");

        if (cmd.DepartmentId is Guid d &&
            !await db.Departments.AnyAsync(dp => dp.Id == d && dp.TenantId == tenantId, ct))
            return Result.Failure<UserDto>("Department not found in this tenant.");

        // Apply changes
        user.FirstName         = cmd.FirstName;
        user.LastName          = cmd.LastName;
        user.PhoneNumber       = cmd.Phone;
        user.JobTitle          = cmd.JobTitle;
        user.DepartmentId      = cmd.DepartmentId;
        user.TeamLeaderId      = cmd.TeamLeaderId;
        user.PreferredLanguage = cmd.PreferredLanguage ?? user.PreferredLanguage;
        user.TimeZone          = cmd.TimeZone          ?? user.TimeZone;
        user.CurrencyCode      = cmd.CurrencyCode      ?? user.CurrencyCode;
        user.UpdatedAt         = DateTime.UtcNow;
        user.UpdatedBy         = currentUser.UserId == Guid.Empty ? null : currentUser.UserId;

        // Role change — replace all existing roles with the new single role
        var currentRoles = await userManager.GetRolesAsync(user);
        if (currentRoles.Count != 1 || !string.Equals(currentRoles[0], role.Name, StringComparison.Ordinal))
        {
            if (currentRoles.Count > 0)
                await userManager.RemoveFromRolesAsync(user, currentRoles);
            await userManager.AddToRoleAsync(user, role.Name!);
        }

        activity.Record(
            subjectUserId: user.Id,
            activityType:  "user.updated",
            description:   $"{user.FullName} was updated",
            metadata: new { role = role.Name });
        await db.SaveChangesAsync(ct);

        logger.LogInformation("User {UserId} updated in tenant {TenantId}", user.Id, tenantId);

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
