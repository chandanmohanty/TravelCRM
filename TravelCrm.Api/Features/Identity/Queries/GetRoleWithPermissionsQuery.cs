using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Identity.DTOs;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Identity.Queries;

public sealed record GetRoleWithPermissionsQuery(Guid RoleId)
    : IRequest<Result<RoleWithPermissionsDto>>;

public sealed class GetRoleWithPermissionsQueryHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext)
    : IRequestHandler<GetRoleWithPermissionsQuery, Result<RoleWithPermissionsDto>>
{
    public async Task<Result<RoleWithPermissionsDto>> Handle(
        GetRoleWithPermissionsQuery query, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null)
            return Result.Failure<RoleWithPermissionsDto>("Tenant context not resolved.");

        var role = await db.Roles.AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == query.RoleId && r.TenantId == tenantId, ct);
        if (role is null)
            return Result.Failure<RoleWithPermissionsDto>("Role not found.");

        var permIds = await db.RolePermissions
            .Where(rp => rp.RoleId == role.Id)
            .Select(rp => rp.PermissionId)
            .ToListAsync(ct);

        return Result.Success(new RoleWithPermissionsDto(
            role.Id, role.TenantId, role.Name!, role.Slug, role.Description,
            role.IsSystemRole, permIds));
    }
}
