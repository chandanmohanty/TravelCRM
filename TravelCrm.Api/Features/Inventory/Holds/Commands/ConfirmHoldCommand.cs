using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Holds.Commands;

public sealed record ConfirmHoldCommand(Guid Id, string? BookingRef) : IRequest<Result<HoldDto>>;

public sealed class ConfirmHoldValidator : AbstractValidator<ConfirmHoldCommand>
{
    public ConfirmHoldValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.BookingRef).MaximumLength(100);
    }
}

public sealed class ConfirmHoldHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<ConfirmHoldCommand, Result<HoldDto>>
{
    public async Task<Result<HoldDto>> Handle(ConfirmHoldCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.holds.manage"))
            return Result.Failure<HoldDto>("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure<HoldDto>("Tenant not resolved");

        var hold = await db.ResourceHolds
            .Include(h => h.Resource)
            .FirstOrDefaultAsync(h => h.Id == cmd.Id && h.TenantId == tenantContext.TenantId, ct);
        if (hold is null) return Result.Failure<HoldDto>("Hold not found");

        if (hold.Status != ResourceHoldStatus.Held)
            return Result.Failure<HoldDto>($"Hold is not in Held state (current: {hold.Status})");

        if (hold.ExpiresAt is not null && hold.ExpiresAt < DateTime.UtcNow)
            return Result.Failure<HoldDto>("Hold has expired");

        hold.Status = ResourceHoldStatus.Confirmed;
        hold.ExpiresAt = null;
        hold.BookingRef = cmd.BookingRef;

        await db.SaveChangesAsync(ct);
        return Result.Success(HoldMapper.ToDto(hold, hold.Resource?.Name ?? ""));
    }
}
