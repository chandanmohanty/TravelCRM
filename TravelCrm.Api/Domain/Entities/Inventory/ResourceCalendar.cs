namespace TravelCrm.Api.Domain.Entities.Inventory;

public sealed class ResourceCalendar : BaseEntity
{
    public Guid ResourceId { get; set; }

    public DateOnly Date { get; set; }

    /// <summary>Null = whole-day bucket. Otherwise specific slot.</summary>
    public ResourceCalendarSlot? Slot { get; set; }

    /// <summary>For pool: overrides PoolResource.DefaultCapacity. For asset: 0 or 1.</summary>
    public int Capacity { get; set; }

    public bool IsBlocked { get; set; }

    public string? Notes { get; set; }

    /// <summary>EF concurrency token. PostgreSQL xmin.</summary>
    public uint RowVersion { get; set; }

    public Resource? Resource { get; set; }
}
