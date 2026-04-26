using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Holds.Commands;

public sealed record ReleaseHoldCommand(Guid Id, string? Notes) : IRequest<Result>;

public sealed class ReleaseHoldValidator : AbstractValidator<ReleaseHoldCommand>
{
    public ReleaseHoldValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Notes).MaximumLength(500);
    }
}

public sealed class ReleaseHoldHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<ReleaseHoldCommand, Result>
{
    public async Task<Result> Handle(ReleaseHoldCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.holds.manage"))
            return Result.Failure("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure("Tenant not resolved");

        var hold = await db.ResourceHolds.FirstOrDefaultAsync(
            h => h.Id == cmd.Id && h.TenantId == tenantContext.TenantId, ct);
        if (hold is null) return Result.Failure("Hold not found");

        if (hold.Status is ResourceHoldStatus.Released or ResourceHoldStatus.Expired)
            return Result.Failure($"Hold is in terminal state ({hold.Status}) and cannot be released again");

        hold.Status = ResourceHoldStatus.Released;
        hold.ExpiresAt = null;
        if (cmd.Notes is not null) hold.Notes = cmd.Notes;

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
