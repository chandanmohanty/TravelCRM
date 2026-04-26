using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.TimeEntries.Commands;

public sealed record DeleteTimeEntryCommand(Guid TaskId, Guid Id) : IRequest<Result>;

public sealed class DeleteTimeEntryHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<DeleteTimeEntryCommand, Result>
{
    public async Task<Result> Handle(DeleteTimeEntryCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.tasks.manage"))
            return Result.Failure("Forbidden");

        if (!tenantContext.IsResolved)
            return Result.Failure("Tenant not resolved");

        var entry = await db.TimeEntries.FirstOrDefaultAsync(
            te => te.Id == cmd.Id
               && te.TaskId == cmd.TaskId
               && te.TenantId == tenantContext.TenantId, ct);

        if (entry is null) return Result.Failure("Time entry not found");

        db.TimeEntries.Remove(entry);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
