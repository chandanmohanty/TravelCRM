using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Infrastructure.FileStorage;

/// <summary>
/// Per-request factory that resolves the correct <see cref="IFileStorage"/>
/// implementation by reading the active <see cref="StorageConfiguration"/>
/// from the database. Fallback chain: tenant active config → platform active
/// config → appsettings defaults (local disk).
/// </summary>
public sealed class FileStorageResolver(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    IOptions<FileStorageOptions> fallbackOptions,
    IWebHostEnvironment env,
    ILoggerFactory loggerFactory)
{
    /// <summary>
    /// Returns the <see cref="IFileStorage"/> implementation matching the
    /// active storage configuration for the current request's tenant/scope.
    /// </summary>
    public IFileStorage Resolve()
    {
        StorageConfiguration? config = null;

        // 1. Try tenant-specific active config
        if (tenantContext.TenantId.HasValue)
        {
            config = db.StorageConfigurations
                .AsNoTracking()
                .FirstOrDefault(c => c.TenantId == tenantContext.TenantId && c.IsActive);
        }

        // 2. Fallback to platform-scoped active config
        config ??= db.StorageConfigurations
            .AsNoTracking()
            .FirstOrDefault(c => c.TenantId == null && c.IsActive);

        // 3. Fallback to appsettings defaults (local disk)
        if (config is null)
        {
            return new LocalDiskFileStorage(
                env,
                fallbackOptions,
                loggerFactory.CreateLogger<LocalDiskFileStorage>());
        }

        return CreateFromConfig(config);
    }

    /// <summary>
    /// Creates an <see cref="IFileStorage"/> instance from a specific
    /// <see cref="StorageConfiguration"/> row. Used by both <see cref="Resolve"/>
    /// and the test-connection flow (which tests a config that may not be active).
    /// </summary>
    public IFileStorage CreateFromConfig(StorageConfiguration config)
    {
        return config.Driver switch
        {
            StorageDriver.LocalDisk => new LocalDiskFileStorage(
                env,
                Options.Create(new FileStorageOptions
                {
                    BasePath = config.BasePath ?? "uploads",
                    MaxFileSizeBytes = config.MaxFileSizeBytes,
                    AllowedContentTypes = config.AllowedContentTypes
                        ?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                        ?? fallbackOptions.Value.AllowedContentTypes
                }),
                loggerFactory.CreateLogger<LocalDiskFileStorage>()),

            StorageDriver.AmazonS3 => new S3FileStorage(
                config,
                loggerFactory.CreateLogger<S3FileStorage>()),

            StorageDriver.AzureBlob =>
                throw new NotSupportedException(
                    "Azure Blob Storage is configured but not yet implemented. " +
                    "The configuration has been saved — implementation is coming soon."),

            StorageDriver.GoogleCloudStorage =>
                throw new NotSupportedException(
                    "Google Cloud Storage is configured but not yet implemented. " +
                    "The configuration has been saved — implementation is coming soon."),

            _ => throw new InvalidOperationException($"Unknown storage driver: {config.Driver}")
        };
    }
}
