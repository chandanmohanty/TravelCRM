using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Holds.Queries;

public sealed record ListHoldsQuery(
    Guid? ResourceId,
    string? Status,
    DateOnly? From,
    DateOnly? To
) : IRequest<Result<List<HoldDto>>>;

public sealed class ListHoldsHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<ListHoldsQuery, Result<List<HoldDto>>>
{
    public async Task<Result<List<HoldDto>>> Handle(ListHoldsQuery q, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.holds.view"))
            return Result.Failure<List<HoldDto>>("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure<List<HoldDto>>("Tenant not resolved");

        var query = db.ResourceHolds
            .AsNoTracking()
            .Include(h => h.Resource)
            .Where(h => h.TenantId == tenantContext.TenantId);

        if (q.ResourceId.HasValue)
            query = query.Where(h => h.ResourceId == q.ResourceId.Value);

        if (!string.IsNullOrWhiteSpace(q.Status)
            && Enum.TryParse<ResourceHoldStatus>(q.Status, ignoreCase: true, out var status))
            query = query.Where(h => h.Status == status);

        if (q.From.HasValue) query = query.Where(h => h.EndDate >= q.From.Value);
        if (q.To.HasValue) query = query.Where(h => h.StartDate <= q.To.Value);

        var rows = await query.OrderByDescending(h => h.CreatedAt).ToListAsync(ct);
        return Result.Success(rows.Select(h => HoldMapper.ToDto(h, h.Resource?.Name ?? "")).ToList());
    }
}
