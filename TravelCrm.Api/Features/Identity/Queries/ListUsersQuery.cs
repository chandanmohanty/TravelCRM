using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Identity.DTOs;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Identity.Queries;

/// <summary>
/// Paginated list of users in the current tenant scope. Platform users list
/// is a separate query (<see cref="ListPlatformUsersQuery"/>) to avoid
/// mixing the two identity spaces.
/// </summary>
public sealed record ListUsersQuery(
    int     Page         = 1,
    int     PageSize     = 20,
    string? Search       = null,
    string? Status       = null,
    Guid?   RoleId       = null,
    Guid?   DepartmentId = null,
    Guid?   TeamLeaderId = null
) : IRequest<Result<PaginatedResponse<UserDto>>>;

public sealed class ListUsersQueryHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext)
    : IRequestHandler<ListUsersQuery, Result<PaginatedResponse<UserDto>>>
{
    public async Task<Result<PaginatedResponse<UserDto>>> Handle(
        ListUsersQuery query, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null)
            return Result.Failure<PaginatedResponse<UserDto>>("Tenant context not resolved.");

        // Start tenant-scoped and non-deleted only
        var q = db.Users
            .AsNoTracking()
            .Where(u => u.TenantId == tenantId && !u.IsDeleted);

        // Filters
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var s = query.Search.Trim().ToLowerInvariant();
            q = q.Where(u =>
                u.Email!.ToLower().Contains(s) ||
                u.FirstName.ToLower().Contains(s) ||
                u.LastName.ToLower().Contains(s) ||
                (u.EmployeeId != null && u.EmployeeId.ToLower().Contains(s)));
        }

        if (!string.IsNullOrWhiteSpace(query.Status) &&
            Enum.TryParse<Infrastructure.Identity.UserStatus>(query.Status, ignoreCase: true, out var st))
        {
            q = q.Where(u => u.Status == st);
        }

        if (query.DepartmentId is Guid did)
            q = q.Where(u => u.DepartmentId == did);

        if (query.TeamLeaderId is Guid tlid)
            q = q.Where(u => u.TeamLeaderId == tlid);

        if (query.RoleId is Guid rid)
        {
            var userIdsWithRole = db.UserRoles
                .Where(ur => ur.RoleId == rid)
                .Select(ur => ur.UserId);
            q = q.Where(u => userIdsWithRole.Contains(u.Id));
        }

        var total = await q.CountAsync(ct);

        var page     = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 200);

        var users = await q
            .OrderByDescending(u => u.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        // Resolve role + department lookups for the returned page in one extra roundtrip each
        var userIds = users.Select(u => u.Id).ToList();
        var deptIds = users.Where(u => u.DepartmentId.HasValue).Select(u => u.DepartmentId!.Value).Distinct().ToList();
        var tlIds   = users.Where(u => u.TeamLeaderId.HasValue).Select(u => u.TeamLeaderId!.Value).Distinct().ToList();

        var roleMap = await db.UserRoles
            .Where(ur => userIds.Contains(ur.UserId))
            .Join(db.Roles, ur => ur.RoleId, r => r.Id,
                (ur, r) => new { ur.UserId, Role = new UserRoleRef(r.Id, r.Name!, r.Slug) })
            .GroupBy(x => x.UserId)
            .ToDictionaryAsync(g => g.Key, g => g.Select(x => x.Role).ToList(), ct);

        var deptMap = await db.Departments
            .Where(d => deptIds.Contains(d.Id))
            .ToDictionaryAsync(d => d.Id, d => d.Name, ct);

        var tlMap = await db.Users
            .Where(u => tlIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.FullName, ct);

        var dtos = users.Select(u => ToDto(u, roleMap, deptMap, tlMap)).ToList();

        return Result.Success(new PaginatedResponse<UserDto>
        {
            Items      = dtos,
            Page       = page,
            PageSize   = pageSize,
            TotalCount = total,
            TotalPages = (int)Math.Ceiling(total / (double)pageSize)
        });
    }

    internal static UserDto ToDto(
        Infrastructure.Identity.ApplicationUser u,
        IReadOnlyDictionary<Guid, List<UserRoleRef>> roleMap,
        IReadOnlyDictionary<Guid, string> deptMap,
        IReadOnlyDictionary<Guid, string> tlMap)
        => new(
            u.Id, u.TenantId, u.EmployeeId,
            u.Email ?? string.Empty,
            u.FirstName, u.LastName, u.FullName,
            u.PhoneNumber, u.AvatarUrl, u.JobTitle,
            u.DepartmentId,
            u.DepartmentId is Guid d && deptMap.TryGetValue(d, out var dn) ? dn : null,
            u.TeamLeaderId,
            u.TeamLeaderId is Guid t && tlMap.TryGetValue(t, out var tn) ? tn : null,
            u.Status.ToString(),
            u.IsPlatformAdmin,
            roleMap.TryGetValue(u.Id, out var rs) ? rs : new List<UserRoleRef>(),
            u.PreferredLanguage, u.TimeZone, u.CurrencyCode,
            u.CreatedAt, u.UpdatedAt, u.LastLoginAt);
}
