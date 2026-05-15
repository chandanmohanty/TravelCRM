using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Crm;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.Deals.Commands;

public sealed record DeleteDealCommand(Guid Id) : IRequest<Result<bool>>;

public sealed class DeleteDealHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<DeleteDealCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(DeleteDealCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.deals.delete"))
            return Result.Failure<bool>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<bool>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;
        var deal = await db.Deals.FirstOrDefaultAsync(
            d => d.Id == cmd.Id && d.TenantId == tid && !d.IsDeleted, ct);
        if (deal is null) return Result.Failure<bool>("Deal not found");

        if (deal.Status != DealStatus.Open)
            return Result.Failure<bool>("Closed (won/lost) deals are immutable — they cannot be deleted");

        deal.IsDeleted = true;
        deal.UpdatedAt = DateTime.UtcNow;
        deal.UpdatedBy = user.UserId;

        await db.SaveChangesAsync(ct);
        return Result.Success(true);
    }
}
