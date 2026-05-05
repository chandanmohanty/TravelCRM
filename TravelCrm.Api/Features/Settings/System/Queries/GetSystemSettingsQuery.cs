using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Settings.System.DTOs;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Settings.System.Queries;

public sealed record GetSystemSettingsQuery : IRequest<Result<SystemSettingsDto>>;

public sealed class GetSystemSettingsQueryHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext)
    : IRequestHandler<GetSystemSettingsQuery, Result<SystemSettingsDto>>
{
    public async Task<Result<SystemSettingsDto>> Handle(GetSystemSettingsQuery q, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure<SystemSettingsDto>("Tenant context not resolved.");

        var row = await db.SystemSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == tenantId, ct);

        // Lazy: return defaults if the tenant hasn't saved once yet.
        row ??= new SystemSettings { TenantId = tenantId.Value };

        return Result.Success(new SystemSettingsDto(
            row.DateFormat, row.TimeFormat, row.DefaultTimeZone, row.DefaultCurrencyCode,
            row.FiscalYearStartMonth, row.FiscalYearStartDay));
    }
}
