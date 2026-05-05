namespace TravelCrm.Api.Domain.Entities;

/// <summary>
/// Singleton row holding application-wide brand defaults visible across every tenant
/// until the tenant provides its own override. Not tenant-scoped — intentionally does
/// NOT inherit <see cref="BaseEntity"/> (which mandates a non-nullable TenantId).
/// </summary>
public sealed class PlatformBrandSettings : IAuditableEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Display name shown alongside the logo and in the browser title.</summary>
    public string? DisplayName { get; set; }

    /// <summary>Relative URL to the light-mode logo (typically dark ink on light bg).</summary>
    public string? LogoLightUrl { get; set; }

    /// <summary>Relative URL to the dark-mode logo (typically light ink on dark bg).</summary>
    public string? LogoDarkUrl { get; set; }

    /// <summary>Relative URL to the favicon shown in the browser tab.</summary>
    public string? FaviconUrl { get; set; }

    /// <summary>Primary brand colour as a 6-digit hex string, e.g. <c>#5D87FF</c>.</summary>
    public string? PrimaryColorHex { get; set; }

    /// <summary>Public support email.</summary>
    public string? SupportEmail { get; set; }

    /// <summary>Public support URL (help centre, docs, etc.).</summary>
    public string? SupportUrl { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public Guid? UpdatedBy { get; set; }
}
