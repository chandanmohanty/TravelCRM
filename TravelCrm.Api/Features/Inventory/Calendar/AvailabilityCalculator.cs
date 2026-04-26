using TravelCrm.Api.Domain.Entities.Inventory;

namespace TravelCrm.Api.Features.Inventory.Calendar;

/// <summary>
/// Pure availability algorithm. No I/O. Callers fetch the relevant calendar
/// overrides + active holds and pass them in. Returns first failing date if any.
/// </summary>
public static class AvailabilityCalculator
{
    public static AvailabilityResult Check(
        Resource resource,
        IReadOnlyCollection<ResourceCalendar> calendarOverrides,
        IReadOnlyCollection<ResourceHold> existingHolds,
        DateOnly startDate,
        DateOnly endDate,
        ResourceCalendarSlot? requestedSlot,
        int requestedQuantity)
    {
        if (requestedQuantity < 1)
            return AvailabilityResult.Fail(startDate, "Quantity must be at least 1");

        if (resource is AssetResource && requestedQuantity != 1)
            return AvailabilityResult.Fail(startDate, "Asset resources must use Quantity = 1");

        var poolDefault = (resource as PoolResource)?.DefaultCapacity ?? 1;

        for (var d = startDate; d <= endDate; d = d.AddDays(1))
        {
            // 1. Determine capacity for this (date, slot)
            var calOverride = calendarOverrides.FirstOrDefault(
                c => c.ResourceId == resource.Id && c.Date == d && c.Slot == requestedSlot);

            if (calOverride is { IsBlocked: true })
                return AvailabilityResult.Fail(d, $"Date {d:yyyy-MM-dd} is blocked");

            var capacity = calOverride?.Capacity ?? poolDefault;

            // 2. Sum overlapping active holds with collision-compatible slot
            var occupied = existingHolds
                .Where(h => h.ResourceId == resource.Id
                         && (h.Status == ResourceHoldStatus.Held
                             || h.Status == ResourceHoldStatus.Confirmed)
                         && h.StartDate <= d && h.EndDate >= d
                         && SlotsCollide(h.Slot, requestedSlot))
                .Sum(h => h.Quantity);

            if (occupied + requestedQuantity > capacity)
                return AvailabilityResult.Fail(d,
                    $"Date {d:yyyy-MM-dd} exceeds capacity (have {capacity - occupied}, requesting {requestedQuantity})");
        }

        return AvailabilityResult.Ok();
    }

    /// <summary>
    /// Slot collision rule:
    ///   whole-day (null) collides with everything;
    ///   a specific slot collides with the same slot OR with whole-day.
    /// </summary>
    private static bool SlotsCollide(ResourceCalendarSlot? existing, ResourceCalendarSlot? requested)
        => existing is null || requested is null || existing == requested;
}

public sealed record AvailabilityResult(bool IsAvailable, DateOnly? FailingDate, string? Reason)
{
    public static AvailabilityResult Ok() => new(true, null, null);
    public static AvailabilityResult Fail(DateOnly date, string reason) => new(false, date, reason);
}
