using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Inventory.TenantSettingsFeature.Queries;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;
using EntityTenantSettings = TravelCrm.Api.Domain.Entities.TenantSettings;

namespace TravelCrm.Api.Features.Inventory.TenantSettingsFeature.Commands;

public sealed record UpdateTenantSettingsCommand(int HoldTtlHours) : IRequest<Result<TenantSettingsDto>>;

public sealed class UpdateTenantSettingsValidator : AbstractValidator<UpdateTenantSettingsCommand>
{
    public UpdateTenantSettingsValidator()
    {
        // Sane bounds: at least 1h (otherwise holds expire instantly), at most
        // 720h (30 days) — beyond that, "holds" stop being short-term locks.
        RuleFor(x => x.HoldTtlHours)
            .InclusiveBetween(1, 720)
            .WithMessage("HoldTtlHours must be between 1 and 720 (30 days)");
    }
}

public sealed class UpdateTenantSettingsHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<UpdateTenantSettingsCommand, Result<TenantSettingsDto>>
{
    public async Task<Result<TenantSettingsDto>> Handle(UpdateTenantSettingsCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.tenant_settings.manage"))
            return Result.Failure<TenantSettingsDto>("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure<TenantSettingsDto>("Tenant not resolved");

        var row = await db.TenantSettings
            .FirstOrDefaultAsync(s => s.TenantId == tenantContext.TenantId, ct);

        var now = DateTime.UtcNow;
        if (row is null)
        {
            // Lazy-create the row on first override.
            row = new EntityTenantSettings
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId!.Value,
                HoldTtlHours = cmd.HoldTtlHours,
                CreatedAt = now,
                UpdatedAt = now,
            };
            db.TenantSettings.Add(row);
        }
        else
        {
            row.HoldTtlHours = cmd.HoldTtlHours;
            row.UpdatedAt = now;
        }

        await db.SaveChangesAsync(ct);
        return Result.Success(new TenantSettingsDto(row.HoldTtlHours));
    }
}
