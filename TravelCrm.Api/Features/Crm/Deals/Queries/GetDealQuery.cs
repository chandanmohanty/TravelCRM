using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.Deals.Queries;

public sealed record GetDealQuery(Guid Id, int RecentActivityLimit = 50) : IRequest<Result<DealDto>>;

public sealed class GetDealHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<GetDealQuery, Result<DealDto>>
{
    public async Task<Result<DealDto>> Handle(GetDealQuery q, CancellationToken ct)
    {
        if (!user.HasPermission("crm.deals.view"))
            return Result.Failure<DealDto>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<DealDto>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;

        var row = await (from d in db.Deals
                         where d.Id == q.Id && d.TenantId == tid && !d.IsDeleted
                         join p in db.Pipelines on d.PipelineId equals p.Id
                         join s in db.PipelineStages on d.StageId equals s.Id
                         select new { d, pName = p.Name, sName = s.Name, sKind = s.Kind, sColor = s.ColorHex })
                        .AsNoTracking()
                        .FirstOrDefaultAsync(ct);
        if (row is null) return Result.Failure<DealDto>("Deal not found");

        var owner = await db.Users
            .Where(u => u.Id == row.d.OwnerUserId)
            .Select(u => (u.FirstName + " " + u.LastName).Trim())
            .FirstOrDefaultAsync(ct);

        var activity = await db.DealActivities
            .Where(a => a.DealId == row.d.Id && a.TenantId == tid)
            .OrderByDescending(a => a.OccurredAt)
            .Take(q.RecentActivityLimit)
            .Select(a => new DealActivityDto(
                a.Id, a.OccurredAt, a.ActorUserId, a.ActorName,
                a.Kind.ToString(), a.FromValue, a.ToValue, a.Note))
            .AsNoTracking()
            .ToListAsync(ct);

        return Result.Success(new DealDto(
            row.d.Id, row.d.Title, row.d.PipelineId, row.pName, row.d.StageId, row.sName,
            row.sKind.ToString(), row.sColor,
            row.d.LeadId, row.d.ContactName, row.d.ContactEmail, row.d.ContactPhone, row.d.CompanyName,
            row.d.Value, row.d.Currency, row.d.Probability,
            row.d.ExpectedCloseDate, row.d.ActualCloseDate,
            row.d.OwnerUserId, owner,
            row.d.Tags, row.d.Notes, row.d.Status.ToString(),
            Convert.ToBase64String(row.d.RowVersion),
            row.d.CreatedAt, row.d.UpdatedAt,
            activity
        ));
    }
}
