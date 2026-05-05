using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Features.Platform.DTOs;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Platform.Queries;

public sealed record GetPlatformStatsQuery : IRequest<PlatformStatsDto>;

public sealed class GetPlatformStatsQueryHandler(ApplicationDbContext db)
    : IRequestHandler<GetPlatformStatsQuery, PlatformStatsDto>
{
    public async Task<PlatformStatsDto> Handle(GetPlatformStatsQuery _, CancellationToken ct)
    {
        var totalTenants  = await db.Tenants.CountAsync(ct);
        var activeTenants = await db.Tenants.CountAsync(t => t.IsActive, ct);

        var totalUsers   = await db.Users.CountAsync(u => !u.IsDeleted && u.TenantId != null, ct);
        var activeUsers  = await db.Users.CountAsync(u => !u.IsDeleted && u.TenantId != null
                                                          && u.Status == UserStatus.Active, ct);
        var platformAdmins = await db.Users.CountAsync(u => u.IsPlatformAdmin && !u.IsDeleted, ct);

        var byPlan = await db.Tenants
            .GroupBy(t => t.Plan)
            .Select(g => new { Plan = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        return new PlatformStatsDto(
            TotalTenants:  totalTenants,
            ActiveTenants: activeTenants,
            TotalUsers:    totalUsers,
            ActiveUsers:   activeUsers,
            PlatformAdmins: platformAdmins,
            UsersByPlan:   byPlan.ToDictionary(x => x.Plan, x => x.Count));
    }
}
