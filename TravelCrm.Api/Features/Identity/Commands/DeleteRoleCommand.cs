using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Identity.Commands;

public sealed record DeleteRoleCommand(Guid Id) : IRequest<Result>;

public sealed class DeleteRoleCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser,
    ILogger<DeleteRoleCommandHandler> logger)
    : IRequestHandler<DeleteRoleCommand, Result>
{
    public async Task<Result> Handle(DeleteRoleCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure("Tenant context not resolved.");
        if (!currentUser.HasPermission("admin.roles.delete"))
            return Result.Failure("You don't have permission to delete roles.");

        var role = await db.Roles.FirstOrDefaultAsync(r =>
            r.Id == cmd.Id && r.TenantId == tenantId, ct);
        if (role is null) return Result.Failure("Role not found.");

        if (role.IsSystemRole)
            return Result.Failure("System roles cannot be deleted.");

        var inUse = await db.UserRoles.AnyAsync(ur => ur.RoleId == role.Id, ct);
        if (inUse)
            return Result.Failure("This role is assigned to one or more users. Reassign them first.");

        // Cascade: RolePermission rows are removed by the FK cascade rule
        db.Roles.Remove(role);
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Role {RoleId} deleted from tenant {TenantId}", role.Id, tenantId);
        return Result.Success();
    }
}
