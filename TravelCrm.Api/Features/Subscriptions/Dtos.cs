namespace TravelCrm.Api.Features.Subscriptions;

/// <summary>
/// Plan summary returned by the Platform Plans list and tenant-facing upgrade
/// page. Includes the feature codes so the Angular client can render a
/// comparison matrix without a second round-trip.
/// </summary>
public sealed record PlanDto(
    Guid Id,
    string Code,
    string Name,
    string? Description,
    decimal? MonthlyPrice,
    decimal? AnnualPricePerMonth,
    decimal? FlatMonthlyPrice,
    string Currency,
    int? SeatLimit,
    int? StorageGbLimit,
    int? WebhookLimit,
    int? WorkflowRuleLimit,
    int? MarketingRuleLimit,
    int? ChatLicenseLimit,
    int? DepartmentLimit,
    int? RoleLimit,
    bool IsActive,
    bool IsContactSalesOnly,
    int SortOrder,
    IReadOnlyList<string> FeatureCodes);

/// <summary>
/// Tenant entitlements snapshot — what /api/me/entitlements returns. Used by
/// the Angular EntitlementsService + *hasFeature directive.
/// </summary>
public sealed record EntitlementsDto(
    Guid TenantId,
    Guid PlanId,
    string PlanCode,
    string PlanName,
    string Status,
    DateTime? TrialEndsAt,
    DateTime? CurrentPeriodEnd,
    DateTime? CancelledAt,
    bool AllowsWrites,

    // Hard limits + live usage so the UI can render meters
    int? SeatLimit,
    int UsedSeats,
    int? StorageGbLimit,
    long StorageUsedBytes,
    int? WebhookLimit,
    int? WorkflowRuleLimit,
    int? MarketingRuleLimit,
    int? ChatLicenseLimit,
    int? DepartmentLimit,
    int? RoleLimit,

    IReadOnlyList<string> FeatureCodes);
