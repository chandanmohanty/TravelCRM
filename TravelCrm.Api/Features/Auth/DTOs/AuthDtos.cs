namespace TravelCrm.Api.Features.Auth.DTOs;

public sealed record LoginRequest(string Email, string Password);

public sealed record LoginResponse(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAt,
    string UserId,
    string Email,
    string FullName,
    string[] Roles,
    string TenantId,
    string TenantSlug,
    bool IsPlatformAdmin,
    string PreferredLanguage,
    string TimeZone,
    string CurrencyCode);

public sealed record RefreshRequest(string RefreshToken);
