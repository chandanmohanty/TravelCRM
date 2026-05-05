using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Identity.DTOs;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Identity.Queries;

public sealed record ListDepartmentsQuery : IRequest<Result<List<DepartmentDto>>>;

public sealed class ListDepartmentsQueryHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext)
    : IRequestHandler<ListDepartmentsQuery, Result<List<DepartmentDto>>>
{
    public async Task<Result<List<DepartmentDto>>> Handle(
        ListDepartmentsQuery query, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure<List<DepartmentDto>>("Tenant context not resolved.");

        var depts = await db.Departments
            .AsNoTracking()
            .Where(d => d.TenantId == tenantId)
            .OrderBy(d => d.Name)
            .ToListAsync(ct);

        var mgrIds = depts.Where(d => d.ManagerId.HasValue).Select(d => d.ManagerId!.Value).Distinct().ToList();
        var mgrMap = await db.Users
            .Where(u => mgrIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.FullName, ct);

        var userCounts = await db.Users
            .Where(u => u.TenantId == tenantId && !u.IsDeleted && u.DepartmentId != null)
            .GroupBy(u => u.DepartmentId!.Value)
            .Select(g => new { DepartmentId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.DepartmentId, x => x.Count, ct);

        var dtos = depts.Select(d => new DepartmentDto(
            d.Id, d.TenantId, d.Name, d.Description,
            d.ManagerId,
            d.ManagerId is Guid m && mgrMap.TryGetValue(m, out var mn) ? mn : null,
            userCounts.GetValueOrDefault(d.Id),
            d.CreatedAt)).ToList();

        return Result.Success(dtos);
    }
}
