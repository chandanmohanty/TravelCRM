using Hangfire;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.LeadImport.Commands;

public sealed record RunLeadImportSyncCommand(Guid Id) : IRequest<Result>;

public sealed class RunLeadImportSyncCommandHandler(
    ApplicationDbContext db, ITenantContext tenant, ICurrentUser user)
    : IRequestHandler<RunLeadImportSyncCommand, Result>
{
    public async Task<Result> Handle(RunLeadImportSyncCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.leads.manage"))
            return Result.Failure("You don't have permission to manage lead sources.");
        if (!tenant.IsResolved) return Result.Failure("Tenant context not resolved.");

        var exists = await db.LeadImportSources
            .AnyAsync(s => s.Id == cmd.Id && s.TenantId == tenant.TenantId!.Value, ct);
        if (!exists) return Result.Failure("Source not found.");

        BackgroundJob.Enqueue<TravelCrm.Api.Infrastructure.Jobs.RunLeadImportSyncJob>(
            j => j.ExecuteAsync(cmd.Id, CancellationToken.None));

        return Result.Success();
    }
}
