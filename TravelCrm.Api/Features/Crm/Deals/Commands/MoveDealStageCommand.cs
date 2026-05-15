using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Crm;
using TravelCrm.Api.Features.Crm.Deals.Queries;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.Deals.Commands;

public sealed record MoveDealStageCommand(
    Guid Id,
    string RowVersion,
    Guid StageId,
    string? Note
) : IRequest<Result<DealDto>>;

public sealed class MoveDealStageValidator : AbstractValidator<MoveDealStageCommand>
{
    public MoveDealStageValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.StageId).NotEmpty();
        RuleFor(x => x.RowVersion).NotEmpty();
        RuleFor(x => x.Note).MaximumLength(500);
    }
}

public sealed class MoveDealStageHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<MoveDealStageCommand, Result<DealDto>>
{
    public async Task<Result<DealDto>> Handle(MoveDealStageCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.deals.manage"))
            return Result.Failure<DealDto>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<DealDto>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;
        var deal = await db.Deals.FirstOrDefaultAsync(
            d => d.Id == cmd.Id && d.TenantId == tid && !d.IsDeleted, ct);
        if (deal is null) return Result.Failure<DealDto>("Deal not found");

        // Defensive base64 parse (same pattern as UpdateDealCommand)
        byte[] clientRv;
        try { clientRv = Convert.FromBase64String(cmd.RowVersion); }
        catch (FormatException) { return Result.Failure<DealDto>("invalid_row_version"); }
        if (!clientRv.SequenceEqual(deal.RowVersion))
            return Result.Failure<DealDto>("concurrency_conflict");

        var newStage = await db.PipelineStages.FirstOrDefaultAsync(
            s => s.Id == cmd.StageId && s.TenantId == tid, ct);
        if (newStage is null) return Result.Failure<DealDto>("Stage not found");
        if (newStage.PipelineId != deal.PipelineId)
            return Result.Failure<DealDto>("Stage does not belong to this deal's pipeline");

        if (newStage.Id == deal.StageId)
            return Result.Failure<DealDto>("Deal is already on that stage");

        var oldStage = await db.PipelineStages.FirstAsync(s => s.Id == deal.StageId, ct);

        var wasClosed = deal.Status != DealStatus.Open;
        var willClose = newStage.Kind != PipelineStageKind.Open;

        deal.StageId = newStage.Id;
        deal.Status  = newStage.Kind switch
        {
            PipelineStageKind.Won  => DealStatus.Won,
            PipelineStageKind.Lost => DealStatus.Lost,
            _                      => DealStatus.Open,
        };
        // ActualCloseDate handling
        if (willClose && deal.ActualCloseDate is null)
            deal.ActualCloseDate = DateOnly.FromDateTime(DateTime.UtcNow);
        else if (!willClose)
            deal.ActualCloseDate = null;

        // Probability NOT auto-overwritten — keeps any manual override intact

        deal.UpdatedAt = DateTime.UtcNow;
        deal.UpdatedBy = user.UserId;

        db.DealActivities.Add(DealActivityLogger.StageChanged(
            tid, deal.Id, user, oldStage.Name, newStage.Name, cmd.Note));

        if (!wasClosed && willClose)
            db.DealActivities.Add(DealActivityLogger.Closed(tid, deal.Id, user, newStage.Name, cmd.Note));
        else if (wasClosed && !willClose)
            db.DealActivities.Add(DealActivityLogger.Reopened(tid, deal.Id, user, newStage.Name));

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<DealDto>("concurrency_conflict");
        }

        return await new GetDealHandler(db, tenant, user)
            .Handle(new GetDealQuery(deal.Id), ct);
    }
}
