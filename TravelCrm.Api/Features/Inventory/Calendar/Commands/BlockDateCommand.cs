using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Calendar.Commands;

public sealed record BlockDateCommand(
    Guid ResourceId,
    DateOnly Date,
    ResourceCalendarSlot? Slot,
    string? Notes
) : IRequest<Result>;

public sealed class BlockDateValidator : AbstractValidator<BlockDateCommand>
{
    public BlockDateValidator()
    {
        RuleFor(x => x.ResourceId).NotEmpty();
        RuleFor(x => x.Notes).MaximumLength(500);
    }
}

public sealed class BlockDateHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<BlockDateCommand, Result>
{
    public async Task<Result> Handle(BlockDateCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.calendar.manage"))
            return Result.Failure("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure("Tenant not resolved");

        var resource = await db.Resources.FirstOrDefaultAsync(
            r => r.Id == cmd.ResourceId && r.TenantId == tenantContext.TenantId, ct);
        if (resource is null) return Result.Failure("Resource not found");

        var existing = await db.ResourceCalendar.FirstOrDefaultAsync(
            c => c.TenantId == tenantContext.TenantId
              && c.ResourceId == cmd.ResourceId
              && c.Date == cmd.Date
              && c.Slot == cmd.Slot, ct);

        if (existing is null)
        {
            var defaultCapacity = (resource as PoolResource)?.DefaultCapacity ?? 1;
            db.ResourceCalendar.Add(new ResourceCalendar
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId!.Value,
                ResourceId = cmd.ResourceId,
                Date = cmd.Date,
                Slot = cmd.Slot,
                Capacity = defaultCapacity,
                IsBlocked = true,
                Notes = cmd.Notes,
            });
        }
        else
        {
            existing.IsBlocked = true;
            if (cmd.Notes is not null) existing.Notes = cmd.Notes;
        }

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
