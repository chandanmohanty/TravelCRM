using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Options;

namespace TravelCrm.Api.Infrastructure.FileStorage;

/// <summary>
/// Stores files on the local filesystem under <c>{WebRoot}/{BasePath}</c> and returns
/// public URLs relative to the site root. Suitable for single-node deployments and
/// development. Swap for an object-storage implementation in production clusters.
/// </summary>
public sealed class LocalDiskFileStorage(
    IWebHostEnvironment env,
    IOptions<FileStorageOptions> options,
    ILogger<LocalDiskFileStorage> logger) : IFileStorage
{
    private readonly FileStorageOptions _opts = options.Value;

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

        var safeFolder = SanitizeRelativePath(folder);
        var safeStem = SanitizeFileStem(fileNameStem);
        var extension = ExtensionFor(contentType);
        var fileName = $"{safeStem}-{Guid.NewGuid():N}{extension}";

        var webRoot = EnsureWebRoot();
        var absoluteFolder = Path.Combine(webRoot, _opts.BasePath, safeFolder);
        Directory.CreateDirectory(absoluteFolder);

        var absoluteFile = Path.Combine(absoluteFolder, fileName);
        await using (var fs = new FileStream(absoluteFile, FileMode.Create, FileAccess.Write, FileShare.None))
        {
            await content.CopyToAsync(fs, ct);
        }

        // Return as a site-root relative URL (forward slashes)
        var relativeUrl = $"/{_opts.BasePath}/{safeFolder}/{fileName}".Replace('\\', '/');
        logger.LogInformation("Stored file {File} ({Size} bytes)", relativeUrl, new FileInfo(absoluteFile).Length);
        return relativeUrl;
    }

    public Task DeleteAsync(string relativeUrl, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(relativeUrl)) return Task.CompletedTask;

        try
        {
            var absolute = ResolveAbsolutePath(relativeUrl);
            if (absolute is not null && File.Exists(absolute))
            {
                File.Delete(absolute);
                logger.LogInformation("Deleted file {File}", relativeUrl);
            }
        }
        catch (Exception ex)
        {
            // Deletion is best-effort: log and swallow. The new upload has already succeeded;
            // an orphan file is strictly preferable to bubbling an exception after success.
            logger.LogWarning(ex, "Failed to delete file {File}", relativeUrl);
        }

        return Task.CompletedTask;
    }

    public bool Exists(string relativeUrl)
    {
        var absolute = ResolveAbsolutePath(relativeUrl);
        return absolute is not null && File.Exists(absolute);
    }

    // ── helpers ───────────────────────────────────────────────────────

    private string EnsureWebRoot()
    {
        var root = env.WebRootPath;
        if (string.IsNullOrEmpty(root))
        {
            // WebRootPath is only set when wwwroot exists; create it if missing.
            root = Path.Combine(env.ContentRootPath, "wwwroot");
            Directory.CreateDirectory(root);
        }
        return root;
    }

    private string? ResolveAbsolutePath(string relativeUrl)
    {
        var trimmed = relativeUrl.TrimStart('/');
        // Reject anything attempting path traversal
        if (trimmed.Contains("..")) return null;

        var webRoot = EnsureWebRoot();
        var absolute = Path.GetFullPath(Path.Combine(webRoot, trimmed.Replace('/', Path.DirectorySeparatorChar)));

        // Ensure the resolved path is still under web root
        var webRootFull = Path.GetFullPath(webRoot);
        if (!absolute.StartsWith(webRootFull, StringComparison.OrdinalIgnoreCase))
            return null;

        return absolute;
    }

    private static string SanitizeRelativePath(string folder)
    {
        if (string.IsNullOrWhiteSpace(folder)) return "misc";
        var parts = folder.Replace('\\', '/').Split('/', StringSplitOptions.RemoveEmptyEntries);
        var clean = parts
            .Where(p => p != "." && p != "..")
            .Select(p => new string(p.Where(c => char.IsLetterOrDigit(c) || c is '-' or '_').ToArray()))
            .Where(p => !string.IsNullOrEmpty(p));
        return string.Join('/', clean);
    }

    private static string SanitizeFileStem(string stem)
    {
        if (string.IsNullOrWhiteSpace(stem)) return "file";
        var clean = new string(stem.Where(c => char.IsLetterOrDigit(c) || c is '-' or '_').ToArray());
        return string.IsNullOrEmpty(clean) ? "file" : clean.ToLowerInvariant();
    }

    private static string ExtensionFor(string contentType) => contentType.ToLowerInvariant() switch
    {
        "image/png"                   => ".png",
        "image/jpeg"                  => ".jpg",
        "image/svg+xml"               => ".svg",
        "image/webp"                  => ".webp",
        "image/x-icon"                => ".ico",
        "image/vnd.microsoft.icon"    => ".ico",
        _                             => ".bin"
    };
}
