using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Platform.DTOs;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Platform.Queries;

public sealed record GetTenantsQuery(
    int    Page        = 1,
    int    PageSize    = 20,
    string Search      = "",
    string PlanFilter  = "",
    bool?  ActiveOnly  = null)
    : IRequest<PaginatedResponse<TenantDto>>;

public sealed class GetTenantsQueryHandler(ApplicationDbContext db)
    : IRequestHandler<GetTenantsQuery, PaginatedResponse<TenantDto>>
{
    public async Task<PaginatedResponse<TenantDto>> Handle(
        GetTenantsQuery q, CancellationToken ct)
    {
        var query = db.Tenants.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(q.Search))
            query = query.Where(t =>
                t.Name.ToLower().Contains(q.Search.ToLower()) ||
                t.Slug.ToLower().Contains(q.Search.ToLower()));

        if (!string.IsNullOrWhiteSpace(q.PlanFilter))
            query = query.Where(t => t.Plan == q.PlanFilter);

        if (q.ActiveOnly.HasValue)
            query = query.Where(t => t.IsActive == q.ActiveOnly.Value);

        var total = await query.CountAsync(ct);

        // Get user counts per tenant in a single query
        var tenantIds = await query
            .OrderByDescending(t => t.CreatedAt)
            .Skip((q.Page - 1) * q.PageSize)
            .Take(q.PageSize)
            .Select(t => t.Id)
            .ToListAsync(ct);

        var userCounts = await db.Users
            .Where(u => u.TenantId != null && tenantIds.Contains(u.TenantId!.Value) && !u.IsDeleted)
            .GroupBy(u => u.TenantId!.Value)
            .Select(g => new { TenantId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.TenantId, x => x.Count, ct);

        var tenants = await db.Tenants
            .AsNoTracking()
            .Where(t => tenantIds.Contains(t.Id))
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync(ct);

        var items = tenants.Select(t => new TenantDto(
            t.Id, t.Name, t.Slug, t.Plan, t.IsActive,
            userCounts.GetValueOrDefault(t.Id, 0),
            t.CreatedAt)).ToList();

        return new PaginatedResponse<TenantDto>
        {
            Items      = items,
            TotalCount = total,
            Page       = q.Page,
            PageSize   = q.PageSize,
            TotalPages = (int)Math.Ceiling(total / (double)q.PageSize)
        };
    }
}
