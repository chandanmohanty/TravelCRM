using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.Pipelines.Queries;

public sealed record GetPipelineQuery(Guid Id) : IRequest<Result<PipelineDto>>;

public sealed class GetPipelineHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<GetPipelineQuery, Result<PipelineDto>>
{
    public async Task<Result<PipelineDto>> Handle(GetPipelineQuery q, CancellationToken ct)
    {
        if (!user.HasPermission("crm.deals.view"))
            return Result.Failure<PipelineDto>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<PipelineDto>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;

        var p = await db.Pipelines
            .Where(x => x.Id == q.Id && x.TenantId == tid)
            .Include(x => x.Stages)
            .AsNoTracking()
            .FirstOrDefaultAsync(ct);
        if (p is null) return Result.Failure<PipelineDto>("Pipeline not found");

        var pipelineCount = await db.Deals.CountAsync(
            d => d.TenantId == tid && d.PipelineId == p.Id && !d.IsDeleted, ct);

        var stageCounts = await db.Deals
            .Where(d => d.TenantId == tid && d.PipelineId == p.Id && !d.IsDeleted)
            .GroupBy(d => d.StageId)
            .Select(g => new { StageId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.StageId, x => x.Count, ct);

        var dto = new PipelineDto(
            p.Id, p.Name, p.Description, p.IsDefault, p.IsActive, p.SortOrder,
            pipelineCount,
            p.Stages.OrderBy(s => s.SortOrder).Select(s => new PipelineStageDto(
                s.Id, s.PipelineId, s.Name, s.SortOrder, s.DefaultProbability,
                s.Kind.ToString(), s.ColorHex, s.IsActive,
                stageCounts.GetValueOrDefault(s.Id, 0)
            )).ToList()
        );
        return Result.Success(dto);
    }
}
