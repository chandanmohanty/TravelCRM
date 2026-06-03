using Google.Apis.Auth.OAuth2;
using Google.Apis.Auth.OAuth2.Flows;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace TravelCrm.Api.Infrastructure.Google;

/// <summary>
/// Default <see cref="IGoogleTokenProvider"/> implementation. Builds a
/// <see cref="GoogleAuthorizationCodeFlow"/> on demand (one per call — flows are
/// cheap and stateless given the in-memory default DataStore), caches access
/// tokens per tenant for slightly less than their lifetime, and revokes
/// best-effort via the public oauth2.googleapis.com/revoke endpoint.
/// </summary>
public sealed class GoogleTokenProvider(
    IOptions<GoogleSheetsOptions> opts,
    IMemoryCache cache,
    IHttpClientFactory httpFactory,
    ILogger<GoogleTokenProvider> logger) : IGoogleTokenProvider
{
    // The SDK uses an in-memory DataStore by default — we don't pass one,
    // because refresh tokens are persisted in our own DB (LeadImportSource).
    private GoogleAuthorizationCodeFlow Flow() => new(new GoogleAuthorizationCodeFlow.Initializer
    {
        ClientSecrets = new ClientSecrets
        {
            ClientId = opts.Value.ClientId,
            ClientSecret = opts.Value.ClientSecret,
        },
        Scopes = GoogleSheetsOptions.Scopes,
    });

    public string BuildAuthUrl(string state)
    {
        var flow = Flow();
        var request = flow.CreateAuthorizationCodeRequest(opts.Value.RedirectUri);
        request.State = state;
        var url = request.Build().ToString();
        // Force a refresh token even on re-consent. The SDK already sets
        // access_type=offline, but we append both to be defensive — duplicate
        // querystring keys are tolerated by Google's consent endpoint.
        return url + (url.Contains('?') ? "&" : "?") + "prompt=consent&access_type=offline";
    }

    public async Task<(string refreshToken, string scopes)> ExchangeCodeAsync(string code, CancellationToken ct)
    {
        var flow = Flow();
        var tok = await flow.ExchangeCodeForTokenAsync(
            userId: "tenant", code, opts.Value.RedirectUri, ct);
        return (tok.RefreshToken ?? string.Empty, tok.Scope ?? string.Empty);
    }

    public async Task<string> GetAccessTokenAsync(Guid tenantId, string refreshToken, CancellationToken ct)
    {
        var key = $"goog:at:{tenantId}";
        if (cache.TryGetValue<string>(key, out var cached) && !string.IsNullOrEmpty(cached))
            return cached;

        var flow = Flow();
        var tok = await flow.RefreshTokenAsync(
            userId: tenantId.ToString(), refreshToken, ct);
        var ttl = TimeSpan.FromSeconds((tok.ExpiresInSeconds ?? 3600) - 60);
        if (ttl <= TimeSpan.Zero) ttl = TimeSpan.FromMinutes(1);
        cache.Set(key, tok.AccessToken, ttl);
        return tok.AccessToken;
    }

    public async Task RevokeAsync(string refreshToken, CancellationToken ct)
    {
        try
        {
            using var http = httpFactory.CreateClient();
            using var body = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("token", refreshToken),
            });
            using var resp = await http.PostAsync("https://oauth2.googleapis.com/revoke", body, ct);
            if (!resp.IsSuccessStatusCode)
                logger.LogWarning("Google revoke returned {Status}", (int)resp.StatusCode);
        }
        catch (Exception ex)
        {
            // Best-effort: disconnect must still proceed even if Google is down.
            logger.LogWarning(ex, "Google revoke failed");
        }
    }
}
