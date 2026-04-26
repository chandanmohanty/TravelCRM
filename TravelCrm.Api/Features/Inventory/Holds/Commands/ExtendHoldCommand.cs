using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Holds.Commands;

public sealed record ExtendHoldCommand(Guid Id) : IRequest<Result<HoldDto>>;

public sealed class ExtendHoldValidator : AbstractValidator<ExtendHoldCommand>
{
    public ExtendHoldValidator() => RuleFor(x => x.Id).NotEmpty();
}

public sealed class ExtendHoldHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<ExtendHoldCommand, Result<HoldDto>>
{
    private const int MaxExtensions = 3;

    public async Task<Result<HoldDto>> Handle(ExtendHoldCommand cmd, CancellationToken ct)
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

        if (hold.ExtensionCount >= MaxExtensions)
            return Result.Failure<HoldDto>($"Extension limit reached (max {MaxExtensions})");

        var settings = await db.InventorySettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == tenantContext.TenantId, ct);
        var ttlHours = settings?.HoldTtlHours ?? 24;

        hold.ExpiresAt = (hold.ExpiresAt ?? DateTime.UtcNow).AddHours(ttlHours);
        hold.ExtensionCount += 1;

        await db.SaveChangesAsync(ct);
        return Result.Success(HoldMapper.ToDto(hold, hold.Resource?.Name ?? ""));
    }
}
