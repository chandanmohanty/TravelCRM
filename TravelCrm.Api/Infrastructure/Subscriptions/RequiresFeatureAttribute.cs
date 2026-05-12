using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Multitenancy;

namespace TravelCrm.Api.Infrastructure.Subscriptions;

/// <summary>
/// Short-circuits a controller action with HTTP 402 (Payment Required) when
/// the calling tenant's plan does not entitle <see cref="FeatureCode"/>.
///
/// <para>Apply this to controllers or individual actions <b>after</b>
/// <c>[Authorize]</c> — the filter assumes <c>ITenantContext</c> has already
/// been populated by the auth/middleware pipeline.</para>
///
/// <para>Platform-admin requests (no resolved tenant) are always allowed
/// through; they manage tenants across the system and aren't subject to any
/// single tenant's plan.</para>
///
/// <example>
/// <code>
/// [Authorize]
/// [RequiresFeature(FeatureCatalog.WhatsAppBulkCampaign)]
/// [HttpPost("send-bulk")]
/// public async Task&lt;IActionResult&gt; SendBulk(...) { ... }
/// </code>
/// </example>
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false)]
public sealed class RequiresFeatureAttribute : Attribute, IAsyncActionFilter
{
    public string FeatureCode { get; }

    public RequiresFeatureAttribute(string featureCode)
    {
        if (string.IsNullOrWhiteSpace(featureCode))
            throw new ArgumentException("Feature code is required", nameof(featureCode));
        if (!FeatureCatalog.IsKnown(featureCode))
            throw new ArgumentException(
                $"Unknown feature code '{featureCode}'. Declare it in FeatureCatalog before referencing.",
                nameof(featureCode));
        FeatureCode = featureCode;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext ctx, ActionExecutionDelegate next)
    {
        var tenantCtx = ctx.HttpContext.RequestServices.GetRequiredService<ITenantContext>();

        // Platform admins (no tenant) — let them through. Their access is gated
        // by [Authorize(Policy = "PlatformAdmin")] elsewhere.
        if (!tenantCtx.IsResolved)
        {
            await next();
            return;
        }

        var gate = ctx.HttpContext.RequestServices.GetRequiredService<IFeatureGate>();
        var ent  = await gate.GetEntitlementsAsync(tenantCtx.TenantId!.Value, ctx.HttpContext.RequestAborted);

        if (ent is null)
        {
            ctx.Result = new ObjectResult(new
            {
                error      = "no_subscription",
                message    = "No active subscription found for this tenant.",
                featureCode = FeatureCode,
            })
            { StatusCode = StatusCodes.Status402PaymentRequired };
            return;
        }

        if (!ent.AllowsWrites)
        {
            ctx.Result = new ObjectResult(new
            {
                error      = "subscription_inactive",
                message    = "Subscription is past due or cancelled. Resolve billing to continue.",
                planCode   = ent.PlanCode,
                status     = ent.Status.ToString(),
                featureCode = FeatureCode,
            })
            { StatusCode = StatusCodes.Status402PaymentRequired };
            return;
        }

        if (!ent.IsEntitled(FeatureCode))
        {
            ctx.Result = new ObjectResult(new
            {
                error       = "feature_not_in_plan",
                message     = $"Your '{ent.PlanName}' plan does not include this feature. Upgrade to unlock.",
                planCode    = ent.PlanCode,
                planName    = ent.PlanName,
                featureCode = FeatureCode,
            })
            { StatusCode = StatusCodes.Status402PaymentRequired };
            return;
        }

        await next();
    }
}
