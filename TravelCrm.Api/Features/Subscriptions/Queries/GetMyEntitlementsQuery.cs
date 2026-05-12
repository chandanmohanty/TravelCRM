using MediatR;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Subscriptions;

namespace TravelCrm.Api.Features.Subscriptions.Queries;

/// <summary>
/// Returns the calling tenant's full entitlement snapshot — what plan they're
/// on, lifecycle status, hard limits, live usage, and the set of entitled
/// feature codes. Consumed by the Angular EntitlementsService on startup and
/// after every plan change.
/// </summary>
public sealed record GetMyEntitlementsQuery : IRequest<Result<EntitlementsDto>>;

public sealed class GetMyEntitlementsHandler(
    ITenantContext tenantContext,
    IFeatureGate featureGate)
    : IRequestHandler<GetMyEntitlementsQuery, Result<EntitlementsDto>>
{
    public async Task<Result<EntitlementsDto>> Handle(GetMyEntitlementsQuery q, CancellationToken ct)
    {
        if (!tenantContext.IsResolved)
            return Result.Failure<EntitlementsDto>("Tenant not resolved");

        var ent = await featureGate.GetEntitlementsAsync(tenantContext.TenantId!.Value, ct);
        if (ent is null)
            return Result.Failure<EntitlementsDto>("No subscription found for this tenant.");

        return Result.Success(new EntitlementsDto(
            TenantId:           ent.TenantId,
            PlanId:             ent.PlanId,
            PlanCode:           ent.PlanCode,
            PlanName:           ent.PlanName,
            Status:             ent.Status.ToString(),
            TrialEndsAt:        ent.TrialEndsAt,
            CurrentPeriodEnd:   ent.CurrentPeriodEnd,
            CancelledAt:        ent.CancelledAt,
            AllowsWrites:       ent.AllowsWrites,

            SeatLimit:          ent.SeatLimit,
            UsedSeats:          ent.UsedSeats,
            StorageGbLimit:     ent.StorageGbLimit,
            StorageUsedBytes:   ent.StorageUsedBytes,
            WebhookLimit:       ent.WebhookLimit,
            WorkflowRuleLimit:  ent.WorkflowRuleLimit,
            MarketingRuleLimit: ent.MarketingRuleLimit,
            ChatLicenseLimit:   ent.ChatLicenseLimit,
            DepartmentLimit:    ent.DepartmentLimit,
            RoleLimit:          ent.RoleLimit,

            FeatureCodes:       ent.FeatureCodes.OrderBy(c => c).ToList()
        ));
    }
}
