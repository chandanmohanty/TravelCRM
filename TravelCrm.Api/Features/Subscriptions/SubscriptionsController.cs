using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Features.Subscriptions.Queries;

namespace TravelCrm.Api.Features.Subscriptions;

/// <summary>
/// Tenant-facing subscription endpoints. Used by the Angular client to read
/// the available plan catalogue (for the upgrade page) and the calling user's
/// current entitlements (for the *hasFeature directive and usage meters).
/// </summary>
[ApiController]
[Authorize]
[Route("api")]
public sealed class SubscriptionsController(IMediator mediator) : ControllerBase
{
    /// <summary>
    /// Public-style plan catalogue. Excludes contact-sales tiers (the
    /// platform-admin endpoint at <c>/api/platform/plans</c> includes them).
    /// </summary>
    [HttpGet("plans")]
    public async Task<IActionResult> ListPlans(CancellationToken ct)
    {
        var r = await mediator.Send(new ListPlansQuery(), ct);
        return r.IsSuccess ? Ok(r.Value) : BadRequest(new { error = r.Error });
    }

    /// <summary>
    /// The calling tenant's full entitlement snapshot — current plan, status,
    /// hard limits, live usage, and the set of entitled feature codes.
    /// The Angular EntitlementsService consumes this on bootstrap.
    /// </summary>
    [HttpGet("me/entitlements")]
    public async Task<IActionResult> GetMyEntitlements(CancellationToken ct)
    {
        var r = await mediator.Send(new GetMyEntitlementsQuery(), ct);
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not resolved", StringComparison.OrdinalIgnoreCase)
            ? BadRequest(new { error = r.Error })
            : NotFound(new { error = r.Error });
    }
}
