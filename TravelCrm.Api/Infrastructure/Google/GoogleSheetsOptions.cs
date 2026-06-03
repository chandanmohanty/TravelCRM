namespace TravelCrm.Api.Infrastructure.Google;

/// <summary>
/// Platform-wide Google OAuth app config. Bound from configuration section
/// "GoogleSheets". Empty <see cref="ClientId"/> ⇒ the whole Google path is
/// dormant (IGoogleSheetsGate.IsConfigured == false) and the Excel path is
/// unaffected.
/// </summary>
public sealed class GoogleSheetsOptions
{
    public const string SectionName = "GoogleSheets";

    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string RedirectUri { get; set; } = string.Empty;

    /// <summary>Least-privilege scopes; never request write.</summary>
    public static readonly string[] Scopes =
    {
        "https://www.googleapis.com/auth/spreadsheets.readonly",
        "https://www.googleapis.com/auth/userinfo.email",
    };
}
