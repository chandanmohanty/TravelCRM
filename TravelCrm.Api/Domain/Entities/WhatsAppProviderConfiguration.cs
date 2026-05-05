namespace TravelCrm.Api.Domain.Entities;

/// <summary>Supported WhatsApp gateway vendors.</summary>
public enum WhatsAppProvider { Gupshup = 1, Wati = 2 }

/// <summary>
/// A named WhatsApp-provider configuration (Gupshup / WATI / …).
/// Multiple configs per scope; exactly one per scope is marked
/// <see cref="IsActive"/> at a time. The <see cref="ApiKey"/> is encrypted
/// at rest via <see cref="Infrastructure.Security.ProtectedStringConverter"/>.
/// </summary>
public sealed class WhatsAppProviderConfiguration : IAuditableEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Null = platform-scoped; non-null = tenant-scoped override.</summary>
    public Guid? TenantId { get; set; }

    /// <summary>Human-friendly label, e.g. "Gupshup — Production".</summary>
    public string Name { get; set; } = default!;

    public WhatsAppProvider Provider { get; set; }

    public bool IsActive { get; set; }

    /// <summary>SENSITIVE — encrypted at rest. Gupshup API key / WATI access token.</summary>
    public string? ApiKey { get; set; }

    /// <summary>
    /// Gupshup: app/source name registered in the Gupshup portal.
    /// WATI: not used.
    /// </summary>
    public string? AppName { get; set; }

    /// <summary>WhatsApp sender phone number in E.164 format (e.g. +919876543210).</summary>
    public string PhoneNumber { get; set; } = default!;

    /// <summary>
    /// WATI: tenant-specific base URL (e.g. https://live-server.wati.io).
    /// Gupshup: leave null to use the default endpoint.
    /// </summary>
    public string? BaseUrl { get; set; }

    // ── Audit ────────────────────────────────────────────────────────
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
}
