using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;

namespace TravelCrm.Api.Infrastructure.Persistence;

/// <summary>
/// Captures Insert/Update/Delete of every <see cref="IAuditableEntity"/> into
/// the <c>audit_logs</c> table automatically — satisfies rule 7 (audit every
/// write via a <c>SaveChanges</c> interceptor).
///
/// For updates we diff the original vs current property values and store the
/// list of changed field names plus before/after JSON blobs so the audit page
/// can display a clean "what changed" view. AuditLog itself is excluded from
/// auditing (avoids infinite loops with the immutability guard).
/// </summary>
public sealed class AuditSaveChangesInterceptor(
    ICurrentUser currentUser,
    ITenantContext tenantContext,
    IHttpContextAccessor httpContextAccessor)
    : SaveChangesInterceptor
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = false,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
    };

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        var context = eventData.Context;
        if (context is null) return new(result);

        var auditables = context.ChangeTracker.Entries<IAuditableEntity>().ToList();
        if (auditables.Count == 0) return new(result);

        var rows = BuildAuditRows(auditables);
        if (rows.Count > 0)
        {
            // Insert audit rows as part of the same transaction. If the outer
            // SaveChanges fails and rolls back, the audit rows roll back too —
            // exactly what we want (never leave a "ghost" audit entry).
            context.Set<AuditLog>().AddRange(rows);
        }

        return new(result);
    }

    private List<AuditLog> BuildAuditRows(IList<EntityEntry<IAuditableEntity>> entries)
    {
        var rows = new List<AuditLog>(entries.Count);
        var ip = httpContextAccessor.HttpContext?.Connection.RemoteIpAddress?.ToString();
        var tenantId = tenantContext.TenantId ?? Guid.Empty;
        var actorId = currentUser.UserId == Guid.Empty ? (Guid?)null : currentUser.UserId;
        var actorEmail = currentUser.Email ?? "system";
        var now = DateTime.UtcNow;

        foreach (var entry in entries)
        {
            // Skip Unchanged / Detached entries. AuditLog itself is filtered by
            // the IAuditableEntity generic constraint — it doesn't implement the marker.
            if (entry.State is EntityState.Unchanged or EntityState.Detached) continue;

            var action = entry.State switch
            {
                EntityState.Added    => "Create",
                EntityState.Modified => "Update",
                EntityState.Deleted  => "Delete",
                _ => null
            };
            if (action is null) continue;

            var (changedFields, before, after) = ExtractDiff(entry);

            rows.Add(new AuditLog
            {
                Id            = Guid.NewGuid(),
                TenantId      = tenantId,
                ActorId       = actorId,
                ActorEmail    = actorEmail,
                Action        = action,
                EntityType    = entry.Entity.GetType().Name,
                EntityId      = TryGetPrimaryKeyAsGuid(entry),
                EntityLabel   = TryGetDisplayLabel(entry),
                ChangedFields = changedFields,
                OldValues     = before,
                NewValues     = after,
                IpAddress     = ip,
                OccurredAt    = now,
            });
        }

        return rows;
    }

    private static (string[] fields, string? before, string? after) ExtractDiff(EntityEntry entry)
    {
        switch (entry.State)
        {
            case EntityState.Added:
                return (entry.Properties.Select(p => p.Metadata.Name).ToArray(),
                        null,
                        JsonSerialize(entry.CurrentValues.ToObject()));

            case EntityState.Deleted:
                return (entry.Properties.Select(p => p.Metadata.Name).ToArray(),
                        JsonSerialize(entry.OriginalValues.ToObject()),
                        null);

            case EntityState.Modified:
                var changed = entry.Properties
                    .Where(p => p.IsModified && !Equals(p.OriginalValue, p.CurrentValue))
                    .ToList();

                // No meaningful diff? treat as no-op (nothing to audit).
                if (changed.Count == 0) return (Array.Empty<string>(), null, null);

                var fields = changed.Select(p => p.Metadata.Name).ToArray();
                var before = JsonSerialize(changed.ToDictionary(p => p.Metadata.Name, p => p.OriginalValue));
                var after  = JsonSerialize(changed.ToDictionary(p => p.Metadata.Name, p => p.CurrentValue));
                return (fields, before, after);

            default:
                return (Array.Empty<string>(), null, null);
        }
    }

    private static Guid TryGetPrimaryKeyAsGuid(EntityEntry entry)
    {
        var pk = entry.Metadata.FindPrimaryKey();
        if (pk is null) return Guid.Empty;
        foreach (var prop in pk.Properties)
        {
            var val = entry.Property(prop.Name).CurrentValue;
            if (val is Guid g) return g;
        }
        return Guid.Empty;
    }

    private static string? TryGetDisplayLabel(EntityEntry entry)
    {
        // Best-effort: look for a common "display" property to help the audit UI.
        foreach (var name in new[] { "Name", "Title", "DisplayName", "Email" })
        {
            var prop = entry.Metadata.FindProperty(name);
            if (prop is null) continue;
            var val = entry.Property(name).CurrentValue?.ToString();
            if (!string.IsNullOrWhiteSpace(val)) return val;
        }
        return null;
    }

    private static string? JsonSerialize(object? value)
    {
        if (value is null) return null;
        try { return JsonSerializer.Serialize(value, JsonOptions); }
        catch { return null; }
    }
}
