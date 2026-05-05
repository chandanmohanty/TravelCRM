using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Features.Settings.DataReset.Commands;

namespace TravelCrm.Api.Controllers;

[ApiController]
[Authorize(Policy = "TenantAdmin")]
[Route("api/settings/data-reset")]
public sealed class DataResetController(ISender mediator) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Reset([FromBody] ResetTenantDataCommand cmd, CancellationToken ct)
    {
        var r = await mediator.Send(cmd, ct);
        return r.IsSuccess ? Ok(r.Value) : BadRequest(new { error = r.Error });
    }
}
