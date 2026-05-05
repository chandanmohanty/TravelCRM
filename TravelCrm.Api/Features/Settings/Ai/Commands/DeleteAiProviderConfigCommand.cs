using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Settings.Ai.Commands;

public sealed record DeleteAiProviderConfigCommand(Guid Id) : IRequest<Result>;

public sealed class DeleteAiProviderConfigCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<DeleteAiProviderConfigCommand, Result>
{
    public async Task<Result> Handle(DeleteAiProviderConfigCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure("Tenant context not resolved.");
        if (!currentUser.HasPermission("admin.ai.update"))
            return Result.Failure("You don't have permission to update AI provider settings.");

        var row = await db.AiProviderConfigurations
            .FirstOrDefaultAsync(c => c.Id == cmd.Id && c.TenantId == tenantId, ct);
        if (row is null) return Result.Failure("AI provider config not found.");

        db.AiProviderConfigurations.Remove(row);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
