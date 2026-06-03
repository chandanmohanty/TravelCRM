using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Crm;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.LeadImport.Commands;

public sealed record SetLeadImportSourceStatusCommand(Guid Id, bool Pause) : IRequest<Result>;

public sealed class SetLeadImportSourceStatusCommandHandler(
    ApplicationDbContext db, ITenantContext tenant, ICurrentUser user)
    : IRequestHandler<SetLeadImportSourceStatusCommand, Result>
{
    public async Task<Result> Handle(SetLeadImportSourceStatusCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.leads.manage"))
            return Result.Failure("You don't have permission to manage lead sources.");
        if (!tenant.IsResolved) return Result.Failure("Tenant context not resolved.");

        var src = await db.LeadImportSources
            .FirstOrDefaultAsync(s => s.Id == cmd.Id && s.TenantId == tenant.TenantId!.Value, ct);
        if (src is null) return Result.Failure("Source not found.");

        if (src.Status == LeadImportSourceStatus.Disconnected)
            return Result.Failure("Cannot change status of a disconnected source. Reconnect Google first.");

        src.Status = cmd.Pause ? LeadImportSourceStatus.Paused : LeadImportSourceStatus.Active;
        src.UpdatedAt = DateTime.UtcNow;
        src.UpdatedBy = user.IsAuthenticated ? user.UserId : null;
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
