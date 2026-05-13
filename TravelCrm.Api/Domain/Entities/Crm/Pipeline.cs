namespace TravelCrm.Api.Domain.Entities.Crm;

/// <summary>
/// Tenant-scoped pipeline (e.g. "Sales", "Repeat Customer", "Group Bookings").
/// Holds a configurable ordered list of <see cref="PipelineStage"/> rows.
/// </summary>
public sealed class Pipeline : IAuditableEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public bool IsDefault { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public List<PipelineStage> Stages { get; set; } = new();
}
