namespace TravelCrm.Api.Domain.Entities;

/// <summary>
/// Tenant-scoped Inventory module settings (one row per tenant, lazy-created).
/// Currently only holds HoldTtlHours; future inventory features add their own columns here.
/// </summary>
public sealed class InventorySettings : IAuditableEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    /// <summary>How long a soft-hold remains valid before the sweeper expires it. Default 24h.</summary>
    public int HoldTtlHours { get; set; } = 24;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
}
