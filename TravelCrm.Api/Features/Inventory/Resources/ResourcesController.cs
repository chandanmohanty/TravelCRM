using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Features.Inventory.Resources.Commands;
using TravelCrm.Api.Features.Inventory.Resources.Queries;

namespace TravelCrm.Api.Features.Inventory.Resources;

[ApiController]
[Authorize]
[Route("api/inventory/resources")]
public sealed class ResourcesController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? type,
        [FromQuery] string? status,
        [FromQuery] Guid? supplierId)
    {
        var r = await mediator.Send(new ListResourcesQuery(type, status, supplierId));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("Tenant", StringComparison.OrdinalIgnoreCase)
            ? BadRequest(new { error = r.Error })
            : Forbid();
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var r = await mediator.Send(new GetResourceQuery(id));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Forbid();
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ResourceCreateRequest body)
    {
        var r = await mediator.Send(new CreateResourceCommand(
            body.Kind, body.Type, body.Name, body.SupplierId,
            body.DefaultCapacity, body.AssetCode, body.Metadata));
        return r.IsSuccess
            ? CreatedAtAction(nameof(Get), new { id = r.Value!.Id }, r.Value)
            : BadRequest(new { error = r.Error });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] ResourceUpdateRequest body)
    {
        var r = await mediator.Send(new UpdateResourceCommand(
            id, body.Name, body.SupplierId, body.DefaultCapacity, body.AssetCode, body.Metadata));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : BadRequest(new { error = r.Error });
    }

    [HttpPost("{id:guid}/block")]
    public async Task<IActionResult> Block(Guid id)
    {
        var r = await mediator.Send(new BlockResourceCommand(id));
        if (r.IsSuccess) return Ok();
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Forbid();
    }

    [HttpPost("{id:guid}/unblock")]
    public async Task<IActionResult> Unblock(Guid id)
    {
        var r = await mediator.Send(new UnblockResourceCommand(id));
        if (r.IsSuccess) return Ok();
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Forbid();
    }
}

public sealed record ResourceCreateRequest(
    string Kind, string Type, string Name,
    Guid? SupplierId, int? DefaultCapacity, string? AssetCode, string? Metadata);

public sealed record ResourceUpdateRequest(
    string Name, Guid? SupplierId,
    int? DefaultCapacity, string? AssetCode, string? Metadata);
