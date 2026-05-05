using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Identity.DTOs;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Identity.Queries;

/// <summary>Self-service: returns the caller's profile + roles + permissions.</summary>
public sealed record GetMyProfileQuery : IRequest<Result<MyProfileDto>>;

public sealed class GetMyProfileQueryHandler(
    ApplicationDbContext db,
    ICurrentUser currentUser)
    : IRequestHandler<GetMyProfileQuery, Result<MyProfileDto>>
{
    public async Task<Result<MyProfileDto>> Handle(GetMyProfileQuery _, CancellationToken ct)
    {
        var me = await db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == currentUser.UserId && !u.IsDeleted, ct);
        if (me is null) return Result.Failure<MyProfileDto>("User not found.");

        var roles = await db.UserRoles
            .Where(ur => ur.UserId == me.Id)
            .Join(db.Roles, ur => ur.RoleId, r => r.Id, (_, r) => r.Name!)
            .ToListAsync(ct);

        // Permissions are already on the JWT (as claims); surface them here
        // so the Angular UI can use the same set without re-decoding the token.
        var permissions = currentUser.Roles // fall back if for some reason claims were stripped
            .Count == 0 ? new List<string>() : await db.UserRoles
                .Where(ur => ur.UserId == me.Id)
                .Join(db.RolePermissions, ur => ur.RoleId, rp => rp.RoleId, (_, rp) => rp.PermissionId)
                .Distinct()
                .Join(db.Permissions, id => id, p => p.Id, (_, p) => p.Slug)
                .ToListAsync(ct);

        return Result.Success(new MyProfileDto(
            me.Id, me.Email ?? string.Empty, me.FirstName, me.LastName, me.FullName,
            me.PhoneNumber, me.AvatarUrl, me.JobTitle, me.DepartmentId,
            me.PreferredLanguage, me.TimeZone, me.CurrencyCode,
            roles, permissions));
    }
}
