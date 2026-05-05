namespace TravelCrm.Api.Domain.Entities;

/// <summary>
/// A named AI-provider configuration (Claude / OpenAI / …). Multiple configs
/// per scope (platform or tenant); exactly one per scope is marked
/// <see cref="IsActive"/> at a time. Tenant rows override the platform default
/// for LLM-backed features. The <see cref="ApiKey"/> is encrypted at rest via
/// <see cref="Infrastructure.Security.ProtectedStringConverter"/>.
/// </summary>
public sealed class AiProviderConfiguration : IAuditableEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Null = platform-scoped; non-null = tenant-scoped override.</summary>
    public Guid? TenantId { get; set; }

    /// <summary>Human-friendly label, e.g. "Claude Sonnet — Production".</summary>
    public string Name { get; set; } = default!;

    public AiProvider Provider { get; set; }

    /// <summary>True when this is the active config for its scope.</summary>
    public bool IsActive { get; set; }

    /// <summary>
    /// Model identifier (provider-specific string). Examples:
    /// <c>claude-3-5-sonnet-20241022</c>, <c>gpt-4o-mini</c>.
    /// </summary>
    public string Model { get; set; } = default!;

    /// <summary>SENSITIVE — encrypted at rest, masked on API read.</summary>
    public string? ApiKey { get; set; }

    /// <summary>
    /// Optional base URL override (Azure OpenAI, proxy, local LLM gateway).
    /// Null = use the provider's default endpoint.
    /// </summary>
    public string? BaseUrl { get; set; }

    /// <summary>Sampling temperature (0.0–2.0). Nullable = provider default.</summary>
    public double? Temperature { get; set; }

    /// <summary>Max output tokens. Nullable = provider default.</summary>
    public int? MaxTokens { get; set; }

    // ── Audit ────────────────────────────────────────────────────────
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
}
