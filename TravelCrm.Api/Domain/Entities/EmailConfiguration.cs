namespace TravelCrm.Api.Domain.Entities;

/// <summary>
/// A named email sending configuration. Multiple configs can exist per scope
/// (platform or tenant), but exactly one must be marked <see cref="IsActive"/>.
/// Tenant configs override the platform default for outbound emails.
/// </summary>
public sealed class EmailConfiguration : IAuditableEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Null = platform-scoped; non-null = tenant-scoped override.</summary>
    public Guid? TenantId { get; set; }

    /// <summary>Human-friendly label, e.g. "SendGrid Production".</summary>
    public string Name { get; set; } = default!;

    /// <summary>Which email provider / transport this config uses.</summary>
    public EmailProvider Provider { get; set; }

    /// <summary>True if this is the active config for its scope.</summary>
    public bool IsActive { get; set; }

    // ── SMTP Settings (used by Smtp, Office365, Outlook, Gmail, Exchange, SES) ──

    /// <summary>SMTP server hostname. Preset for known providers, custom for generic.</summary>
    public string? SmtpHost { get; set; }

    /// <summary>SMTP port. Typically 587 (TLS) or 465 (SSL).</summary>
    public int SmtpPort { get; set; } = 587;

    /// <summary>SMTP authentication username (email or API key name).</summary>
    public string? Username { get; set; }

    /// <summary>SENSITIVE — masked on API read. SMTP password or app-specific password.</summary>
    public string? Password { get; set; }

    /// <summary>Enable STARTTLS / SSL for the SMTP connection.</summary>
    public bool EnableSsl { get; set; } = true;

    // ── Sender Identity ──────────────────────────────────────────────

    /// <summary>From address for outbound emails.</summary>
    public string SenderEmail { get; set; } = default!;

    /// <summary>Display name shown to recipients.</summary>
    public string SenderName { get; set; } = default!;

    // ── API-Based Provider Fields ────────────────────────────────────

    /// <summary>SENSITIVE — masked on API read. API key for SendGrid / Mailgun.</summary>
    public string? ApiKey { get; set; }

    /// <summary>Mailgun-specific sending domain (e.g. mg.yourcompany.com).</summary>
    public string? ApiDomain { get; set; }

    /// <summary>AWS region for SES SMTP (e.g. us-east-1). Also used for SES endpoint.</summary>
    public string? AwsRegion { get; set; }

    // ── Audit ────────────────────────────────────────────────────────

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
}
