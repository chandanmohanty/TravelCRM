using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Features.Platform.Queries;

namespace TravelCrm.Api.Controllers.Platform;

[ApiController]
[Route("api/platform/stats")]
[Authorize(Policy = "PlatformAdmin")]
public sealed class PlatformStatsController(IMediator mediator) : ControllerBase
{
    // GET api/platform/stats
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct = default)
    {
        var stats = await mediator.Send(new GetPlatformStatsQuery(), ct);
        return Ok(stats);
    }
}
