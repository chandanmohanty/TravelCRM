using System.Data;
using FluentValidation;
using Microsoft.EntityFrameworkCore.Storage;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Features.Inventory.Calendar;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Holds.Commands;

public sealed record CreateHoldCommand(
    Guid ResourceId,
    DateOnly StartDate,
    DateOnly EndDate,
    ResourceCalendarSlot? Slot,
    int Quantity,
    string? Notes
) : IRequest<Result<HoldDto>>;

public sealed class CreateHoldValidator : AbstractValidator<CreateHoldCommand>
{
    public CreateHoldValidator()
    {
        RuleFor(x => x.ResourceId).NotEmpty();
        RuleFor(x => x.Quantity).GreaterThan(0);
        RuleFor(x => x.Notes).MaximumLength(500);
        RuleFor(x => x.EndDate)
            .GreaterThanOrEqualTo(x => x.StartDate)
            .WithMessage("EndDate must be on or after StartDate");
    }
}

public sealed class CreateHoldHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<CreateHoldCommand, Result<HoldDto>>
{
    public async Task<Result<HoldDto>> Handle(CreateHoldCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.holds.manage"))
            return Result.Failure<HoldDto>("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure<HoldDto>("Tenant not resolved");

        // Pessimistic lock on the resource row — serialises concurrent holds.
        // Both the transaction and the FOR UPDATE lock are no-ops on the InMemory
        // test provider; they take effect against PostgreSQL only.
        IDbContextTransaction? tx = null;
        if (db.Database.IsNpgsql())
        {
            tx = await db.Database
                .BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

            await db.Database.ExecuteSqlRawAsync(
                "SELECT 1 FROM resources WHERE id = {0} FOR UPDATE",
                new object[] { cmd.ResourceId }, ct);
        }

        var resource = await db.Resources
            .FirstOrDefaultAsync(r => r.Id == cmd.ResourceId
                                   && r.TenantId == tenantContext.TenantId, ct);
        if (resource is null) return Result.Failure<HoldDto>("Resource not found");
        if (resource.Status != ResourceStatus.Active)
            return Result.Failure<HoldDto>("Resource is not active");

        if (resource is AssetResource && cmd.Quantity != 1)
            return Result.Failure<HoldDto>("Asset resources must use Quantity = 1");

        var overrides = await db.ResourceCalendar
            .Where(c => c.TenantId == tenantContext.TenantId
                     && c.ResourceId == cmd.ResourceId
                     && c.Date >= cmd.StartDate && c.Date <= cmd.EndDate)
            .ToListAsync(ct);

        var holds = await db.ResourceHolds
            .Where(h => h.TenantId == tenantContext.TenantId
                     && h.ResourceId == cmd.ResourceId
                     && (h.Status == ResourceHoldStatus.Held || h.Status == ResourceHoldStatus.Confirmed)
                     && h.StartDate <= cmd.EndDate && h.EndDate >= cmd.StartDate)
            .ToListAsync(ct);

        var availability = AvailabilityCalculator.Check(
            resource, overrides, holds,
            cmd.StartDate, cmd.EndDate, cmd.Slot, cmd.Quantity);

        if (!availability.IsAvailable)
            return Result.Failure<HoldDto>(availability.Reason!);

        var ttl = await GetHoldTtlHoursAsync(tenantContext.TenantId!.Value, ct);
        var hold = new ResourceHold
        {
            Id = Guid.NewGuid(),
            TenantId = tenantContext.TenantId!.Value,
            ResourceId = cmd.ResourceId,
            StartDate = cmd.StartDate,
            EndDate = cmd.EndDate,
            Slot = cmd.Slot,
            Quantity = cmd.Quantity,
            Status = ResourceHoldStatus.Held,
            ExpiresAt = DateTime.UtcNow.AddHours(ttl),
            HeldByUserId = currentUser.UserId,
            Notes = cmd.Notes,
            ExtensionCount = 0,
        };
        db.ResourceHolds.Add(hold);
        await db.SaveChangesAsync(ct);
        if (tx is not null)
        {
            await tx.CommitAsync(ct);
            await tx.DisposeAsync();
        }

        return Result.Success(HoldMapper.ToDto(hold, resource.Name));
    }

    private async Task<int> GetHoldTtlHoursAsync(Guid tenantId, CancellationToken ct)
    {
        var settings = await db.TenantSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == tenantId, ct);
        return settings?.HoldTtlHours ?? 24;
    }
}
