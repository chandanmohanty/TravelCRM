namespace TravelCrm.Api.Domain.Entities.Subscriptions;

/// <summary>
/// A single feature code granted by a <see cref="Plan"/>. The code is the join
/// key consumed by <c>IFeatureGate.IsEntitledAsync</c> and by the
/// <c>[RequiresFeature]</c> action filter. Codes are declared centrally in
/// <c>FeatureCatalog</c> — never invent codes inline at the call site.
/// </summary>
public sealed class PlanFeature
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid PlanId { get; set; }

    /// <summary>Stable feature code (e.g. "whatsapp_bulk_campaign"). Must match
    /// a constant declared in <c>FeatureCatalog</c>.</summary>
    public string FeatureCode { get; set; } = default!;
}
