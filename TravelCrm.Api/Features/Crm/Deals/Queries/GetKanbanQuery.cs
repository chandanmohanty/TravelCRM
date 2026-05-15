using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.Deals.Queries;

public sealed record GetKanbanQuery(Guid? PipelineId = null) : IRequest<Result<KanbanDto>>;

public sealed class GetKanbanHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<GetKanbanQuery, Result<KanbanDto>>
{
    public async Task<Result<KanbanDto>> Handle(GetKanbanQuery q, CancellationToken ct)
    {
        if (!user.HasPermission("crm.deals.view"))
            return Result.Failure<KanbanDto>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<KanbanDto>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;

        // Pick pipeline: requested → tenant default → first active by sort
        var pipeline = q.PipelineId is Guid pid
            ? await db.Pipelines.FirstOrDefaultAsync(p => p.Id == pid && p.TenantId == tid, ct)
            : await db.Pipelines
                .Where(p => p.TenantId == tid && p.IsActive)
                .OrderByDescending(p => p.IsDefault).ThenBy(p => p.SortOrder)
                .FirstOrDefaultAsync(ct);
        if (pipeline is null) return Result.Failure<KanbanDto>("No pipeline found");

        var stages = await db.PipelineStages
            .Where(s => s.PipelineId == pipeline.Id && s.IsActive)
            .OrderBy(s => s.SortOrder)
            .AsNoTracking()
            .ToListAsync(ct);

        // Pull all deals for those stages in one query
        var stageIds = stages.Select(s => s.Id).ToList();
        var deals = await (from d in db.Deals
                           where d.TenantId == tid && !d.IsDeleted && stageIds.Contains(d.StageId)
                           orderby d.CreatedAt descending
                           select d)
                          .AsNoTracking()
                          .ToListAsync(ct);

        var ownerIds = deals.Select(d => d.OwnerUserId).Distinct().ToList();
        var owners = await db.Users
            .Where(u => ownerIds.Contains(u.Id))
            .Select(u => new { u.Id, Name = (u.FirstName + " " + u.LastName).Trim() })
            .ToDictionaryAsync(x => x.Id, x => x.Name, ct);

        var columns = stages.Select(s =>
        {
            var stageDeals = deals.Where(d => d.StageId == s.Id).ToList();
            var totalByCurrency = stageDeals
                .Where(d => d.Value.HasValue)
                .GroupBy(d => d.Currency)
                .ToDictionary(g => g.Key, g => g.Sum(d => d.Value!.Value));

            var dealDtos = stageDeals.Select(d => new DealDto(
                d.Id, d.Title, d.PipelineId, pipeline.Name, d.StageId, s.Name,
                s.Kind.ToString(), s.ColorHex,
                d.LeadId, d.ContactName, d.ContactEmail, d.ContactPhone, d.CompanyName,
                d.Value, d.Currency, d.Probability,
                d.ExpectedCloseDate, d.ActualCloseDate,
                d.OwnerUserId, owners.GetValueOrDefault(d.OwnerUserId),
                d.Tags, d.Notes, d.Status.ToString(),
                Convert.ToBase64String(d.RowVersion),
                d.CreatedAt, d.UpdatedAt,
                RecentActivity: null
            )).ToList();

            return new KanbanColumnDto(
                s.Id, s.Name, s.Kind.ToString(), s.ColorHex, s.SortOrder, s.DefaultProbability,
                dealDtos, dealDtos.Count,
                stageDeals.Where(d => d.Value.HasValue).Sum(d => d.Value!.Value),
                totalByCurrency);
        }).ToList();

        return Result.Success(new KanbanDto(pipeline.Id, pipeline.Name, columns));
    }
}
