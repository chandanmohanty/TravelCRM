namespace TravelCrm.Api.Domain.Entities.Inventory;

public sealed class ResourceHold : BaseEntity
{
    public Guid ResourceId { get; set; }

    /// <summary>Inclusive.</summary>
    public DateOnly StartDate { get; set; }

    /// <summary>Inclusive. Single-day hold has Start == End.</summary>
    public DateOnly EndDate { get; set; }

    /// <summary>Same enum as ResourceCalendar.Slot.</summary>
    public ResourceCalendarSlot? Slot { get; set; }

    /// <summary>For pool: number of units. For asset: must be 1.</summary>
    public int Quantity { get; set; } = 1;

    public ResourceHoldStatus Status { get; set; } = ResourceHoldStatus.Held;

    /// <summary>UTC. Non-null only when Status == Held.</summary>
    public DateTime? ExpiresAt { get; set; }

    /// <summary>Set when the future Booking module attaches a booking id.</summary>
    public string? BookingRef { get; set; }

    public Guid HeldByUserId { get; set; }

    public string? Notes { get; set; }

    /// <summary>Number of times ExtendHold has been invoked. Caps at 3.</summary>
    public int ExtensionCount { get; set; }

    public Resource? Resource { get; set; }
}
