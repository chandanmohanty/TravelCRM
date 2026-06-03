namespace TravelCrm.Api.Domain.Entities.Crm;

/// <summary>
/// Short-lived Excel parse buffer so the file is uploaded once across wizard
/// steps. Deleted on commit; hourly sweep removes rows older than 1h.
/// Not a domain entity — no audit quartet.
/// </summary>
public sealed class LeadImportStaging
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    /// <summary>jsonb — array of row objects keyed by header.</summary>
    public string RowsJson { get; set; } = "[]";
    /// <summary>jsonb — array of header strings in column order.</summary>
    public string HeadersJson { get; set; } = "[]";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
