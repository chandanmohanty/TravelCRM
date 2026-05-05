namespace TravelCrm.Api.Infrastructure.FileStorage;

/// <summary>
/// Abstraction over binary asset storage. The default implementation writes files
/// to local disk under <c>wwwroot/{BasePath}</c>; a cloud implementation
/// (S3, Azure Blob, …) can be swapped in without changing callers.
/// </summary>
public interface IFileStorage
{
    /// <summary>
    /// Persist a stream and return the public relative URL at which it can be served
    /// (e.g. <c>/uploads/branding/t-.../logo-light-abc.png</c>).
    /// </summary>
    /// <param name="content">File bytes. Stream position should be at 0.</param>
    /// <param name="contentType">MIME type; must be in <see cref="FileStorageOptions.AllowedContentTypes"/>.</param>
    /// <param name="folder">
    /// Sub-folder beneath the base path (e.g. <c>branding/t-&lt;tenantId&gt;</c>).
    /// Forward slashes only; must not contain <c>..</c>.
    /// </param>
    /// <param name="fileNameStem">
    /// Base name for the stored file (no extension). A short uniqueness suffix will be
    /// appended to prevent cache collisions.
    /// </param>
    Task<string> SaveAsync(
        Stream content,
        string contentType,
        string folder,
        string fileNameStem,
        CancellationToken ct = default);

    /// <summary>Delete a previously stored file by its relative URL. Missing files are ignored.</summary>
    Task DeleteAsync(string relativeUrl, CancellationToken ct = default);

    /// <summary>True when the relative URL refers to an existing on-disk file.</summary>
    bool Exists(string relativeUrl);
}
