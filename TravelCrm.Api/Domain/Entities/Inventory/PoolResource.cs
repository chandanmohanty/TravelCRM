namespace TravelCrm.Api.Domain.Entities.Inventory;

public sealed class PoolResource : Resource
{
    public PoolResource() { Kind = ResourceKind.Pool; }

    /// <summary>Available units per date when no ResourceCalendar override exists.</summary>
    public int DefaultCapacity { get; set; }
}
