using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Branding.DTOs;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Branding.Queries;

/// <summary>
/// Returns the platform-scope brand settings singleton for the admin form. If the
/// seeder has not yet run, returns a blank DTO so the UI can still render a usable form.
/// </summary>
public sealed record GetPlatformBrandQuery : IRequest<Result<BrandSettingsDto>>;

public sealed class GetPlatformBrandQueryHandler(ApplicationDbContext db)
    : IRequestHandler<GetPlatformBrandQuery, Result<BrandSettingsDto>>
{
    public async Task<Result<BrandSettingsDto>> Handle(GetPlatformBrandQuery request, CancellationToken ct)
    {
        var row = await db.PlatformBrandSettings
            .AsNoTracking()
            .OrderBy(p => p.CreatedAt)
            .FirstOrDefaultAsync(ct);

        if (row is null)
        {
            return Result.Success(new BrandSettingsDto(
                Id: Guid.Empty,
                TenantId: null,
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

    internal static BrandSettingsDto ToDto(Domain.Entities.PlatformBrandSettings r) => new(
        r.Id, null,
        r.DisplayName, r.LogoLightUrl, r.LogoDarkUrl, r.FaviconUrl,
        r.PrimaryColorHex, r.SupportEmail, r.SupportUrl,
        r.CreatedAt, r.UpdatedAt);
}
