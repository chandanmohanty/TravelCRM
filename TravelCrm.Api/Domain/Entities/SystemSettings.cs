namespace TravelCrm.Api.Domain.Entities;

/// <summary>
/// Tenant-scoped display + locale defaults. Exactly one row per tenant
/// (lazy-created on first save). Does NOT inherit <see cref="BaseEntity"/>:
/// <c>TenantId</c> here is a 1-to-1 FK to <c>Tenants</c> (unique index),
/// not a row-owning tenant discriminator.
/// </summary>
public sealed class SystemSettings : IAuditableEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    /// <summary>e.g. <c>dd/MM/yyyy</c>, <c>MM/dd/yyyy</c>, <c>yyyy-MM-dd</c>.</summary>
    public string DateFormat { get; set; } = "dd/MM/yyyy";

    /// <summary>e.g. <c>HH:mm</c> (24h) or <c>hh:mm a</c> (12h).</summary>
    public string TimeFormat { get; set; } = "HH:mm";

    public string DefaultTimeZone { get; set; } = "UTC";
    public string DefaultCurrencyCode { get; set; } = "USD";

    /// <summary>Month (1-12) the fiscal year starts. India = 4 (April); calendar = 1.</summary>
    public int FiscalYearStartMonth { get; set; } = 1;

    /// <summary>Day-of-month (1-28) the fiscal year starts. Default 1st.</summary>
    public int FiscalYearStartDay { get; set; } = 1;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
}
