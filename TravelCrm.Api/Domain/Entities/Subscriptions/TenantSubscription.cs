namespace TravelCrm.Api.Domain.Entities.Subscriptions;

/// <summary>
/// Lifecycle state of a tenant's subscription. Cleanly separated from the
/// <see cref="Plan"/> itself so plan changes (upgrade, downgrade) and lifecycle
/// changes (trial end, payment failure) are independent concerns.
/// </summary>
public enum SubscriptionStatus
{
    /// <summary>Free-tier — no payment required, no expiry.</summary>
    Free = 0,
    /// <summary>Trial of a paid plan. Becomes <see cref="PastDue"/> on
    /// <c>TrialEndsAt</c> if no payment is captured.</summary>
    Trial = 1,
    /// <summary>Paid and current. Writes allowed.</summary>
    Active = 2,
    /// <summary>Payment failed or trial expired without conversion. Writes
    /// suspended until resolved; reads remain available.</summary>
    PastDue = 3,
    /// <summary>Tenant or admin cancelled. Access ends at <c>CurrentPeriodEnd</c>.</summary>
    Cancelled = 4,
}

/// <summary>
/// Per-tenant subscription record. Exactly one row per tenant. Holds the active
/// <see cref="Plan"/> assignment, the lifecycle state, and the cached usage
/// counters that <c>IFeatureGate</c> reads to enforce hard limits without
/// hitting the live tables every request.
///
/// <para>Created automatically when a tenant is provisioned (see
/// <c>SeedData</c>) and updated whenever the platform admin or a self-serve
/// billing flow changes the plan.</para>
/// </summary>
public sealed class TenantSubscription : IAuditableEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid TenantId { get; set; }

    public Guid PlanId { get; set; }

    /// <summary>Denormalised plan code mirrored from <see cref="Plan.Code"/>
    /// for fast joinless lookups inside hot paths (e.g. FeatureGate).</summary>
    public string PlanCode { get; set; } = default!;

    public SubscriptionStatus Status { get; set; } = SubscriptionStatus.Trial;

    // ── Trial / billing period ───────────────────────────────────────────────

    public DateTime? TrialStartedAt { get; set; }
    public DateTime? TrialEndsAt { get; set; }

    public DateTime? CurrentPeriodStart { get; set; }
    public DateTime? CurrentPeriodEnd { get; set; }

    /// <summary>When the tenant first activated a paid subscription (after trial).</summary>
    public DateTime? ActivatedAt { get; set; }

    /// <summary>When a cancellation request was received. Access continues until
    /// <see cref="CurrentPeriodEnd"/> unless explicitly suspended.</summary>
    public DateTime? CancelledAt { get; set; }

    // ── Usage counters (cached, source-of-truth on each Create handler) ─────

    /// <summary>Bytes of files persisted via IFileStorage. Maintained by the
    /// storage layer (Phase 14); seeded to 0 until then.</summary>
    public long StorageUsedBytes { get; set; }

    // ── Audit ────────────────────────────────────────────────────────────────

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
