using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Settings.Ai.Commands;

/// <summary>Marks one AI config as the active one for the tenant, deactivating its siblings.</summary>
public sealed record SetActiveAiProviderConfigCommand(Guid Id) : IRequest<Result>;

public sealed class SetActiveAiProviderConfigCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<SetActiveAiProviderConfigCommand, Result>
{
    public async Task<Result> Handle(SetActiveAiProviderConfigCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure("Tenant context not resolved.");
        if (!currentUser.HasPermission("admin.ai.update"))
            return Result.Failure("You don't have permission to update AI provider settings.");

        var row = await db.AiProviderConfigurations
            .FirstOrDefaultAsync(c => c.Id == cmd.Id && c.TenantId == tenantId, ct);
        if (row is null) return Result.Failure("AI provider config not found.");

        var actives = await db.AiProviderConfigurations
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
