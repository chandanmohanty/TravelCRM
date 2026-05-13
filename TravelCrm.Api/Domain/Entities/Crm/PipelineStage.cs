namespace TravelCrm.Api.Domain.Entities.Crm;

/// <summary>
/// Semantic role of a stage. Tenants choose the display name; reports use
/// <see cref="PipelineStageKind"/> to compute win-rate independent of naming.
/// </summary>
public enum PipelineStageKind
{
    Open = 0,
    Won  = 1,
    Lost = 2,
}

public sealed class PipelineStage : IAuditableEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid PipelineId { get; set; }
    public string Name { get; set; } = default!;
    public int SortOrder { get; set; }
    /// <summary>0–100. Applied to new deals; can be overridden per deal.</summary>
    public int DefaultProbability { get; set; }
    public PipelineStageKind Kind { get; set; } = PipelineStageKind.Open;
    public string ColorHex { get; set; } = "#94a3b8";
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
}
