using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Holds.Queries;

public sealed record GetHoldQuery(Guid Id) : IRequest<Result<HoldDto>>;

public sealed class GetHoldHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<GetHoldQuery, Result<HoldDto>>
{
    public async Task<Result<HoldDto>> Handle(GetHoldQuery q, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.holds.view"))
            return Result.Failure<HoldDto>("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure<HoldDto>("Tenant not resolved");

        var hold = await db.ResourceHolds
            .AsNoTracking()
            .Include(h => h.Resource)
            .FirstOrDefaultAsync(h => h.Id == q.Id && h.TenantId == tenantContext.TenantId, ct);
        if (hold is null) return Result.Failure<HoldDto>("Hold not found");

        return Result.Success(HoldMapper.ToDto(hold, hold.Resource?.Name ?? ""));
    }
}
