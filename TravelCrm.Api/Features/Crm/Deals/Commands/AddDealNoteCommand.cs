using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Crm.Deals.Queries;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.Deals.Commands;

public sealed record AddDealNoteCommand(Guid Id, string Note) : IRequest<Result<DealActivityDto>>;

public sealed class AddDealNoteValidator : AbstractValidator<AddDealNoteCommand>
{
    public AddDealNoteValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Note).NotEmpty().MaximumLength(2000);
    }
}

public sealed class AddDealNoteHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<AddDealNoteCommand, Result<DealActivityDto>>
{
    public async Task<Result<DealActivityDto>> Handle(AddDealNoteCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.deals.manage"))
            return Result.Failure<DealActivityDto>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<DealActivityDto>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;
        var dealExists = await db.Deals.AnyAsync(
            d => d.Id == cmd.Id && d.TenantId == tid && !d.IsDeleted, ct);
        if (!dealExists) return Result.Failure<DealActivityDto>("Deal not found");

        var activity = DealActivityLogger.Note(tid, cmd.Id, user, cmd.Note);
        db.DealActivities.Add(activity);
        await db.SaveChangesAsync(ct);

        return Result.Success(new DealActivityDto(
            activity.Id, activity.OccurredAt, activity.ActorUserId, activity.ActorName,
            activity.Kind.ToString(), activity.FromValue, activity.ToValue, activity.Note));
    }
}
