using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Resources.Commands;

public sealed record UnblockResourceCommand(Guid Id) : IRequest<Result>;

public sealed class UnblockResourceHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<UnblockResourceCommand, Result>
{
    public async Task<Result> Handle(UnblockResourceCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.resources.manage"))
            return Result.Failure("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure("Tenant not resolved");

        var entity = await db.Resources.FirstOrDefaultAsync(
            r => r.Id == cmd.Id && r.TenantId == tenantContext.TenantId, ct);
        if (entity is null) return Result.Failure("Resource not found");

        entity.Status = ResourceStatus.Active;
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
