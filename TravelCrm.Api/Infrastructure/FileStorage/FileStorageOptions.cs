namespace TravelCrm.Api.Infrastructure.FileStorage;

/// <summary>
/// Configurable limits and allow-list for <see cref="IFileStorage"/> implementations.
/// Bound from configuration section <c>FileStorage</c> in <c>appsettings.json</c>.
/// </summary>
public sealed class FileStorageOptions
{
    /// <summary>
    /// Physical root for file uploads, relative to the web root. Default: "uploads".
    /// Resolved to <c>{ContentRoot}/wwwroot/{BasePath}</c> at runtime.
    /// </summary>
    public string BasePath { get; set; } = "uploads";

    /// <summary>Hard upper bound per uploaded file in bytes. Default: 5 MB.</summary>
    public long MaxFileSizeBytes { get; set; } = 5 * 1024 * 1024;

    /// <summary>
    /// MIME types accepted by <see cref="IFileStorage.SaveAsync"/>. Anything else is rejected.
    /// </summary>
    public string[] AllowedContentTypes { get; set; } =
    [
        "image/png",
        "image/jpeg",
        "image/svg+xml",
        "image/webp",
        "image/x-icon",
        "image/vnd.microsoft.icon"
    ];
}
