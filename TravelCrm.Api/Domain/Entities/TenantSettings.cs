namespace TravelCrm.Api.Domain.Entities;

/// <summary>
/// Shared tenant-wide settings table (one row per tenant, lazy-created).
/// All Inventory sub-projects (Hotel, Vehicle, Driver, Guide) extend this table
/// with their own columns rather than creating separate settings tables.
/// </summary>
public sealed class TenantSettings : IAuditableEntity
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
