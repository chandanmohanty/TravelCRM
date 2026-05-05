using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Identity.DTOs;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Identity.Queries;

/// <summary>
/// Returns the global permission catalog, sorted for UI grouping
/// (Module → Submodule → SortOrder). Read-only — the catalog is seeded at
/// startup and never mutated at runtime.
/// </summary>
public sealed record ListPermissionsQuery : IRequest<Result<List<PermissionDto>>>;

public sealed class ListPermissionsQueryHandler(ApplicationDbContext db)
    : IRequestHandler<ListPermissionsQuery, Result<List<PermissionDto>>>
{
    public async Task<Result<List<PermissionDto>>> Handle(
        ListPermissionsQuery query, CancellationToken ct)
    {
        var rows = await db.Permissions
            .AsNoTracking()
            .Where(p => p.TenantId == null)   // global catalog only
            .OrderBy(p => p.Module)
            .ThenBy(p => p.Submodule)
            .ThenBy(p => p.SortOrder)
            .Select(p => new PermissionDto(
                p.Id, p.Slug, p.Name, p.Module, p.Submodule, p.Action, p.Description, p.SortOrder))
            .ToListAsync(ct);

        return Result.Success(rows);
    }
}
