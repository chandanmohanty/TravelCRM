using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Infrastructure.Jobs;

/// <summary>
/// Hangfire recurring job. Marks expired Held rows as Expired so capacity is freed.
/// Runs every 5 minutes via <see cref="RecurringJobRegistrar"/>.
/// </summary>
public sealed class HoldExpirySweepJob(
    ApplicationDbContext db,
    ILogger<HoldExpirySweepJob> logger)
{
    public async Task ExecuteAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var expired = await db.ResourceHolds
            .Where(h => h.Status == ResourceHoldStatus.Held
                     && h.ExpiresAt != null
                     && h.ExpiresAt < now)
            .ToListAsync(ct);

        if (expired.Count == 0)
        {
            logger.LogInformation("HoldExpirySweep: no holds to expire");
            return;
        }

        foreach (var h in expired) h.Status = ResourceHoldStatus.Expired;

        await db.SaveChangesAsync(ct);
        logger.LogInformation("HoldExpirySweep: expired {Count} holds", expired.Count);
    }
}
