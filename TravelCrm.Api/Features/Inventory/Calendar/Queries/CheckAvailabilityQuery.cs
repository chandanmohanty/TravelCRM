using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Calendar.Queries;

public sealed record CheckAvailabilityQuery(Guid ResourceId, DateOnly From, DateOnly To)
    : IRequest<Result<List<AvailabilityDto>>>;

public sealed class CheckAvailabilityHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<CheckAvailabilityQuery, Result<List<AvailabilityDto>>>
{
    public async Task<Result<List<AvailabilityDto>>> Handle(CheckAvailabilityQuery q, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.calendar.view"))
            return Result.Failure<List<AvailabilityDto>>("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure<List<AvailabilityDto>>("Tenant not resolved");

        var resource = await db.Resources
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == q.ResourceId && r.TenantId == tenantContext.TenantId, ct);
        if (resource is null) return Result.Failure<List<AvailabilityDto>>("Resource not found");

        var overrides = await db.ResourceCalendar
            .AsNoTracking()
            .Where(c => c.TenantId == tenantContext.TenantId
                     && c.ResourceId == q.ResourceId
                     && c.Date >= q.From && c.Date <= q.To)
            .ToListAsync(ct);

        var holds = await db.ResourceHolds
            .AsNoTracking()
            .Where(h => h.TenantId == tenantContext.TenantId
                     && h.ResourceId == q.ResourceId
                     && (h.Status == ResourceHoldStatus.Held || h.Status == ResourceHoldStatus.Confirmed)
                     && h.StartDate <= q.To && h.EndDate >= q.From)
            .ToListAsync(ct);

        var defaultCapacity = (resource as PoolResource)?.DefaultCapacity ?? 1;
        var result = new List<AvailabilityDto>();

        for (var d = q.From; d <= q.To; d = d.AddDays(1))
        {
            // Whole-day bucket only for now (slot UI is module-specific)
            var calOverride = overrides.FirstOrDefault(c => c.Date == d && c.Slot is null);
            var capacity = calOverride?.Capacity ?? defaultCapacity;
            var occupied = holds
                .Where(h => h.StartDate <= d && h.EndDate >= d
                         && (h.Slot is null)) // count whole-day holds only for whole-day bucket
                .Sum(h => h.Quantity);

            result.Add(new AvailabilityDto(
                Date: d,
                Slot: null,
                Capacity: capacity,
                Occupied: occupied,
                Available: Math.Max(0, capacity - occupied),
                IsBlocked: calOverride?.IsBlocked ?? false,
                Notes: calOverride?.Notes
            ));
        }

        return Result.Success(result);
    }
}
