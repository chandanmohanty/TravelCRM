namespace TravelCrm.Api.Domain.Entities.Crm;

/// <summary>Computed cache derived from <see cref="PipelineStage.Kind"/>.</summary>
public enum DealStatus
{
    Open = 0,
    Won  = 1,
    Lost = 2,
}

public sealed class Deal : IAuditableEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Title { get; set; } = default!;
    public Guid PipelineId { get; set; }
    public Guid StageId { get; set; }
    /// <summary>Nullable drill-back to the originating Lead.</summary>
    public Guid? LeadId { get; set; }

    // ── Lead snapshot — denormalised at create-time ──────────────────────────
    public string ContactName { get; set; } = default!;
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public string? CompanyName { get; set; }

    // ── Commercial ────────────────────────────────────────────────────────────
    public decimal? Value { get; set; }
    public string Currency { get; set; } = "USD";
    public int Probability { get; set; }    // 0–100
    public DateOnly? ExpectedCloseDate { get; set; }
    public DateOnly? ActualCloseDate { get; set; }

    public Guid OwnerUserId { get; set; }

    public List<string> Tags { get; set; } = new();
    public string? Notes { get; set; }
    /// <summary>Reserved — no Phase 1 UI.</summary>
    public string? CustomFields { get; set; }

    public DealStatus Status { get; set; } = DealStatus.Open;

    /// <summary>EF optimistic-concurrency token. Kanban drag-drop reads + sends this.</summary>
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();

    public bool IsDeleted { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Guid?    CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public Guid?    UpdatedBy { get; set; }
}
