using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Suppliers.Queries;

public sealed record GetSupplierQuery(Guid Id) : IRequest<Result<SupplierDto>>;

public sealed class GetSupplierHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<GetSupplierQuery, Result<SupplierDto>>
{
    public async Task<Result<SupplierDto>> Handle(GetSupplierQuery q, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.suppliers.view"))
            return Result.Failure<SupplierDto>("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure<SupplierDto>("Tenant not resolved");

        var entity = await db.Suppliers
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == q.Id && s.TenantId == tenantContext.TenantId, ct);
        if (entity is null) return Result.Failure<SupplierDto>("Supplier not found");

        return Result.Success(SupplierMapper.ToDto(entity));
    }
}
