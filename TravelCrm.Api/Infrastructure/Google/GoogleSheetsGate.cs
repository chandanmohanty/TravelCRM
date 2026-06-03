using Microsoft.Extensions.Options;

namespace TravelCrm.Api.Infrastructure.Google;

/// <summary>
/// Default <see cref="IGoogleSheetsGate"/> — config is considered present iff
/// ClientId, ClientSecret, and RedirectUri are all non-blank.
/// </summary>
public sealed class GoogleSheetsGate(IOptions<GoogleSheetsOptions> opts) : IGoogleSheetsGate
{
    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(opts.Value.ClientId) &&
        !string.IsNullOrWhiteSpace(opts.Value.ClientSecret) &&
        !string.IsNullOrWhiteSpace(opts.Value.RedirectUri);
}
