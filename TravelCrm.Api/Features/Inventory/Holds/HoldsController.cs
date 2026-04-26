using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Features.Inventory.Holds.Commands;
using TravelCrm.Api.Features.Inventory.Holds.Queries;

namespace TravelCrm.Api.Features.Inventory.Holds;

[ApiController]
[Authorize]
[Route("api/inventory/holds")]
public sealed class HoldsController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] Guid? resourceId,
        [FromQuery] string? status,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to)
    {
        var r = await mediator.Send(new ListHoldsQuery(resourceId, status, from, to));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("Tenant", StringComparison.OrdinalIgnoreCase)
            ? BadRequest(new { error = r.Error })
            : Forbid();
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var r = await mediator.Send(new GetHoldQuery(id));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Forbid();
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateHoldRequest body)
    {
        var r = await mediator.Send(new CreateHoldCommand(
            body.ResourceId, body.StartDate, body.EndDate, body.Slot, body.Quantity, body.Notes));
        return r.IsSuccess
            ? CreatedAtAction(nameof(Get), new { id = r.Value!.Id }, r.Value)
            : BadRequest(new { error = r.Error });
    }

    [HttpPost("{id:guid}/confirm")]
    public async Task<IActionResult> Confirm(Guid id, [FromBody] ConfirmHoldRequest body)
    {
        var r = await mediator.Send(new ConfirmHoldCommand(id, body.BookingRef));
        if (r.IsSuccess) return Ok(r.Value);
        if (r.Error!.Contains("expired", StringComparison.OrdinalIgnoreCase))
            return StatusCode(410, new { error = r.Error });
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Conflict(new { error = r.Error });
    }

    [HttpPost("{id:guid}/release")]
    public async Task<IActionResult> Release(Guid id, [FromBody] ReleaseHoldRequest? body)
    {
        var r = await mediator.Send(new ReleaseHoldCommand(id, body?.Notes));
        if (r.IsSuccess) return NoContent();
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Conflict(new { error = r.Error });
    }

    [HttpPost("{id:guid}/extend")]
    public async Task<IActionResult> Extend(Guid id)
    {
        var r = await mediator.Send(new ExtendHoldCommand(id));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Conflict(new { error = r.Error });
    }
}

public sealed record CreateHoldRequest(
    Guid ResourceId, DateOnly StartDate, DateOnly EndDate,
    ResourceCalendarSlot? Slot, int Quantity, string? Notes);
public sealed record ConfirmHoldRequest(string? BookingRef);
public sealed record ReleaseHoldRequest(string? Notes);
