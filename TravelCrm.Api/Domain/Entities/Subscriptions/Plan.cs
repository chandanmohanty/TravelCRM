namespace TravelCrm.Api.Domain.Entities.Subscriptions;

/// <summary>
/// A subscription tier. Platform-scoped — there is one global catalogue of plans
/// shared by every tenant. Plans carry pricing, hard limits (seats, storage,
/// rule counts), and a list of <see cref="PlanFeature"/> codes that act as
/// entitlement keys for the <c>IFeatureGate</c> service.
///
/// The six seed plans mirror the ZNICRM tiers but adapted to the travel vertical:
/// Free / Starter / Grow / Scale / Business / Unlimited.
/// </summary>
public sealed class Plan : IAuditableEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Stable machine code (e.g. "starter", "grow"). Used by FeatureGate
    /// and by TenantSubscription.PlanCode for joinless lookups.</summary>
    public string Code { get; set; } = default!;

    /// <summary>Display name (e.g. "Grow (Popular)").</summary>
    public string Name { get; set; } = default!;

    /// <summary>Short marketing description shown on the upgrade page.</summary>
    public string? Description { get; set; }

    // ── Pricing ──────────────────────────────────────────────────────────────

    /// <summary>Monthly price per user when billed monthly. Null for free / contact-sales plans.</summary>
    public decimal? MonthlyPrice { get; set; }

    /// <summary>Monthly price per user when billed annually. Null for free / contact-sales plans.</summary>
    public decimal? AnnualPricePerMonth { get; set; }

    /// <summary>Flat-rate price (e.g. Unlimited ₹14,999/mo). When set, ignore per-user pricing.</summary>
    public decimal? FlatMonthlyPrice { get; set; }

    public string Currency { get; set; } = "INR";

    // ── Hard limits ──────────────────────────────────────────────────────────

    /// <summary>Maximum users this plan allows. Null = unlimited.</summary>
    public int? SeatLimit { get; set; }

    /// <summary>Document storage cap in gigabytes. Null = unlimited.</summary>
    public int? StorageGbLimit { get; set; }

    /// <summary>Max active webhook subscriptions. Null = unlimited.</summary>
    public int? WebhookLimit { get; set; }

    /// <summary>Max active workflow rules. Null = unlimited.</summary>
    public int? WorkflowRuleLimit { get; set; }

    /// <summary>Max active marketing-automation rules. Null = unlimited.</summary>
    public int? MarketingRuleLimit { get; set; }

    /// <summary>Max chat licences. Null = unlimited.</summary>
    public int? ChatLicenseLimit { get; set; }

    /// <summary>Max custom departments/teams. Null = unlimited.</summary>
    public int? DepartmentLimit { get; set; }

    /// <summary>Max custom roles. Null = unlimited.</summary>
    public int? RoleLimit { get; set; }

    // ── Lifecycle ────────────────────────────────────────────────────────────

    /// <summary>When false, the plan cannot be selected for new subscriptions but
    /// existing tenants keep running on it (grandfathered).</summary>
    public bool IsActive { get; set; } = true;

    /// <summary>When true, hidden from public pricing pages and only assignable
    /// by Platform Admins (e.g. Unlimited / Enterprise).</summary>
    public bool IsContactSalesOnly { get; set; }

    /// <summary>Display order on the pricing page (ascending).</summary>
    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    /// <summary>Feature codes (see <c>FeatureCatalog</c>) granted by this plan.</summary>
    public List<PlanFeature> Features { get; set; } = new();
}
