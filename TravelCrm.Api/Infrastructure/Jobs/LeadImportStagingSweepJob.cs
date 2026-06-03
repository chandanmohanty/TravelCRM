using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Infrastructure.Jobs;

/// <summary>Hourly: delete abandoned Excel staging buffers older than 1h.</summary>
public sealed class LeadImportStagingSweepJob(
    ApplicationDbContext db, ILogger<LeadImportStagingSweepJob> logger)
{
    public async Task ExecuteAsync(CancellationToken ct)
    {
        var cutoff = DateTime.UtcNow.AddHours(-1);
        var stale = await db.LeadImportStagings.Where(s => s.CreatedAt < cutoff).ToListAsync(ct);
        if (stale.Count == 0) { logger.LogInformation("StagingSweep: nothing to clean"); return; }
        db.LeadImportStagings.RemoveRange(stale);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("StagingSweep: removed {Count} stale staging rows", stale.Count);
    }
}
