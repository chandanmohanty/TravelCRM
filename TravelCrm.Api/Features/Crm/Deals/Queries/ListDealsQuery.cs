using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Crm;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.Deals.Queries;

public sealed record ListDealsQuery(
    Guid? PipelineId = null,
    Guid? StageId = null,
    Guid? OwnerUserId = null,
    string? Status = null,    // "Open" | "Won" | "Lost"
    bool? HasLead = null,
    Guid? LeadId = null,
    string? Search = null,
    int Page = 1,
    int PageSize = 50
) : IRequest<Result<PagedDeals>>;

public sealed record PagedDeals(IReadOnlyList<DealDto> Items, int Total);

public sealed class ListDealsHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<ListDealsQuery, Result<PagedDeals>>
{
    public async Task<Result<PagedDeals>> Handle(ListDealsQuery q, CancellationToken ct)
    {
        if (!user.HasPermission("crm.deals.view"))
            return Result.Failure<PagedDeals>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<PagedDeals>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;

        var query = db.Deals.AsNoTracking()
            .Where(d => d.TenantId == tid && !d.IsDeleted);

        if (q.PipelineId.HasValue)   query = query.Where(d => d.PipelineId == q.PipelineId.Value);
        if (q.StageId.HasValue)      query = query.Where(d => d.StageId    == q.StageId.Value);
        if (q.OwnerUserId.HasValue)  query = query.Where(d => d.OwnerUserId == q.OwnerUserId.Value);
        if (!string.IsNullOrEmpty(q.Status) && Enum.TryParse<DealStatus>(q.Status, out var st))
            query = query.Where(d => d.Status == st);
        if (q.HasLead == true)  query = query.Where(d => d.LeadId != null);
        if (q.HasLead == false) query = query.Where(d => d.LeadId == null);
        if (q.LeadId.HasValue)  query = query.Where(d => d.LeadId == q.LeadId.Value);
        if (!string.IsNullOrEmpty(q.Search))
        {
            var pattern = $"%{q.Search}%";
            query = query.Where(d =>
                EF.Functions.ILike(d.Title, pattern)
                || EF.Functions.ILike(d.ContactName, pattern)
                || (d.CompanyName != null && EF.Functions.ILike(d.CompanyName, pattern)));
        }

        var total = await query.CountAsync(ct);

        var page = Math.Max(1, q.Page);
        var size = Math.Clamp(q.PageSize, 1, 200);

        var rows = await (from d in query
                          join p in db.Pipelines on d.PipelineId equals p.Id
                          join s in db.PipelineStages on d.StageId equals s.Id
                          orderby d.CreatedAt descending
                          select new { d, pName = p.Name, sName = s.Name, sKind = s.Kind, sColor = s.ColorHex })
                         .Skip((page - 1) * size)
                         .Take(size)
                         .ToListAsync(ct);

        // Owner names — single lookup
        var ownerIds = rows.Select(r => r.d.OwnerUserId).Distinct().ToList();
        var owners = await db.Users
            .Where(u => ownerIds.Contains(u.Id))
            .Select(u => new { u.Id, Name = (u.FirstName + " " + u.LastName).Trim() })
            .ToDictionaryAsync(x => x.Id, x => x.Name, ct);

        var items = rows.Select(r => new DealDto(
            r.d.Id, r.d.Title, r.d.PipelineId, r.pName, r.d.StageId, r.sName,
            r.sKind.ToString(), r.sColor,
            r.d.LeadId, r.d.ContactName, r.d.ContactEmail, r.d.ContactPhone, r.d.CompanyName,
            r.d.Value, r.d.Currency, r.d.Probability,
            r.d.ExpectedCloseDate, r.d.ActualCloseDate,
            r.d.OwnerUserId, owners.GetValueOrDefault(r.d.OwnerUserId),
            r.d.Tags, r.d.Notes, r.d.Status.ToString(),
            Convert.ToBase64String(r.d.RowVersion),
            r.d.CreatedAt, r.d.UpdatedAt,
            RecentActivity: null
        )).ToList();

        return Result.Success(new PagedDeals(items, total));
    }
}
