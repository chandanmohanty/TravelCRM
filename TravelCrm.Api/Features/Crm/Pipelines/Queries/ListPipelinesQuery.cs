using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.Pipelines.Queries;

public sealed record ListPipelinesQuery(bool IncludeInactive = false)
    : IRequest<Result<List<PipelineDto>>>;

public sealed class ListPipelinesHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<ListPipelinesQuery, Result<List<PipelineDto>>>
{
    public async Task<Result<List<PipelineDto>>> Handle(ListPipelinesQuery q, CancellationToken ct)
    {
        if (!user.HasPermission("crm.deals.view"))
            return Result.Failure<List<PipelineDto>>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<List<PipelineDto>>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;

        var pipelines = await db.Pipelines
            .AsNoTracking()
            .Where(p => p.TenantId == tid && (q.IncludeInactive || p.IsActive))
            .OrderBy(p => p.SortOrder).ThenBy(p => p.Name)
            .Include(p => p.Stages)
            .ToListAsync(ct);

        // Deal-count per pipeline + per stage (one round-trip each)
        var pipelineCounts = await db.Deals
            .Where(d => d.TenantId == tid && !d.IsDeleted)
            .GroupBy(d => d.PipelineId)
            .Select(g => new { PipelineId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.PipelineId, x => x.Count, ct);

        var stageCounts = await db.Deals
            .Where(d => d.TenantId == tid && !d.IsDeleted)
            .GroupBy(d => d.StageId)
            .Select(g => new { StageId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.StageId, x => x.Count, ct);

        var dtos = pipelines.Select(p => new PipelineDto(
            p.Id, p.Name, p.Description, p.IsDefault, p.IsActive, p.SortOrder,
            pipelineCounts.GetValueOrDefault(p.Id, 0),
            // Admin queries return all stages incl. inactive; the kanban query filters IsActive separately.
            p.Stages.OrderBy(s => s.SortOrder).Select(s => new PipelineStageDto(
                s.Id, s.PipelineId, s.Name, s.SortOrder, s.DefaultProbability,
                s.Kind.ToString(), s.ColorHex, s.IsActive,
                stageCounts.GetValueOrDefault(s.Id, 0)
            )).ToList()
        )).ToList();

        return Result.Success(dtos);
    }
}
