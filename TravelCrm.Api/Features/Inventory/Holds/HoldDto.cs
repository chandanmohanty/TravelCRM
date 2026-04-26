using TravelCrm.Api.Domain.Entities.Inventory;

namespace TravelCrm.Api.Features.Inventory.Holds;

public sealed record HoldDto(
    Guid Id,
    Guid ResourceId,
    string ResourceName,
    DateOnly StartDate,
    DateOnly EndDate,
    ResourceCalendarSlot? Slot,
    int Quantity,
    string Status,
    DateTime? ExpiresAt,
    string? BookingRef,
    Guid HeldByUserId,
    int ExtensionCount,
    string? Notes,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public static class HoldMapper
{
    public static HoldDto ToDto(ResourceHold h, string resourceName) => new(
        h.Id, h.ResourceId, resourceName,
        h.StartDate, h.EndDate, h.Slot, h.Quantity,
        h.Status.ToString(), h.ExpiresAt, h.BookingRef,
        h.HeldByUserId, h.ExtensionCount, h.Notes,
        h.CreatedAt, h.UpdatedAt ?? h.CreatedAt
    );
}
