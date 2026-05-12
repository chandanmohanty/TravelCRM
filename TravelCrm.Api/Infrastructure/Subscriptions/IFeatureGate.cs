using TravelCrm.Api.Domain.Entities.Subscriptions;

namespace TravelCrm.Api.Infrastructure.Subscriptions;

/// <summary>
/// Resolves a tenant's subscription state and answers "is this feature
/// entitled?" — the central authority for plan-based feature gating.
///
/// <para>Two consumption shapes:</para>
/// <list type="bullet">
///   <item><b>Per-request</b>: <see cref="IsEntitledAsync"/> for one-off
///   checks inside handlers, or <see cref="EnforceAsync"/> for the convenient
///   "throw 402 if not entitled" path.</item>
///   <item><b>Per-tenant snapshot</b>: <see cref="GetEntitlementsAsync"/>
///   returns the full <see cref="TenantEntitlements"/> object that the
///   Angular client consumes via <c>/api/me/entitlements</c>.</item>
/// </list>
///
/// <para>Caching: the implementation caches per request (scoped), so a
/// handler that checks 5 features only hits the database once. Cross-request
/// caching is out of scope for Phase 0 — revisit if/when entitlement reads
/// become a measured hot path.</para>
/// </summary>
public interface IFeatureGate
{
    /// <summary>True when the tenant's active plan grants <paramref name="featureCode"/>.
    /// Returns false (not exception) on unknown codes — the caller decides
    /// whether to treat that as a programming error.</summary>
    Task<bool> IsEntitledAsync(Guid tenantId, string featureCode, CancellationToken ct = default);

    /// <summary>Full entitlement snapshot for the tenant. Used by the
    /// <c>/api/me/entitlements</c> endpoint and the trial-expiry job.</summary>
    Task<TenantEntitlements?> GetEntitlementsAsync(Guid tenantId, CancellationToken ct = default);
}

/// <summary>
/// Snapshot of one tenant's plan + the live usage counters at read time.
/// Returned to the Angular client and used by the [RequiresFeature] filter.
/// </summary>
public sealed class TenantEntitlements
{
    public required Guid TenantId { get; init; }
    public required Guid PlanId { get; init; }
    public required string PlanCode { get; init; }
    public required string PlanName { get; init; }
    public required SubscriptionStatus Status { get; init; }

    public DateTime? TrialEndsAt { get; init; }
    public DateTime? CurrentPeriodEnd { get; init; }
    public DateTime? CancelledAt { get; init; }

    // ── Hard limits from the Plan ────────────────────────────────────────────
    public int? SeatLimit { get; init; }
    public int? StorageGbLimit { get; init; }
    public int? WebhookLimit { get; init; }
    public int? WorkflowRuleLimit { get; init; }
    public int? MarketingRuleLimit { get; init; }
    public int? ChatLicenseLimit { get; init; }
    public int? DepartmentLimit { get; init; }
    public int? RoleLimit { get; init; }

    // ── Live usage counters (best-effort; populated by GetEntitlementsAsync) ─
    public int UsedSeats { get; init; }
    public long StorageUsedBytes { get; init; }

    /// <summary>The set of feature codes entitled by the current plan.</summary>
    public required IReadOnlySet<string> FeatureCodes { get; init; }

    public bool IsEntitled(string featureCode) => FeatureCodes.Contains(featureCode);

    /// <summary>True if writes should be allowed. False when subscription is
    /// cancelled past its period end or past-due past its grace period.</summary>
    public bool AllowsWrites
    {
        get
        {
            var now = DateTime.UtcNow;
            return Status switch
            {
                SubscriptionStatus.Free    => true,
                SubscriptionStatus.Trial   => TrialEndsAt is null || TrialEndsAt > now,
                SubscriptionStatus.Active  => true,
                SubscriptionStatus.PastDue => false,
                SubscriptionStatus.Cancelled => CurrentPeriodEnd is null || CurrentPeriodEnd > now,
                _ => false,
            };
        }
    }
}
