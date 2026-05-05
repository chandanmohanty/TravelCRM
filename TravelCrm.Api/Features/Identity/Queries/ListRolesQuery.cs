using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Identity.DTOs;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Identity.Queries;

public sealed record ListRolesQuery : IRequest<Result<List<RoleDto>>>;

public sealed class ListRolesQueryHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext)
    : IRequestHandler<ListRolesQuery, Result<List<RoleDto>>>
{
    public async Task<Result<List<RoleDto>>> Handle(ListRolesQuery query, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure<List<RoleDto>>("Tenant context not resolved.");

        var roles = await db.Roles
            .AsNoTracking()
            .Where(r => r.TenantId == tenantId)
            .OrderBy(r => r.Name)
            .ToListAsync(ct);

        var roleIds = roles.Select(r => r.Id).ToList();

        var permCounts = await db.RolePermissions
            .Where(rp => roleIds.Contains(rp.RoleId))
            .GroupBy(rp => rp.RoleId)
            .Select(g => new { RoleId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.RoleId, x => x.Count, ct);

        var userCounts = await db.UserRoles
            .Where(ur => roleIds.Contains(ur.RoleId))
            .Join(db.Users, ur => ur.UserId, u => u.Id, (ur, u) => new { ur.RoleId, u.IsDeleted })
            .Where(x => !x.IsDeleted)
            .GroupBy(x => x.RoleId)
            .Select(g => new { RoleId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.RoleId, x => x.Count, ct);

        var dtos = roles.Select(r => new RoleDto(
            r.Id, r.TenantId, r.Name!, r.Slug, r.Description, r.IsSystemRole,
            permCounts.GetValueOrDefault(r.Id),
            userCounts.GetValueOrDefault(r.Id),
            r.CreatedAt)).ToList();

        return Result.Success(dtos);
    }
}
