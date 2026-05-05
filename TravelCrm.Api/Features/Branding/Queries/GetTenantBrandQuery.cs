using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Branding.DTOs;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Branding.Queries;

/// <summary>
/// Raw tenant-scope brand settings record for the settings page form.
/// Returns a blank DTO (all nulls) when the tenant has never saved overrides.
/// </summary>
public sealed record GetTenantBrandQuery : IRequest<Result<BrandSettingsDto>>;

public sealed class GetTenantBrandQueryHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext)
    : IRequestHandler<GetTenantBrandQuery, Result<BrandSettingsDto>>
{
    public async Task<Result<BrandSettingsDto>> Handle(GetTenantBrandQuery request, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null)
            return Result.Failure<BrandSettingsDto>("Tenant context not resolved.");

        var row = await db.TenantBrandSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.TenantId == tenantId.Value, ct);

        if (row is null)
        {
            return Result.Success(new BrandSettingsDto(
                Id: Guid.Empty,
                TenantId: tenantId.Value,
                DisplayName: null,
                LogoLightUrl: null,
                LogoDarkUrl: null,
                FaviconUrl: null,
                PrimaryColorHex: null,
                SupportEmail: null,
                SupportUrl: null,
                CreatedAt: default,
                UpdatedAt: null));
        }

        return Result.Success(ToDto(row));
    }

    internal static BrandSettingsDto ToDto(Domain.Entities.TenantBrandSettings r) => new(
        r.Id, r.TenantId,
        r.DisplayName, r.LogoLightUrl, r.LogoDarkUrl, r.FaviconUrl,
        r.PrimaryColorHex, r.SupportEmail, r.SupportUrl,
        r.CreatedAt, r.UpdatedAt);
}
