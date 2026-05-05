using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Identity.DTOs;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Identity.Commands;

public sealed record UpdateRoleCommand(Guid Id, string Name, string? Description)
    : IRequest<Result<RoleDto>>;

public sealed class UpdateRoleCommandValidator : AbstractValidator<UpdateRoleCommand>
{
    public UpdateRoleCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Description).MaximumLength(500);
    }
}

public sealed class UpdateRoleCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser,
    ILogger<UpdateRoleCommandHandler> logger)
    : IRequestHandler<UpdateRoleCommand, Result<RoleDto>>
{
    public async Task<Result<RoleDto>> Handle(UpdateRoleCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure<RoleDto>("Tenant context not resolved.");
        if (!currentUser.HasPermission("admin.roles.update"))
            return Result.Failure<RoleDto>("You don't have permission to update roles.");

        var role = await db.Roles.FirstOrDefaultAsync(r =>
            r.Id == cmd.Id && r.TenantId == tenantId, ct);
        if (role is null) return Result.Failure<RoleDto>("Role not found.");

        if (role.IsSystemRole)
            return Result.Failure<RoleDto>("System roles cannot be edited.");

        // Name uniqueness within tenant (excluding self)
        if (await db.Roles.AnyAsync(r =>
            r.TenantId == tenantId && r.Name == cmd.Name && r.Id != cmd.Id, ct))
            return Result.Failure<RoleDto>($"A role named '{cmd.Name}' already exists.");

        role.Name        = cmd.Name;
        role.Description = cmd.Description;
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Role {RoleId} updated in tenant {TenantId}", role.Id, tenantId);

        var permCount = await db.RolePermissions.CountAsync(rp => rp.RoleId == role.Id, ct);
        var userCount = await db.UserRoles
            .Where(ur => ur.RoleId == role.Id)
            .Join(db.Users, ur => ur.UserId, u => u.Id, (ur, u) => u.IsDeleted)
            .CountAsync(isDel => !isDel, ct);

        return Result.Success(new RoleDto(
            role.Id, role.TenantId, role.Name!, role.Slug, role.Description,
            role.IsSystemRole, permCount, userCount, role.CreatedAt));
    }
}
