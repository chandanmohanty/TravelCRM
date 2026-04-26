using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Calendar.Commands;

public sealed record UnblockDateCommand(
    Guid ResourceId,
    DateOnly Date,
    ResourceCalendarSlot? Slot
) : IRequest<Result>;

public sealed class UnblockDateValidator : AbstractValidator<UnblockDateCommand>
{
    public UnblockDateValidator() => RuleFor(x => x.ResourceId).NotEmpty();
}

public sealed class UnblockDateHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<UnblockDateCommand, Result>
{
    public async Task<Result> Handle(UnblockDateCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.calendar.manage"))
            return Result.Failure("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure("Tenant not resolved");

        var existing = await db.ResourceCalendar.FirstOrDefaultAsync(
            c => c.TenantId == tenantContext.TenantId
              && c.ResourceId == cmd.ResourceId
              && c.Date == cmd.Date
              && c.Slot == cmd.Slot, ct);

        if (existing is null) return Result.Success(); // already unblocked

        existing.IsBlocked = false;
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
