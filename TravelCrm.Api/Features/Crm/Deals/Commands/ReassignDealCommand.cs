using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Crm.Deals.Queries;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.Deals.Commands;

public sealed record ReassignDealCommand(
    Guid Id,
    string RowVersion,
    Guid OwnerUserId,
    string? Note
) : IRequest<Result<DealDto>>;

public sealed class ReassignDealValidator : AbstractValidator<ReassignDealCommand>
{
    public ReassignDealValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.OwnerUserId).NotEmpty();
        RuleFor(x => x.RowVersion).NotEmpty();
        RuleFor(x => x.Note).MaximumLength(500);
    }
}

public sealed class ReassignDealHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<ReassignDealCommand, Result<DealDto>>
{
    public async Task<Result<DealDto>> Handle(ReassignDealCommand cmd, CancellationToken ct)
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

        // Owner must be a non-deleted user in this tenant
        var newOwner = await db.Users.FirstOrDefaultAsync(
            u => u.Id == cmd.OwnerUserId && u.TenantId == tid && !u.IsDeleted, ct);
        if (newOwner is null) return Result.Failure<DealDto>("Owner not found in this tenant");

        if (newOwner.Id == deal.OwnerUserId)
            return Result.Failure<DealDto>("Deal is already assigned to that user");

        var oldOwner = await db.Users.Where(u => u.Id == deal.OwnerUserId)
            .Select(u => (u.FirstName + " " + u.LastName).Trim())
            .FirstOrDefaultAsync(ct) ?? "—";
        var newOwnerName = $"{newOwner.FirstName} {newOwner.LastName}".Trim();

        deal.OwnerUserId = newOwner.Id;
        deal.UpdatedAt   = DateTime.UtcNow;
        deal.UpdatedBy   = user.UserId;

        db.DealActivities.Add(DealActivityLogger.OwnerChanged(
            tid, deal.Id, user, oldOwner, newOwnerName, cmd.Note));

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
