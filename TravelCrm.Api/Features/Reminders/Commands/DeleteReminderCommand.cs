using Hangfire;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Reminders.Commands;

public sealed record DeleteReminderCommand(Guid Id) : IRequest<Result>;

public sealed class DeleteReminderCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser,
    IRecurringJobManager recurringJobManager,
    IBackgroundJobClient backgroundJobClient)
    : IRequestHandler<DeleteReminderCommand, Result>
{
    public async Task<Result> Handle(DeleteReminderCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure("Tenant context not resolved.");
        if (!currentUser.HasPermission("admin.reminders.update"))
            return Result.Failure("You don't have permission to manage reminders.");

        var row = await db.Reminders
            .FirstOrDefaultAsync(r => r.Id == cmd.Id && r.TenantId == tenantId, ct);
        if (row is null) return Result.Failure("Reminder not found.");

        // Clean up Hangfire job
        if (!string.IsNullOrEmpty(row.HangfireJobId))
        {
            try { recurringJobManager.RemoveIfExists(row.HangfireJobId); } catch { /* best-effort */ }
            try { backgroundJobClient.Delete(row.HangfireJobId); } catch { /* best-effort */ }
        }

        db.Reminders.Remove(row);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
