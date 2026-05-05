using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Branding.DTOs;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Branding.Queries;

/// <summary>
/// Resolves the correct brand for the current caller using the fallback chain
/// <c>tenant override → platform default → hardcoded built-in</c>. Safe for any
/// authenticated user (and for platform admins, who receive the platform tier).
/// </summary>
public sealed record GetResolvedBrandQuery : IRequest<Result<BrandResolvedDto>>;

public sealed class GetResolvedBrandQueryHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext)
    : IRequestHandler<GetResolvedBrandQuery, Result<BrandResolvedDto>>
{
    // Compile-time hardcoded fallback values — the final tier of the chain.
    // LogoLightUrl etc. are null so the frontend falls back to the bundled SVG asset.
    private const string DefaultDisplayName  = "TravelCRM";
    private const string DefaultPrimaryColor = "#5D87FF";

    public async Task<Result<BrandResolvedDto>> Handle(GetResolvedBrandQuery request, CancellationToken ct)
    {
        // Load platform defaults (singleton). Cached via AsNoTracking for perf.
        var platform = await db.PlatformBrandSettings
            .AsNoTracking()
            .OrderBy(p => p.CreatedAt)
            .FirstOrDefaultAsync(ct);

        // Load tenant override if caller has a tenant context.
        var tenantId = tenantContext.TenantId;
        var tenant = tenantId.HasValue
            ? await db.TenantBrandSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.TenantId == tenantId.Value, ct)
            : null;

        // Compute each field individually using the fallback chain. Track whether
        // ANY tenant-provided field was non-null so we can correctly report Source.Tenant.
        bool anyTenantField = false;
        string? Pick(string? tenantValue, string? platformValue)
        {
            if (!string.IsNullOrWhiteSpace(tenantValue))
            {
                anyTenantField = true;
                return tenantValue;
            }
            return string.IsNullOrWhiteSpace(platformValue) ? null : platformValue;
        }

        var displayName     = Pick(tenant?.DisplayName,     platform?.DisplayName)     ?? DefaultDisplayName;
        var logoLightUrl    = Pick(tenant?.LogoLightUrl,    platform?.LogoLightUrl);
        var logoDarkUrl     = Pick(tenant?.LogoDarkUrl,     platform?.LogoDarkUrl);
        var faviconUrl      = Pick(tenant?.FaviconUrl,      platform?.FaviconUrl);
        var primaryColorHex = Pick(tenant?.PrimaryColorHex, platform?.PrimaryColorHex) ?? DefaultPrimaryColor;
        var supportEmail    = Pick(tenant?.SupportEmail,    platform?.SupportEmail);
        var supportUrl      = Pick(tenant?.SupportUrl,      platform?.SupportUrl);

        // Determine winning source: Tenant if any tenant field was used; Platform if
        // the platform row supplied any non-null value; otherwise Hardcoded.
        var source = anyTenantField
            ? BrandSource.Tenant
            : (platform is not null && (
                  platform.DisplayName is not null ||
                  platform.LogoLightUrl is not null ||
                  platform.LogoDarkUrl is not null ||
                  platform.FaviconUrl is not null ||
                  platform.PrimaryColorHex is not null ||
                  platform.SupportEmail is not null ||
                  platform.SupportUrl is not null)
                ? BrandSource.Platform
                : BrandSource.Hardcoded);

        return Result.Success(new BrandResolvedDto(
            displayName,
            logoLightUrl,
            logoDarkUrl,
            faviconUrl,
            primaryColorHex,
            supportEmail,
            supportUrl,
            source));
    }
}
