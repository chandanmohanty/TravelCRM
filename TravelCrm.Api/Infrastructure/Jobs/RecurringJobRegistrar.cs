using Hangfire;

namespace TravelCrm.Api.Infrastructure.Jobs;

/// <summary>
/// Central registry of recurring jobs. Call <see cref="RegisterAll"/> once
/// at app startup (after <c>UseHangfireServer</c>). Add new recurring jobs
/// here so the Scheduled Tasks panel enumerates them from a single place.
/// </summary>
public static class RecurringJobRegistrar
{
    public static void RegisterAll(IRecurringJobManager jobs)
    {
        // Sample job (safe to trigger manually) — a heartbeat that writes to the log.
        // Replace with real jobs as features land (e.g. send-due-reminders, clean-expired-tokens).
        jobs.AddOrUpdate<SampleHeartbeatJob>(
            recurringJobId: "heartbeat",
            methodCall:     j => j.ExecuteAsync(CancellationToken.None),
            cronExpression: Cron.Hourly,
            options:        new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc });

        jobs.AddOrUpdate<OverdueTasksJob>(
            recurringJobId: "overdue-tasks-check",
            methodCall:     j => j.ExecuteAsync(CancellationToken.None),
            cronExpression: Cron.Daily);

        jobs.AddOrUpdate<HoldExpirySweepJob>(
            recurringJobId: "hold-expiry-sweep",
            methodCall:     j => j.ExecuteAsync(CancellationToken.None),
            cronExpression: Cron.MinuteInterval(5));
    }
}

/// <summary>No-op heartbeat job. Exists so the Scheduled Tasks panel has
/// something to list on day one — replace with real recurring work.</summary>
public sealed class SampleHeartbeatJob(ILogger<SampleHeartbeatJob> logger)
{
    public Task ExecuteAsync(CancellationToken ct)
    {
        logger.LogInformation("Hangfire heartbeat at {Now:o}", DateTime.UtcNow);
        return Task.CompletedTask;
    }
}
