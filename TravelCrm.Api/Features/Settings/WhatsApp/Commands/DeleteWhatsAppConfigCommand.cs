using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Settings.WhatsApp.Commands;

public sealed record DeleteWhatsAppConfigCommand(Guid Id) : IRequest<Result>;

public sealed class DeleteWhatsAppConfigCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<DeleteWhatsAppConfigCommand, Result>
{
    public async Task<Result> Handle(DeleteWhatsAppConfigCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure("Tenant context not resolved.");
        if (!currentUser.HasPermission("admin.whatsapp.update"))
            return Result.Failure("You don't have permission to update WhatsApp settings.");

        var row = await db.WhatsAppProviderConfigurations
            .FirstOrDefaultAsync(c => c.Id == cmd.Id && c.TenantId == tenantId, ct);
        if (row is null) return Result.Failure("WhatsApp config not found.");

        db.WhatsAppProviderConfigurations.Remove(row);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
