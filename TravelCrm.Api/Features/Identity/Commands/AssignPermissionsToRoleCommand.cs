using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Identity.Commands;

/// <summary>
/// Replaces a role's permission set. System-role permission sets are managed
/// by <c>RolePermissionSeeder</c> and not editable through this API —
/// the handler refuses to modify them.
/// </summary>
public sealed record AssignPermissionsToRoleCommand(
    Guid RoleId, IReadOnlyList<Guid> PermissionIds) : IRequest<Result>;

public sealed class AssignPermissionsToRoleCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser,
    ILogger<AssignPermissionsToRoleCommandHandler> logger)
    : IRequestHandler<AssignPermissionsToRoleCommand, Result>
{
    public async Task<Result> Handle(AssignPermissionsToRoleCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure("Tenant context not resolved.");
        if (!currentUser.HasPermission("admin.roles.assign_permissions"))
            return Result.Failure("You don't have permission to edit the permission matrix.");

        var role = await db.Roles.FirstOrDefaultAsync(r =>
            r.Id == cmd.RoleId && r.TenantId == tenantId, ct);
        if (role is null) return Result.Failure("Role not found in this tenant.");
        if (role.IsSystemRole)
            return Result.Failure("System role permissions are managed by the seeder and cannot be edited.");

        // Validate all requested permissions exist in the global catalog
        var requested = cmd.PermissionIds.Distinct().ToHashSet();
        var existingPermIds = await db.Permissions
            .Where(p => p.TenantId == null && requested.Contains(p.Id))
            .Select(p => p.Id)
            .ToListAsync(ct);
        if (existingPermIds.Count != requested.Count)
            return Result.Failure("One or more permission IDs are invalid.");

        await using var tx = await db.Database.BeginTransactionAsync(ct);

        // Clear existing
        var existing = await db.RolePermissions
            .Where(rp => rp.RoleId == role.Id)
            .ToListAsync(ct);
        db.RolePermissions.RemoveRange(existing);

        // Insert new set
        var actorId = currentUser.UserId == Guid.Empty ? (Guid?)null : currentUser.UserId;
        var now = DateTime.UtcNow;
        foreach (var pid in requested)
        {
            db.RolePermissions.Add(new RolePermission
            {
                RoleId       = role.Id,
                PermissionId = pid,
                TenantId     = role.TenantId,
                GrantedAt    = now,
                GrantedBy    = actorId
            });
        }

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        logger.LogInformation(
            "Role {RoleId} permissions replaced ({Count} grants) in tenant {TenantId} by {Actor}",
            role.Id, requested.Count, tenantId, actorId);

        return Result.Success();
    }
}
