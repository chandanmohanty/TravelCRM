using Microsoft.AspNetCore.Mvc;

namespace TravelCrm.Api.Controllers;

[ApiController]
[Route("api")]
public sealed class HealthController : ControllerBase
{
    [HttpGet("ping")]
    public IActionResult Ping() => Ok(new { status = "ok", timestamp = DateTime.UtcNow });
}
