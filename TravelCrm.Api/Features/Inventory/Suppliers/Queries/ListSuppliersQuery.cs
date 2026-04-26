using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Suppliers.Queries;

public sealed record ListSuppliersQuery(string? SupplierType) : IRequest<Result<List<SupplierDto>>>;

public sealed class ListSuppliersHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<ListSuppliersQuery, Result<List<SupplierDto>>>
{
    public async Task<Result<List<SupplierDto>>> Handle(ListSuppliersQuery q, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.suppliers.view"))
            return Result.Failure<List<SupplierDto>>("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure<List<SupplierDto>>("Tenant not resolved");

        var query = db.Suppliers
            .AsNoTracking()
            .Where(s => s.TenantId == tenantContext.TenantId);

        if (!string.IsNullOrWhiteSpace(q.SupplierType)
            && Enum.TryParse<SupplierType>(q.SupplierType, ignoreCase: true, out var st))
            query = query.Where(s => s.SupplierType == st);

        var rows = await query.OrderBy(s => s.Name).ToListAsync(ct);
        return Result.Success(rows.Select(SupplierMapper.ToDto).ToList());
    }
}
