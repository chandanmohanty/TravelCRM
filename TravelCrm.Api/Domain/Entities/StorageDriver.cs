namespace TravelCrm.Api.Domain.Entities;

/// <summary>
/// Supported file storage backends. Each value maps to a specific
/// <see cref="Infrastructure.FileStorage.IFileStorage"/> implementation.
/// </summary>
public enum StorageDriver
{
    /// <summary>Local disk under wwwroot. Already implemented.</summary>
    LocalDisk = 0,

    /// <summary>Amazon S3 (or S3-compatible like MinIO, DigitalOcean Spaces).</summary>
    AmazonS3 = 1,

    /// <summary>Azure Blob Storage.</summary>
    AzureBlob = 2,

    /// <summary>Google Cloud Storage.</summary>
    GoogleCloudStorage = 3
}
