using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Features.Platform.Commands;
using TravelCrm.Api.Features.Platform.DTOs;
using TravelCrm.Api.Features.Platform.Queries;

namespace TravelCrm.Api.Controllers.Platform;

[ApiController]
[Route("api/platform/tenants")]
[Authorize(Policy = "PlatformAdmin")]
public sealed class PlatformTenantsController(IMediator mediator) : ControllerBase
{
    // GET api/platform/tenants?page=1&pageSize=20&search=acme&planFilter=Enterprise
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int    page       = 1,
        [FromQuery] int    pageSize   = 20,
        [FromQuery] string search     = "",
        [FromQuery] string planFilter = "",
        [FromQuery] bool?  activeOnly = null,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(
            new GetTenantsQuery(page, pageSize, search, planFilter, activeOnly), ct);
        return Ok(result);
    }

    // POST api/platform/tenants
    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateTenantRequest req,
        CancellationToken ct = default)
    {
        // Default admin password from body if not provided separately
        var cmd = new CreateTenantCommand(
            req.Name, req.Slug, req.Plan,
            AdminEmail: req.AdminEmail,
            AdminFirstName: req.AdminFirstName,
            AdminLastName: req.AdminLastName,
            AdminPassword: req.AdminPassword);

        var result = await mediator.Send(cmd, ct);
        return result.IsSuccess
            ? CreatedAtAction(nameof(GetAll), new { }, result.Value)
            : BadRequest(new { error = result.Error });
    }

    // PUT api/platform/tenants/{id}
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateTenantRequest req,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(new UpdateTenantCommand(id, req.Name, req.Slug, req.Plan), ct);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    // PATCH api/platform/tenants/{id}/toggle
    [HttpPatch("{id:guid}/toggle")]
    public async Task<IActionResult> Toggle(Guid id, CancellationToken ct = default)
    {
        var result = await mediator.Send(new ToggleTenantStatusCommand(id), ct);
        return result.IsSuccess
            ? Ok(new { isActive = result.Value })
            : NotFound(new { error = result.Error });
    }
}
