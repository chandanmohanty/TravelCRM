using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Calendar.Commands;

public sealed record SetCapacityCommand(
    Guid ResourceId,
    DateOnly Date,
    ResourceCalendarSlot? Slot,
    int Capacity,
    string? Notes
) : IRequest<Result>;

public sealed class SetCapacityValidator : AbstractValidator<SetCapacityCommand>
{
    public SetCapacityValidator()
    {
        RuleFor(x => x.ResourceId).NotEmpty();
        RuleFor(x => x.Capacity).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Notes).MaximumLength(500);
    }
}

public sealed class SetCapacityHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<SetCapacityCommand, Result>
{
    public async Task<Result> Handle(SetCapacityCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.calendar.manage"))
            return Result.Failure("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure("Tenant not resolved");

        var resourceExists = await db.Resources.AnyAsync(
            r => r.Id == cmd.ResourceId && r.TenantId == tenantContext.TenantId, ct);
        if (!resourceExists) return Result.Failure("Resource not found");

        var existing = await db.ResourceCalendar.FirstOrDefaultAsync(
            c => c.TenantId == tenantContext.TenantId
              && c.ResourceId == cmd.ResourceId
              && c.Date == cmd.Date
              && c.Slot == cmd.Slot, ct);

        if (existing is null)
        {
            db.ResourceCalendar.Add(new ResourceCalendar
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId!.Value,
                ResourceId = cmd.ResourceId,
                Date = cmd.Date,
                Slot = cmd.Slot,
                Capacity = cmd.Capacity,
                IsBlocked = false,
                Notes = cmd.Notes,
            });
        }
        else
        {
            existing.Capacity = cmd.Capacity;
            existing.Notes = cmd.Notes;
        }

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
