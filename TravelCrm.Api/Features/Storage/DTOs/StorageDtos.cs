using TravelCrm.Api.Domain.Entities;

namespace TravelCrm.Api.Features.Storage.DTOs;

// ── Response DTO ─────────────────────────────────────────────────────────────

/// <summary>
/// Storage configuration as returned by the API. Sensitive fields are masked
/// (e.g. <c>***abcd</c>) and never contain full credentials.
/// </summary>
public sealed record StorageConfigDto(
    Guid           Id,
    Guid?          TenantId,
    string         Name,
    StorageDriver  Driver,
    bool           IsActive,
    // LocalDisk
    string?        BasePath,
    // S3
    string?        AwsAccessKey,
    string?        AwsSecretKey,    // MASKED
    string?        AwsRegion,
    string?        AwsBucket,
    string?        AwsEndpoint,
    // Azure
    string?        AzureConnectionString,  // MASKED
    string?        AzureContainerName,
    // GCS
    string?        GcsServiceAccountJson,  // MASKED
    string?        GcsBucket,
    // Shared
    long           MaxFileSizeBytes,
    string         AllowedContentTypes,
    // Audit
    DateTime       CreatedAt,
    DateTime?      UpdatedAt);

// ── Request DTOs ─────────────────────────────────────────────────────────────

public sealed record CreateStorageConfigRequest(
    string         Name,
    StorageDriver  Driver,
    bool           IsActive,
    // LocalDisk
    string?        BasePath,
    // S3
    string?        AwsAccessKey,
    string?        AwsSecretKey,
    string?        AwsRegion,
    string?        AwsBucket,
    string?        AwsEndpoint,
    // Azure
    string?        AzureConnectionString,
    string?        AzureContainerName,
    // GCS
    string?        GcsServiceAccountJson,
    string?        GcsBucket,
    // Shared
    long?          MaxFileSizeBytes,
    string?        AllowedContentTypes);

public sealed record UpdateStorageConfigRequest(
    string         Name,
    StorageDriver  Driver,
    bool           IsActive,
    string?        BasePath,
    string?        AwsAccessKey,
    string?        AwsSecretKey,     // "***..." = keep existing
    string?        AwsRegion,
    string?        AwsBucket,
    string?        AwsEndpoint,
    string?        AzureConnectionString,  // "***..." = keep existing
    string?        AzureContainerName,
    string?        GcsServiceAccountJson,  // "***..." = keep existing
    string?        GcsBucket,
    long?          MaxFileSizeBytes,
    string?        AllowedContentTypes);

// ── Test Connection ──────────────────────────────────────────────────────────

public sealed record TestConnectionResult(bool Success, string Message, long? LatencyMs);

// ── Credential Masking Helper ────────────────────────────────────────────────

public static class CredentialMask
{
    private const string MaskPrefix = "***";

    /// <summary>
    /// Masks a sensitive value for API responses. Returns <c>***</c> + last 4 chars,
    /// or <c>****</c> if the value is shorter than 4 characters.
    /// </summary>
    public static string? Mask(string? value)
    {
        if (string.IsNullOrEmpty(value)) return null;
        return value.Length <= 4
            ? "****"
            : $"{MaskPrefix}{value[^4..]}";
    }

    /// <summary>True when the submitted value is a mask placeholder, meaning "keep existing".</summary>
    public static bool IsMasked(string? value) =>
        value is not null && value.StartsWith(MaskPrefix);

    /// <summary>
    /// Returns the new value to store: if the submitted value is masked, keeps
    /// the existing DB value; otherwise uses the submitted value.
    /// </summary>
    public static string? Resolve(string? submitted, string? existing) =>
        IsMasked(submitted) ? existing : submitted;
}
