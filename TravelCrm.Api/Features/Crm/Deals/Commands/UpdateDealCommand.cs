using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Crm.Deals.Queries;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.Deals.Commands;

public sealed record UpdateDealCommand(
    Guid Id,
    string RowVersion,            // base64 of byte[]
    string Title,
    decimal? Value,
    string Currency,
    int Probability,
    DateOnly? ExpectedCloseDate,
    IReadOnlyList<string>? Tags,
    string? Notes
) : IRequest<Result<DealDto>>;

public sealed class UpdateDealValidator : AbstractValidator<UpdateDealCommand>
{
    public UpdateDealValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.RowVersion).NotEmpty();
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Currency).NotEmpty().MaximumLength(5);
        RuleFor(x => x.Value).GreaterThanOrEqualTo(0).When(x => x.Value.HasValue);
        RuleFor(x => x.Probability).InclusiveBetween(0, 100);
        RuleFor(x => x.Notes).MaximumLength(4000);
    }
}

public sealed class UpdateDealHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<UpdateDealCommand, Result<DealDto>>
{
    public async Task<Result<DealDto>> Handle(UpdateDealCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.deals.manage"))
            return Result.Failure<DealDto>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<DealDto>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;
        var deal = await db.Deals.FirstOrDefaultAsync(
            d => d.Id == cmd.Id && d.TenantId == tid && !d.IsDeleted, ct);
        if (deal is null) return Result.Failure<DealDto>("Deal not found");

        // Concurrency check — client must send the RowVersion it last read
        byte[] clientRv;
        try { clientRv = Convert.FromBase64String(cmd.RowVersion); }
        catch (FormatException) { return Result.Failure<DealDto>("invalid_row_version"); }
        if (!clientRv.SequenceEqual(deal.RowVersion))
            return Result.Failure<DealDto>("concurrency_conflict");

        // Detect value change for activity log
        var valueChanged = deal.Value != cmd.Value || deal.Currency != cmd.Currency;
        var fromValueStr = deal.Value is null ? "—" : $"{deal.Value} {deal.Currency}";
        var toValueStr   = cmd.Value  is null ? "—" : $"{cmd.Value} {cmd.Currency}";

        deal.Title             = cmd.Title;
        deal.Value             = cmd.Value;
        deal.Currency          = cmd.Currency;
        deal.Probability       = cmd.Probability;
        deal.ExpectedCloseDate = cmd.ExpectedCloseDate;
        deal.Tags              = cmd.Tags?.ToList() ?? new();
        deal.Notes             = cmd.Notes;
        deal.UpdatedAt         = DateTime.UtcNow;
        deal.UpdatedBy         = user.UserId;

        if (valueChanged)
            db.DealActivities.Add(DealActivityLogger.ValueChanged(tid, deal.Id, user, fromValueStr, toValueStr));

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
