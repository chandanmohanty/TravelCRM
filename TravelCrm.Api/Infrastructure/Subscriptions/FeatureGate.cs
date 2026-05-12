using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Domain.Entities.Subscriptions;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Infrastructure.Subscriptions;

/// <summary>
/// Default <see cref="IFeatureGate"/> implementation. Reads the tenant's
/// <see cref="TenantSubscription"/>, joins the active <see cref="Plan"/>'s
/// <see cref="PlanFeature"/> rows, and answers entitlement questions.
///
/// <para>Scoped lifetime — the in-memory cache is keyed by tenant id and
/// lives for the duration of one HTTP request. That's enough to avoid
/// repeated DB hits inside a single handler / MediatR pipeline.</para>
/// </summary>
public sealed class FeatureGate(ApplicationDbContext db) : IFeatureGate
{
    private readonly Dictionary<Guid, TenantEntitlements?> _cache = new();

    public async Task<bool> IsEntitledAsync(Guid tenantId, string featureCode, CancellationToken ct = default)
    {
        var ent = await GetEntitlementsAsync(tenantId, ct);
        return ent is not null && ent.IsEntitled(featureCode) && ent.AllowsWrites;
    }

    public async Task<TenantEntitlements?> GetEntitlementsAsync(Guid tenantId, CancellationToken ct = default)
    {
        if (_cache.TryGetValue(tenantId, out var cached)) return cached;

        // Single round-trip: subscription + plan + features. Tracked = false
        // because this is a hot read path with zero mutations.
        var sub = await db.TenantSubscriptions
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId)
            .FirstOrDefaultAsync(ct);

        if (sub is null)
        {
            _cache[tenantId] = null;
            return null;
        }

        var plan = await db.Plans
            .AsNoTracking()
            .Include(p => p.Features)
            .FirstOrDefaultAsync(p => p.Id == sub.PlanId, ct);

        if (plan is null)
        {
            // Subscription points at a deleted plan — fail closed.
            _cache[tenantId] = null;
            return null;
        }

        // Live counters. Storage byte count is on the subscription row itself
        // (maintained by the storage layer). Seat count is a fresh COUNT
        // because seat usage is the most-frequently-asked enforcement.
        var usedSeats = await db.Users
            .CountAsync(u => u.TenantId == tenantId && !u.IsDeleted, ct);

        var ent = new TenantEntitlements
        {
            TenantId           = sub.TenantId,
            PlanId             = sub.PlanId,
            PlanCode           = sub.PlanCode,
            PlanName           = plan.Name,
            Status             = sub.Status,
            TrialEndsAt        = sub.TrialEndsAt,
            CurrentPeriodEnd   = sub.CurrentPeriodEnd,
            CancelledAt        = sub.CancelledAt,

            SeatLimit          = plan.SeatLimit,
            StorageGbLimit     = plan.StorageGbLimit,
            WebhookLimit       = plan.WebhookLimit,
            WorkflowRuleLimit  = plan.WorkflowRuleLimit,
            MarketingRuleLimit = plan.MarketingRuleLimit,
            ChatLicenseLimit   = plan.ChatLicenseLimit,
            DepartmentLimit    = plan.DepartmentLimit,
            RoleLimit          = plan.RoleLimit,

            UsedSeats          = usedSeats,
            StorageUsedBytes   = sub.StorageUsedBytes,

            FeatureCodes       = plan.Features
                .Select(f => f.FeatureCode)
                .ToHashSet(StringComparer.Ordinal),
        };

        _cache[tenantId] = ent;
        return ent;
    }
}
