namespace TravelCrm.Api.Domain.Entities.Inventory;

public abstract class Resource : BaseEntity
{
    /// <summary>Discriminator. Set automatically by subclass constructors.</summary>
    public ResourceKind Kind { get; protected set; }

    /// <summary>Free-form type slug ("Hotel", "RoomType", "Vehicle", "Driver", ...). Sub-modules add their own values.</summary>
    public string Type { get; set; } = default!;

    public string Name { get; set; } = default!;

    /// <summary>Nullable: null = tenant-owned, otherwise FK to Supplier.</summary>
    public Guid? SupplierId { get; set; }

    public ResourceStatus Status { get; set; } = ResourceStatus.Active;

    /// <summary>Module-specific JSON metadata (room amenities, vehicle reg, license number). Opaque to the foundation.</summary>
    public string? Metadata { get; set; }

    public Supplier? Supplier { get; set; }
}
