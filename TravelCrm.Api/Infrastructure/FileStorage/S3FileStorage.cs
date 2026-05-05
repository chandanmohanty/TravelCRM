using Amazon;
using Amazon.S3;
using Amazon.S3.Model;
using TravelCrm.Api.Domain.Entities;

namespace TravelCrm.Api.Infrastructure.FileStorage;

/// <summary>
/// <see cref="IFileStorage"/> implementation backed by Amazon S3 or any
/// S3-compatible service (MinIO, DigitalOcean Spaces, etc.).
/// Constructed per-request by <see cref="FileStorageResolver"/> using credentials
/// from the active <see cref="StorageConfiguration"/> row.
/// </summary>
public sealed class S3FileStorage : IFileStorage, IDisposable
{
    private readonly IAmazonS3 _client;
    private readonly string _bucket;
    private readonly string? _customEndpoint;
    private readonly string _region;
    private readonly FileStorageOptions _opts;
    private readonly ILogger<S3FileStorage> _logger;

    public S3FileStorage(StorageConfiguration config, ILogger<S3FileStorage> logger)
    {
        _logger = logger;
        _region = config.AwsRegion ?? "us-east-1";
        _bucket = config.AwsBucket
            ?? throw new InvalidOperationException("S3 bucket name is required.");
        _customEndpoint = config.AwsEndpoint;

        var s3Config = new AmazonS3Config
        {
            RegionEndpoint = RegionEndpoint.GetBySystemName(_region),
        };

        // Support S3-compatible endpoints (MinIO, DigitalOcean Spaces, etc.)
        if (!string.IsNullOrWhiteSpace(_customEndpoint))
        {
            s3Config.ServiceURL = _customEndpoint;
            s3Config.ForcePathStyle = true;
        }

        _client = new AmazonS3Client(
            config.AwsAccessKey ?? throw new InvalidOperationException("AWS access key is required."),
            config.AwsSecretKey ?? throw new InvalidOperationException("AWS secret key is required."),
            s3Config);

        _opts = new FileStorageOptions
        {
            MaxFileSizeBytes = config.MaxFileSizeBytes,
            AllowedContentTypes = config.AllowedContentTypes
                ?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                ?? ["image/png", "image/jpeg"]
        };
    }

    public async Task<string> SaveAsync(
        Stream content,
        string contentType,
        string folder,
        string fileNameStem,
        CancellationToken ct = default)
    {
        if (!_opts.AllowedContentTypes.Contains(contentType, StringComparer.OrdinalIgnoreCase))
            throw new InvalidOperationException($"Content type '{contentType}' is not allowed.");

        if (content.CanSeek && content.Length > _opts.MaxFileSizeBytes)
            throw new InvalidOperationException(
                $"File exceeds {_opts.MaxFileSizeBytes / 1024} KB limit.");

        var extension = ExtensionFor(contentType);
        var key = $"{SanitizeFolder(folder)}/{SanitizeStem(fileNameStem)}-{Guid.NewGuid():N}{extension}";

        var request = new PutObjectRequest
        {
            BucketName = _bucket,
            Key = key,
            InputStream = content,
            ContentType = contentType,
        };

        await _client.PutObjectAsync(request, ct);

        // Build the public URL
        var url = !string.IsNullOrWhiteSpace(_customEndpoint)
            ? $"{_customEndpoint.TrimEnd('/')}/{_bucket}/{key}"
            : $"https://{_bucket}.s3.{_region}.amazonaws.com/{key}";

        _logger.LogInformation("S3: Stored {Key} in bucket {Bucket}", key, _bucket);
        return url;
    }

    public async Task DeleteAsync(string relativeUrl, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(relativeUrl)) return;

        try
        {
            var key = ExtractKeyFromUrl(relativeUrl);
            if (key is null) return;

            await _client.DeleteObjectAsync(_bucket, key, ct);
            _logger.LogInformation("S3: Deleted {Key} from bucket {Bucket}", key, _bucket);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "S3: Failed to delete {Url}", relativeUrl);
        }
    }

    public bool Exists(string relativeUrl)
    {
        if (string.IsNullOrWhiteSpace(relativeUrl)) return false;
        var key = ExtractKeyFromUrl(relativeUrl);
        if (key is null) return false;

        try
        {
            // Synchronous check — GetObjectMetadataAsync blocks briefly
            _client.GetObjectMetadataAsync(_bucket, key).GetAwaiter().GetResult();
            return true;
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return false;
        }
    }

    /// <summary>Test that the bucket is accessible with the configured credentials.</summary>
    public async Task<(bool Success, string Message, long LatencyMs)> TestConnectionAsync(CancellationToken ct)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            await _client.EnsureBucketExistsAsync(_bucket);
            sw.Stop();
            return (true, $"Connected to bucket '{_bucket}' in {_region}.", sw.ElapsedMilliseconds);
        }
        catch (AmazonS3Exception ex)
        {
            sw.Stop();
            return (false, $"S3 error: {ex.Message}", sw.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            sw.Stop();
            return (false, $"Connection failed: {ex.Message}", sw.ElapsedMilliseconds);
        }
    }

    public void Dispose() => _client.Dispose();

    // ── helpers ───────────────────────────────────────────────────────

    private string? ExtractKeyFromUrl(string url)
    {
        // Handle full S3 URLs: https://bucket.s3.region.amazonaws.com/key
        // or custom endpoint: https://minio.example.com/bucket/key
        try
        {
            var uri = new Uri(url);
            var path = uri.AbsolutePath.TrimStart('/');

            if (!string.IsNullOrWhiteSpace(_customEndpoint))
            {
                // Custom endpoint: path is /bucket/key — strip the bucket prefix
                if (path.StartsWith($"{_bucket}/"))
                    return path[(_bucket.Length + 1)..];
            }

            // Standard S3: host is bucket.s3.region.amazonaws.com, path is /key
            return path;
        }
        catch
        {
            return null;
        }
    }

    private static string SanitizeFolder(string folder)
    {
        if (string.IsNullOrWhiteSpace(folder)) return "misc";
        var parts = folder.Replace('\\', '/').Split('/', StringSplitOptions.RemoveEmptyEntries);
        var clean = parts
            .Where(p => p != "." && p != "..")
            .Select(p => new string(p.Where(c => char.IsLetterOrDigit(c) || c is '-' or '_').ToArray()))
            .Where(p => !string.IsNullOrEmpty(p));
        return string.Join('/', clean);
    }

    private static string SanitizeStem(string stem)
    {
        if (string.IsNullOrWhiteSpace(stem)) return "file";
        var clean = new string(stem.Where(c => char.IsLetterOrDigit(c) || c is '-' or '_').ToArray());
        return string.IsNullOrEmpty(clean) ? "file" : clean.ToLowerInvariant();
    }

    private static string ExtensionFor(string contentType) => contentType.ToLowerInvariant() switch
    {
        "image/png"                => ".png",
        "image/jpeg"               => ".jpg",
        "image/svg+xml"            => ".svg",
        "image/webp"               => ".webp",
        "image/x-icon"             => ".ico",
        "image/vnd.microsoft.icon" => ".ico",
        _                          => ".bin"
    };
}
