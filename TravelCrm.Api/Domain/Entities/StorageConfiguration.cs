namespace TravelCrm.Api.Domain.Entities;

/// <summary>
/// A named storage backend configuration. Multiple configs can exist per scope
/// (platform or tenant), but exactly one must be marked <see cref="IsActive"/>.
/// Tenant configs override the platform default for file uploads.
/// </summary>
public sealed class StorageConfiguration : IAuditableEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Null = platform-scoped; non-null = tenant-scoped override.</summary>
    public Guid? TenantId { get; set; }

    /// <summary>Human-friendly label, e.g. "Production S3" or "Dev Local".</summary>
    public string Name { get; set; } = default!;

    /// <summary>Which storage backend this config drives.</summary>
    public StorageDriver Driver { get; set; }

    /// <summary>True if this is the active config for its scope. Only one per scope.</summary>
    public bool IsActive { get; set; }

    // ── Local Disk ───────────────────────────────────────────────────

    /// <summary>Sub-path under wwwroot (e.g. "uploads"). LocalDisk only.</summary>
    public string? BasePath { get; set; }

    // ── Amazon S3 ────────────────────────────────────────────────────

    public string? AwsAccessKey { get; set; }

    /// <summary>SENSITIVE — masked on API read, never returned in full.</summary>
    public string? AwsSecretKey { get; set; }

    public string? AwsRegion { get; set; }
    public string? AwsBucket { get; set; }

    /// <summary>Optional custom endpoint for S3-compatible services (MinIO, DigitalOcean Spaces).</summary>
    public string? AwsEndpoint { get; set; }

    // ── Azure Blob ───────────────────────────────────────────────────

    /// <summary>SENSITIVE — masked on API read.</summary>
    public string? AzureConnectionString { get; set; }

    public string? AzureContainerName { get; set; }

    // ── Google Cloud Storage ─────────────────────────────────────────

    /// <summary>SENSITIVE — masked on API read. Full JSON service-account key.</summary>
    public string? GcsServiceAccountJson { get; set; }

    public string? GcsBucket { get; set; }

    // ── Shared options ───────────────────────────────────────────────

    /// <summary>Max upload size in bytes. Default 5 MB.</summary>
    public long MaxFileSizeBytes { get; set; } = 5 * 1024 * 1024;

    /// <summary>Comma-separated MIME allow-list.</summary>
    public string AllowedContentTypes { get; set; } =
        "image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon,image/vnd.microsoft.icon";

    // ── Audit ────────────────────────────────────────────────────────

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
}
