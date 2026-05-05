namespace TravelCrm.Api.Features.Settings.WhatsApp.DTOs;

/// <summary>
/// Read-only projection of a WhatsApp provider configuration.
/// The <c>ApiKey</c> field is intentionally omitted — callers learn only
/// whether a key exists via <see cref="HasApiKey"/>.
/// </summary>
public sealed record WhatsAppConfigDto(
    Guid    Id,
    Guid?   TenantId,
    string  Name,
    string  Provider,       // "Gupshup" | "Wati"
    bool    IsActive,
    bool    HasApiKey,
    string  PhoneNumber,
    string? AppName,
    string? BaseUrl,
    DateTime  CreatedAt,
    DateTime? UpdatedAt
);
