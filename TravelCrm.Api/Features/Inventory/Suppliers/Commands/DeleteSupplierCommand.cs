using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Suppliers.Commands;

public sealed record DeleteSupplierCommand(Guid Id) : IRequest<Result>;

public sealed class DeleteSupplierHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<DeleteSupplierCommand, Result>
{
    public async Task<Result> Handle(DeleteSupplierCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.suppliers.manage"))
            return Result.Failure("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure("Tenant not resolved");

        var entity = await db.Suppliers.FirstOrDefaultAsync(
            s => s.Id == cmd.Id && s.TenantId == tenantContext.TenantId, ct);
        if (entity is null) return Result.Failure("Supplier not found");

        var inUse = await db.Resources.AnyAsync(
            r => r.SupplierId == cmd.Id && r.TenantId == tenantContext.TenantId, ct);
        if (inUse) return Result.Failure("Supplier is in use by existing resources");

        db.Suppliers.Remove(entity);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
