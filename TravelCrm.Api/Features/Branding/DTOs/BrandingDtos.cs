namespace TravelCrm.Api.Features.Branding.DTOs;

/// <summary>
/// Resolved brand payload returned to the frontend. Each field has already passed
/// through the tenant → platform → hardcoded fallback chain, and <see cref="Source"/>
/// tells the caller which tier won — useful for UI badges and debugging.
/// </summary>
public sealed record BrandResolvedDto(
    string  DisplayName,
    string? LogoLightUrl,
    string? LogoDarkUrl,
    string? FaviconUrl,
    string  PrimaryColorHex,
    string? SupportEmail,
    string? SupportUrl,
    BrandSource Source);

public enum BrandSource
{
    Hardcoded = 0,
    Platform  = 1,
    Tenant    = 2
}

/// <summary>
/// Raw brand settings record exposed by the tenant/platform CRUD endpoints.
/// All fields are nullable: null means "not set, inherit next tier down".
/// </summary>
public sealed record BrandSettingsDto(
    Guid     Id,
    Guid?    TenantId,
    string?  DisplayName,
    string?  LogoLightUrl,
    string?  LogoDarkUrl,
    string?  FaviconUrl,
    string?  PrimaryColorHex,
    string?  SupportEmail,
    string?  SupportUrl,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

/// <summary>
/// Request body for <c>PUT /api/tenant/branding</c> and <c>PUT /api/platform/branding</c>.
/// URL fields are NOT in this body — those are set by the asset upload endpoint.
/// </summary>
public sealed record UpdateBrandSettingsRequest(
    string? DisplayName,
    string? PrimaryColorHex,
    string? SupportEmail,
    string? SupportUrl);

/// <summary>Asset kinds the upload endpoint accepts.</summary>
public enum BrandAssetKind
{
    LogoLight = 0,
    LogoDark  = 1,
    Favicon   = 2
}

/// <summary>Response for a successful asset upload.</summary>
public sealed record BrandAssetUploadResponse(BrandAssetKind AssetKind, string Url);
