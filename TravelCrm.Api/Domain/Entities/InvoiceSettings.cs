namespace TravelCrm.Api.Domain.Entities;

/// <summary>
/// Tenant-scoped invoice defaults (one row per tenant, lazy-created).
/// The numbering template uses tokens that the invoice generator expands:
/// <c>{YYYY}</c> year, <c>{YY}</c> two-digit year, <c>{MM}</c> month,
/// <c>{FY}</c> fiscal year short (e.g. <c>25-26</c>), <c>{SEQ}</c> per-tenant
/// sequence. Example: <c>INV/{FY}/{SEQ:0000}</c> → <c>INV/25-26/0001</c>.
/// </summary>
public sealed class InvoiceSettings : IAuditableEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    /// <summary>Token template, see class summary. Defaults to <c>INV/{FY}/{SEQ:0000}</c>.</summary>
    public string NumberingTemplate { get; set; } = "INV/{FY}/{SEQ:0000}";

    /// <summary>Next sequence number to use — incremented atomically when an invoice is generated.</summary>
    public int NextSequence { get; set; } = 1;

    // ── GST (India) ──────────────────────────────────────────────────────────
    public string? GstNumber { get; set; }
    public string? GstLegalName { get; set; }
    public string? GstAddress { get; set; }
    public string? GstStateCode { get; set; }

    // ── Defaults ─────────────────────────────────────────────────────────────
    /// <summary>Default payment-terms line (e.g. <c>Net 30</c>).</summary>
    public string? DefaultTerms { get; set; }

    /// <summary>Footer/notes boilerplate appended to every invoice.</summary>
    public string? DefaultNotes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
}
