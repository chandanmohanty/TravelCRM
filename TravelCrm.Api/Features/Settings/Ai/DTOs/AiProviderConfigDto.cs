namespace TravelCrm.Api.Features.Settings.Ai.DTOs;

/// <summary>
/// Response shape for AI-provider config reads. The <c>ApiKey</c> field is
/// masked — the real value never leaves the server.
/// </summary>
public sealed record AiProviderConfigDto(
    Guid    Id,
    Guid?   TenantId,
    string  Name,
    string  Provider,
    string  Model,
    bool    IsActive,
    bool    HasApiKey,
    string? BaseUrl,
    double? Temperature,
    int?    MaxTokens,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);
