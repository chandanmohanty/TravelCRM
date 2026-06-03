using Hangfire;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Domain.Entities.Crm;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Infrastructure.Jobs;

/// <summary>
/// Every 5 minutes: enqueue per-source sync jobs for due Active sources.
/// Mirrors the dispatcher pattern from existing sweep jobs. Manual cadence
/// never auto-runs.
/// </summary>
public sealed class LeadImportSyncDispatcherJob(
    ApplicationDbContext db, ILogger<LeadImportSyncDispatcherJob> logger)
{
    public async Task ExecuteAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var active = await db.LeadImportSources
            .Where(s => s.Status == LeadImportSourceStatus.Active
                     && s.SyncCadence != SyncCadence.Manual)
            .ToListAsync(ct);

        var due = active.Where(s => IsDue(s, now)).ToList();
        foreach (var s in due)
            BackgroundJob.Enqueue<RunLeadImportSyncJob>(
                j => j.ExecuteAsync(s.Id, CancellationToken.None));

        logger.LogInformation(
            "LeadImportSyncDispatcher: {Due}/{Active} sources enqueued", due.Count, active.Count);
    }

    internal static bool IsDue(LeadImportSource s, DateTime now)
    {
        if (s.LastPolledAt is null) return true;
        var interval = s.SyncCadence switch
        {
            SyncCadence.Every15Min => TimeSpan.FromMinutes(15),
            SyncCadence.Hourly     => TimeSpan.FromHours(1),
            SyncCadence.Daily      => TimeSpan.FromDays(1),
            _                      => TimeSpan.MaxValue,
        };
        return s.LastPolledAt.Value + interval <= now;
    }
}
