namespace TravelCrm.Api.Domain.Entities.Crm;

public enum LeadImportSourceKind
{
    GoogleSheet = 1,
    // Excel reserved — Excel imports are stateless and create no source row.
    Excel = 2,
}

public enum SyncCadence
{
    Manual     = 0,
    Every15Min = 1,
    Hourly     = 2,
    Daily      = 3,
}

public enum LeadImportSourceStatus
{
    Active       = 1,
    Paused       = 2,
    Error        = 3,
    Disconnected = 4,
}

/// <summary>
/// A persisted Google Sheet connection with recurring sync. Excel imports do
/// NOT create one of these. RowVersion is trigger-managed exactly like
/// <see cref="Deal.RowVersion"/> (see migration trigger in Task 3).
/// </summary>
public sealed class LeadImportSource : IAuditableEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    public LeadImportSourceKind Kind { get; set; } = LeadImportSourceKind.GoogleSheet;
    public string DisplayName { get; set; } = string.Empty;

    public string SpreadsheetId { get; set; } = string.Empty;
    public string SheetName { get; set; } = string.Empty;

    /// <summary>JSON object: CRM field → source header. Stored jsonb.</summary>
    public string ColumnMapping { get; set; } = "{}";

    public string MatchKeyField { get; set; } = "email";

    public SyncCadence SyncCadence { get; set; } = SyncCadence.Manual;
    public LeadImportSourceStatus Status { get; set; } = LeadImportSourceStatus.Active;

    public DateTime? LastPolledAt { get; set; }
    public DateTime? LastSuccessAt { get; set; }

    /// <summary>jsonb? — last run's {created,updated,skipped,failed,errors[]}.</summary>
    public string? LastResultJson { get; set; }
    public string? LastError { get; set; }

    public byte[] RowVersion { get; set; } = Array.Empty<byte>();

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Guid?    CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public Guid?    UpdatedBy { get; set; }
}
