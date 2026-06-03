using Hangfire;

namespace TravelCrm.Api.Infrastructure.Jobs;

/// <summary>Per-source Google Sheets sync. Implemented in T13.</summary>
[DisableConcurrentExecution(timeoutInSeconds: 600)]
public sealed class RunLeadImportSyncJob(ILogger<RunLeadImportSyncJob> logger)
{
    public Task ExecuteAsync(Guid sourceId, CancellationToken ct)
    {
        // T13 will replace this body: load source -> mint token -> read sheet -> engine -> write status.
        logger.LogInformation("RunLeadImportSyncJob stub invoked for source {SourceId}", sourceId);
        return Task.CompletedTask;
    }
}
