using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Resources.Queries;

public sealed record ListResourcesQuery(string? Type, string? Status, Guid? SupplierId)
    : IRequest<Result<List<ResourceDto>>>;

public sealed class ListResourcesHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<ListResourcesQuery, Result<List<ResourceDto>>>
{
    public async Task<Result<List<ResourceDto>>> Handle(ListResourcesQuery q, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.resources.view"))
            return Result.Failure<List<ResourceDto>>("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure<List<ResourceDto>>("Tenant not resolved");

        var query = db.Resources
            .AsNoTracking()
            .Include(r => r.Supplier)
            .Where(r => r.TenantId == tenantContext.TenantId);

        if (!string.IsNullOrWhiteSpace(q.Type))
            query = query.Where(r => r.Type == q.Type);

        if (!string.IsNullOrWhiteSpace(q.Status)
            && Enum.TryParse<ResourceStatus>(q.Status, ignoreCase: true, out var status))
            query = query.Where(r => r.Status == status);

        if (q.SupplierId.HasValue)
            query = query.Where(r => r.SupplierId == q.SupplierId.Value);

        var rows = await query.OrderBy(r => r.Name).ToListAsync(ct);
        return Result.Success(rows.Select(ResourceMapper.ToDto).ToList());
    }
}
