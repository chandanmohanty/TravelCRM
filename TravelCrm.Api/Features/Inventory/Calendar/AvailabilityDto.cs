using TravelCrm.Api.Domain.Entities.Inventory;

namespace TravelCrm.Api.Features.Inventory.Calendar;

public sealed record AvailabilityDto(
    DateOnly Date,
    ResourceCalendarSlot? Slot,
    int Capacity,
    int Occupied,
    int Available,
    bool IsBlocked,
    string? Notes
);
