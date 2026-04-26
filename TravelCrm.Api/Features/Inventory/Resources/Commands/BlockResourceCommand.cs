using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Resources.Commands;

public sealed record BlockResourceCommand(Guid Id) : IRequest<Result>;

public sealed class BlockResourceHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<BlockResourceCommand, Result>
{
    public async Task<Result> Handle(BlockResourceCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.resources.manage"))
            return Result.Failure("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure("Tenant not resolved");

        var entity = await db.Resources.FirstOrDefaultAsync(
            r => r.Id == cmd.Id && r.TenantId == tenantContext.TenantId, ct);
        if (entity is null) return Result.Failure("Resource not found");

        entity.Status = ResourceStatus.Blocked;
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
