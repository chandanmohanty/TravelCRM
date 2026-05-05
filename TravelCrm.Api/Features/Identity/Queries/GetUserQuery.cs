using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Identity.DTOs;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Identity.Queries;

public sealed record GetUserQuery(Guid Id) : IRequest<Result<UserDto>>;

public sealed class GetUserQueryHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext)
    : IRequestHandler<GetUserQuery, Result<UserDto>>
{
    public async Task<Result<UserDto>> Handle(GetUserQuery query, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null)
            return Result.Failure<UserDto>("Tenant context not resolved.");

        var user = await db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u =>
                u.Id == query.Id && u.TenantId == tenantId && !u.IsDeleted, ct);
        if (user is null)
            return Result.Failure<UserDto>("User not found.");

        var roleMap = await db.UserRoles
            .Where(ur => ur.UserId == user.Id)
            .Join(db.Roles, ur => ur.RoleId, r => r.Id,
                (_, r) => new UserRoleRef(r.Id, r.Name!, r.Slug))
            .ToListAsync(ct);

        var deptName = user.DepartmentId is Guid d
            ? await db.Departments.Where(x => x.Id == d).Select(x => x.Name).FirstOrDefaultAsync(ct)
            : null;

        var tlName = user.TeamLeaderId is Guid t
            ? await db.Users.Where(x => x.Id == t).Select(x => x.FirstName + " " + x.LastName).FirstOrDefaultAsync(ct)
            : null;

        return Result.Success(new UserDto(
            user.Id, user.TenantId, user.EmployeeId,
            user.Email ?? string.Empty,
            user.FirstName, user.LastName, user.FullName,
            user.PhoneNumber, user.AvatarUrl, user.JobTitle,
            user.DepartmentId, deptName,
            user.TeamLeaderId, tlName,
            user.Status.ToString(),
            user.IsPlatformAdmin,
            roleMap,
            user.PreferredLanguage, user.TimeZone, user.CurrencyCode,
            user.CreatedAt, user.UpdatedAt, user.LastLoginAt));
    }
}
