using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.TenantSettingsFeature.Queries;

public sealed record TenantSettingsDto(int HoldTtlHours);

public sealed record GetTenantSettingsQuery() : IRequest<Result<TenantSettingsDto>>;

public sealed class GetTenantSettingsHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<GetTenantSettingsQuery, Result<TenantSettingsDto>>
{
    public async Task<Result<TenantSettingsDto>> Handle(GetTenantSettingsQuery q, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.tenant_settings.manage"))
            return Result.Failure<TenantSettingsDto>("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure<TenantSettingsDto>("Tenant not resolved");

        var row = await db.TenantSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == tenantContext.TenantId, ct);

        // Default values surface even when no row exists yet — matches the
        // ?? 24 fallback in CreateHoldCommand / ExtendHoldCommand.
        var ttl = row?.HoldTtlHours ?? 24;
        return Result.Success(new TenantSettingsDto(ttl));
    }
}
