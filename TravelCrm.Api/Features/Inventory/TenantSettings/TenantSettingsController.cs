using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Features.Inventory.TenantSettingsFeature.Commands;
using TravelCrm.Api.Features.Inventory.TenantSettingsFeature.Queries;

namespace TravelCrm.Api.Features.Inventory.TenantSettingsFeature;

[ApiController]
[Authorize]
[Route("api/inventory/tenant-settings")]
public sealed class TenantSettingsController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var r = await mediator.Send(new GetTenantSettingsQuery());
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("Tenant", StringComparison.OrdinalIgnoreCase)
            ? BadRequest(new { error = r.Error })
            : Forbid();
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] UpdateTenantSettingsRequest body)
    {
        var r = await mediator.Send(new UpdateTenantSettingsCommand(body.HoldTtlHours));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("Tenant", StringComparison.OrdinalIgnoreCase)
            ? BadRequest(new { error = r.Error })
            : Forbid();
    }
}

public sealed record UpdateTenantSettingsRequest(int HoldTtlHours);
