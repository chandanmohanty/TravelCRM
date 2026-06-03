using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Domain.Entities.Crm;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.LeadImport;

/// <summary>
/// Shared upsert/dedupe engine for both Excel (stateless, always-update) and
/// Google Sheets (stateful, A3 hash-skip + update-only-when-changed) import paths.
/// Batches writes (500/flush), isolates poison batches via ChangeTracker.Clear,
/// and applies tenant isolation explicitly on every query.
/// </summary>
public sealed class LeadImportEngine(ApplicationDbContext db) : ILeadImportEngine
{
    private const int BatchSize = 500;

    // Unit separator between hash field entries — prevents
    // email=a@b.com+firstName=X colliding with email=a@b.comfirstName=X.
    private const char Sep = '';

    public async Task<LeadImportResult> ApplyAsync(
        Guid tenantId,
        IReadOnlyList<IReadOnlyDictionary<string, string>> rows,
        IReadOnlyDictionary<string, string> mapping,
        string matchKeyField,
        Guid? sourceId,
        Guid? actingUserId,
        CancellationToken ct)
    {
        int created = 0, updated = 0, skipped = 0, failed = 0;
        var errors = new List<LeadImportRowOutcome>();

        void Track(int n, string key, LeadImportRowStatus st, string? reason)
        {
            switch (st)
            {
                case LeadImportRowStatus.Created: created++; return;
                case LeadImportRowStatus.Updated: updated++; return;
                case LeadImportRowStatus.Skipped: skipped++; break;
                default: failed++; break;
            }
            if (errors.Count < 100)
                errors.Add(new LeadImportRowOutcome(n, key, st, reason));
        }

        // Sheets-path row-state map (empty for Excel).
        Dictionary<string, LeadImportRowState> stateByKey = new(StringComparer.Ordinal);
        if (sourceId is Guid sid)
            stateByKey = await db.Set<LeadImportRowState>()
                .Where(s => s.TenantId == tenantId && s.ImportSourceId == sid)
                .ToDictionaryAsync(s => s.MatchKey, StringComparer.Ordinal, ct);

        var seenKeys = new HashSet<string>(StringComparer.Ordinal);
        var batch = new List<(int rowNo, Lead lead, string key, string hash)>();

        var rowNumber = 1; // header is row 1; data starts at 2
        foreach (var raw in rows)
        {
            ct.ThrowIfCancellationRequested();
            rowNumber++;
            var (lead, error) = LeadFieldMap.Project(raw, mapping);
            if (error != null) { Track(rowNumber, "", LeadImportRowStatus.Failed, error); continue; }

            var key = NormaliseKey(matchKeyField, lead!);
            if (!seenKeys.Add(key))
            {
                Track(rowNumber, key, LeadImportRowStatus.Skipped, "duplicate in source");
                continue;
            }
            var hash = ContentHash(raw, mapping, matchKeyField);
            batch.Add((rowNumber, lead!, key, hash));
            if (batch.Count >= BatchSize)
                await FlushAsync(batch, stateByKey, tenantId, sourceId, actingUserId, Track, ct);
        }
        await FlushAsync(batch, stateByKey, tenantId, sourceId, actingUserId, Track, ct);

        return new LeadImportResult(created, updated, skipped, failed, errors);
    }

