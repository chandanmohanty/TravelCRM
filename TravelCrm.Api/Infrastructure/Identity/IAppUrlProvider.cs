namespace TravelCrm.Api.Infrastructure.Identity;

/// <summary>
/// Returns the public base URL of the Angular SPA. Used to build absolute
/// links in outbound emails (invite / password reset). Configured via
/// <c>App:PublicUrl</c> in appsettings (e.g. <c>https://app.travelcrm.io</c>).
/// Falls back to <c>http://localhost:4201</c> for local development.
/// </summary>
public interface IAppUrlProvider
{
    string PublicUrl { get; }
}

public sealed class ConfigAppUrlProvider(IConfiguration config) : IAppUrlProvider
{
    public string PublicUrl =>
        config["App:PublicUrl"] is string s && !string.IsNullOrWhiteSpace(s)
            ? s
            : "http://localhost:4201";
}
