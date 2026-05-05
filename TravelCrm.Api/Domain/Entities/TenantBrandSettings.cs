namespace TravelCrm.Api.Domain.Entities;

/// <summary>
/// One row per tenant that chooses to override <see cref="PlatformBrandSettings"/>.
/// A <c>null</c> field on this row means "inherit from the platform default".
/// Intentionally does NOT inherit <see cref="BaseEntity"/>: the tenant_id here is a
/// foreign key to the tenants table and is enforced as unique (1-to-1), which is a
/// different semantic from BaseEntity's row-owning TenantId.
/// </summary>
public sealed class TenantBrandSettings : IAuditableEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>FK to <see cref="Tenant.Id"/>; has a unique index (1 row per tenant).</summary>
    public Guid TenantId { get; set; }

    public string? DisplayName { get; set; }
    public string? LogoLightUrl { get; set; }
    public string? LogoDarkUrl { get; set; }
    public string? FaviconUrl { get; set; }
    public string? PrimaryColorHex { get; set; }
    public string? SupportEmail { get; set; }
    public string? SupportUrl { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
}