    private async Task FlushAsync(
        List<(int rowNo, Lead lead, string key, string hash)> batch,
        Dictionary<string, LeadImportRowState> stateByKey,
        Guid tenantId, Guid? sourceId, Guid? actingUserId,
        Action<int, string, LeadImportRowStatus, string?> track,
        CancellationToken ct)
    {
        if (batch.Count == 0) return;

        var keys = batch.Select(b => b.key).Distinct().ToList();
        var existing = await db.Leads
            .Where(l => l.TenantId == tenantId && keys.Contains(l.Email))
            .ToDictionaryAsync(l => l.Email, StringComparer.Ordinal, ct);

        var pendingOutcomes = new List<(int rowNo, string key, LeadImportRowStatus st, string? reason)>();

        foreach (var (rowNo, lead, key, hash) in batch)
        {
            var hasState = stateByKey.TryGetValue(key, out var state);
            if (existing.TryGetValue(key, out var current))
            {
                if (sourceId is not null && hasState && state!.ContentHash == hash)
                {
                    state.LastSeenAt = DateTime.UtcNow;
                    pendingOutcomes.Add((rowNo, key, LeadImportRowStatus.Skipped, "unchanged"));
                    continue;
                }
                ApplyFields(current, lead);
                current.UpdatedAt = DateTime.UtcNow;
                current.UpdatedBy = actingUserId;
                UpsertState(sourceId, tenantId, stateByKey, key, hash, current.Id);
                pendingOutcomes.Add((rowNo, key, LeadImportRowStatus.Updated, null));
            }
            else
            {
                lead.Id = Guid.NewGuid();
                lead.TenantId = tenantId;
                lead.CreatedAt = DateTime.UtcNow;
                lead.CreatedBy = actingUserId;
                db.Leads.Add(lead);
                UpsertState(sourceId, tenantId, stateByKey, key, hash, lead.Id);
                pendingOutcomes.Add((rowNo, key, LeadImportRowStatus.Created, null));
            }
        }

        try
        {
            await db.SaveChangesAsync(ct);
            foreach (var (rn, k, s, r) in pendingOutcomes) track(rn, k, s, r);
        }
        catch (Exception ex)
        {
            db.ChangeTracker.Clear();
            // Reload state map after a clear — the in-memory dict still
            // points at detached entities, so refresh for the next batch.
            stateByKey.Clear();
            if (sourceId is Guid sid2)
            {
                var refreshed = await db.Set<LeadImportRowState>()
                    .Where(s => s.TenantId == tenantId && s.ImportSourceId == sid2)
                    .ToDictionaryAsync(s => s.MatchKey, StringComparer.Ordinal, CancellationToken.None);
                foreach (var (k, v) in refreshed) stateByKey[k] = v;
            }
            foreach (var (rn, k, _, _) in pendingOutcomes)
                track(rn, k, LeadImportRowStatus.Failed, ex.Message);
        }
        batch.Clear();
    }

    private static void ApplyFields(Lead target, Lead src)
    {
        target.FirstName      = src.FirstName;
        target.LastName       = src.LastName;
        target.Phone          = src.Phone;
        target.Company        = src.Company;
        target.JobTitle       = src.JobTitle;
        target.AssignedTo     = src.AssignedTo;
        target.Status         = src.Status;
        target.Source         = src.Source;
        target.Score          = src.Score;
        target.EstimatedValue = src.EstimatedValue;
        target.Tags           = src.Tags;
        target.Notes          = src.Notes;
    }

    // INSTANCE method (not static) so we can call db.Add for new states.
    private void UpsertState(
        Guid? sourceId, Guid tenantId,
        Dictionary<string, LeadImportRowState> map,
        string key, string hash, Guid leadId)
    {
        if (sourceId is not Guid sid) return;
        if (map.TryGetValue(key, out var s))
        {
            s.ContentHash = hash;
            s.LeadId      = leadId;
            s.LastSeenAt  = DateTime.UtcNow;
        }
        else
        {
            var state = new LeadImportRowState
            {
                TenantId       = tenantId,
                ImportSourceId = sid,
                MatchKey       = key,
                ContentHash    = hash,
                LeadId         = leadId,
                LastSeenAt     = DateTime.UtcNow,
            };
            db.Set<LeadImportRowState>().Add(state);
            map[key] = state;
        }
    }

    private static string NormaliseKey(string field, Lead l)
    {
        // Phase-1 supports only email as the match key. Fail loud at the
        // boundary instead of silently keying by email when callers pass
        // something else — T11/T12 will surface this via the API.
        if (field != "email")
            throw new NotSupportedException(
                $"Match-key field '{field}' is not supported. Only 'email' is implemented.");
        return l.Email.Trim();
    }

    private static string ContentHash(
        IReadOnlyDictionary<string, string> row,
        IReadOnlyDictionary<string, string> mapping,
        string matchKeyField)
    {
        var sb = new StringBuilder();
        sb.Append("matchKey=").Append(matchKeyField).Append(Sep);  // future-proof
        foreach (var f in LeadFieldMap.Fields.OrderBy(f => f.Key, StringComparer.Ordinal))
            if (mapping.TryGetValue(f.Key, out var hdr) && row.TryGetValue(hdr, out var v))
                sb.Append(f.Key).Append('=').Append((v ?? "").Trim()).Append(Sep);
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(sb.ToString())));
    }
}
