using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Settings.WhatsApp.Commands;

/// <summary>Marks one WhatsApp config as the active one for the tenant, deactivating siblings.</summary>
public sealed record SetActiveWhatsAppConfigCommand(Guid Id) : IRequest<Result>;

public sealed class SetActiveWhatsAppConfigCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<SetActiveWhatsAppConfigCommand, Result>
{
    public async Task<Result> Handle(SetActiveWhatsAppConfigCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure("Tenant context not resolved.");
        if (!currentUser.HasPermission("admin.whatsapp.update"))
            return Result.Failure("You don't have permission to update WhatsApp settings.");

        var row = await db.WhatsAppProviderConfigurations
            .FirstOrDefaultAsync(c => c.Id == cmd.Id && c.TenantId == tenantId, ct);
        if (row is null) return Result.Failure("WhatsApp config not found.");

        var actives = await db.WhatsAppProviderConfigurations
            .Where(c => c.TenantId == tenantId && c.IsActive && c.Id != cmd.Id)
            .ToListAsync(ct);
        foreach (var a in actives) a.IsActive = false;

        row.IsActive  = true;
        row.UpdatedAt = DateTime.UtcNow;
        row.UpdatedBy = currentUser.UserId == Guid.Empty ? null : currentUser.UserId;
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
