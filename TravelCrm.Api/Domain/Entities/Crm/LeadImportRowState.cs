namespace TravelCrm.Api.Domain.Entities.Crm;

/// <summary>
/// Per-imported-row state for a Google Sheet connection. Powers the A3
/// hash-skip rule and position-independent upsert. Unique on
/// (ImportSourceId, MatchKey). Cascade-deleted with the source.
/// </summary>
public sealed class LeadImportRowState
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid ImportSourceId { get; set; }

    public string MatchKey { get; set; } = string.Empty;
    public string ContentHash { get; set; } = string.Empty;
    public Guid? LeadId { get; set; }
    public DateTime LastSeenAt { get; set; } = DateTime.UtcNow;
}
