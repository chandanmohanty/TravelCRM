using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Domain.Entities.Subscriptions;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Infrastructure.Jobs;

/// <summary>
/// Nightly sweep that walks <see cref="TenantSubscription"/> rows and flips
/// any trial whose <c>TrialEndsAt</c> has passed into <see cref="SubscriptionStatus.PastDue"/>.
///
/// <para>Past-due tenants keep read access (so users can still log in and see
/// their data) but writes are blocked by <c>[RequiresFeature]</c>'s
/// <c>AllowsWrites</c> check. The grace period before suspension is handled
/// at the <c>AllowsWrites</c> level — this job's job is just status
/// progression.</para>
///
/// <para>Scheduled via <c>RecurringJobRegistrar</c> with a daily cron.
/// Idempotent — safe to re-run.</para>
/// </summary>
public sealed class TrialExpirySweepJob(
    ApplicationDbContext db,
    ILogger<TrialExpirySweepJob> logger)
{
    public async Task ExecuteAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;

        // Index `ix_tenant_subscriptions_status_trial_ends_at` covers this scan.
        var expired = await db.TenantSubscriptions
            .Where(s => s.Status == SubscriptionStatus.Trial
                     && s.TrialEndsAt != null
                     && s.TrialEndsAt < now)
            .ToListAsync(ct);

        if (expired.Count == 0)
        {
            logger.LogInformation("TrialExpirySweep: no expired trials at {Now:o}", now);
            return;
        }

        foreach (var sub in expired)
        {
            sub.Status    = SubscriptionStatus.PastDue;
            sub.UpdatedAt = now;
        }
        await db.SaveChangesAsync(ct);

        logger.LogWarning(
            "TrialExpirySweep: moved {Count} subscriptions Trial → PastDue at {Now:o}",
            expired.Count, now);
    }
}
