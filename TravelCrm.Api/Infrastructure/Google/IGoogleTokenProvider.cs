namespace TravelCrm.Api.Infrastructure.Google;

/// <summary>
/// Thin wrapper around the Google OAuth flow so callers (controllers, jobs)
/// can be tested without hitting the network. All four methods are pure
/// indirection over <see cref="Google.Apis.Auth.OAuth2.Flows.GoogleAuthorizationCodeFlow"/>
/// plus an in-memory access-token cache.
/// </summary>
public interface IGoogleTokenProvider
{
    /// <summary>Exchange an auth code for tokens; returns the refresh token + granted scopes.</summary>
    Task<(string refreshToken, string scopes)> ExchangeCodeAsync(string code, CancellationToken ct);

    /// <summary>Mint (or return cached) access token for a tenant from its stored refresh token.</summary>
    Task<string> GetAccessTokenAsync(Guid tenantId, string refreshToken, CancellationToken ct);

    /// <summary>Build the consent URL with the given opaque state.</summary>
    string BuildAuthUrl(string state);

    /// <summary>Best-effort Google token revocation.</summary>
    Task RevokeAsync(string refreshToken, CancellationToken ct);
}
