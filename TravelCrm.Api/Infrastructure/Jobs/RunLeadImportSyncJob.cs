using System.Text.Json;
using Hangfire;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Domain.Entities.Crm;
using TravelCrm.Api.Features.Crm.LeadImport;
using TravelCrm.Api.Infrastructure.Google;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Infrastructure.Jobs;

/// <summary>
/// Per-source Google Sheets sync. Disabled-concurrent so two syncs for the
/// same source don't race. No HTTP ITenantContext available — TenantId is
/// read from the entity, same pattern as HoldExpirySweepJob.
/// </summary>
[DisableConcurrentExecution(timeoutInSeconds: 600)]
public sealed class RunLeadImportSyncJob(
    ApplicationDbContext db,
    IGoogleTokenProvider tokenProvider,
    ISheetsReader sheets,
    ILeadImportEngine engine,
    ILogger<RunLeadImportSyncJob> logger)
{
    public async Task ExecuteAsync(Guid sourceId, CancellationToken ct)
    {
        var src = await db.LeadImportSources.FirstOrDefaultAsync(s => s.Id == sourceId, ct);
        if (src is null)
        {
            logger.LogWarning("RunLeadImportSync: source {SourceId} not found", sourceId);
            return;
        }
        if (src.Status is LeadImportSourceStatus.Paused or LeadImportSourceStatus.Disconnected)
        {
            logger.LogInformation(
                "RunLeadImportSync: source {SourceId} status={Status}; skipping",
                sourceId, src.Status);
            return;
        }

        src.LastPolledAt = DateTime.UtcNow;
        try
        {
            var token = await db.GoogleOAuthTokens
                .FirstOrDefaultAsync(t => t.TenantId == src.TenantId, ct)
                ?? throw new InvalidOperationException("Google not connected for this tenant.");

            var access = await tokenProvider.GetAccessTokenAsync(src.TenantId, token.RefreshToken!, ct);
            var values = await sheets.ReadAsync(access, src.SpreadsheetId, src.SheetName, ct);

            var mapping = JsonSerializer.Deserialize<Dictionary<string, string>>(src.ColumnMapping)
                          ?? new Dictionary<string, string>();
            var rows = values.Rows
                .Select(d => (IReadOnlyDictionary<string, string>)d)
                .ToList();

            var result = await engine.ApplyAsync(
                src.TenantId, rows, mapping, src.MatchKeyField,
                sourceId: src.Id, actingUserId: null, ct);

            src.Status = LeadImportSourceStatus.Active;
            src.LastSuccessAt = DateTime.UtcNow;
            src.LastResultJson = JsonSerializer.Serialize(result);
            src.LastError = null;
            await db.SaveChangesAsync(ct);

            logger.LogInformation(
                "RunLeadImportSync {SourceId}: +{Created} ~{Updated} ={Skipped} !{Failed}",
                src.Id, result.Created, result.Updated, result.Skipped, result.Failed);
        }
        catch (Exception ex)
        {
            // Don't lose LastPolledAt — keep our tracking honest.
            src.Status = LeadImportSourceStatus.Error;
            src.LastError = ex.Message.Length > 1000 ? ex.Message[..1000] : ex.Message;

            // TODO(T16): Notification.UserId is non-nullable in the current entity, but
            // a background Sheets sync has no acting user. Log-only for now; revisit
            // once the Notification model supports tenant-wide / system-actor rows.

            try { await db.SaveChangesAsync(CancellationToken.None); }
            catch (Exception writeEx)
            {
                logger.LogError(writeEx, "RunLeadImportSync {SourceId}: failed to persist error state", src.Id);
            }
            logger.LogError(ex, "RunLeadImportSync {SourceId} failed", src.Id);
        }
    }
}
