using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Features.Branding.Queries;

namespace TravelCrm.Api.Controllers;

/// <summary>
/// Read-only endpoint serving the resolved brand for the current caller. Invoked
/// by the Angular <c>APP_INITIALIZER</c> at bootstrap so every page can render
/// the correct logo before any navigation happens.
/// </summary>
[ApiController]
[Route("api/branding")]
[Authorize]
public sealed class BrandingController(IMediator mediator) : ControllerBase
{
    // GET /api/branding/resolved
    [HttpGet("resolved")]
    public async Task<IActionResult> GetResolved(CancellationToken ct)
    {
        var result = await mediator.Send(new GetResolvedBrandQuery(), ct);
        return result.IsSuccess
            ? Ok(result.Value)
            : BadRequest(new { error = result.Error });
    }
}
