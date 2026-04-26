using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Features.Inventory.Calendar.Commands;
using TravelCrm.Api.Features.Inventory.Calendar.Queries;

namespace TravelCrm.Api.Features.Inventory.Calendar;

[ApiController]
[Authorize]
[Route("api/inventory/resources/{resourceId:guid}/calendar")]
public sealed class CalendarController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(Guid resourceId, [FromQuery] DateOnly from, [FromQuery] DateOnly to)
    {
        var r = await mediator.Send(new CheckAvailabilityQuery(resourceId, from, to));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Forbid();
    }

    [HttpPost("capacity")]
    public async Task<IActionResult> SetCapacity(Guid resourceId, [FromBody] SetCapacityRequest body)
    {
        var r = await mediator.Send(
            new SetCapacityCommand(resourceId, body.Date, body.Slot, body.Capacity, body.Notes));
        if (r.IsSuccess) return Ok();
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : BadRequest(new { error = r.Error });
    }

    [HttpPost("block")]
    public async Task<IActionResult> Block(Guid resourceId, [FromBody] BlockDateRequest body)
    {
        var r = await mediator.Send(new BlockDateCommand(resourceId, body.Date, body.Slot, body.Notes));
        if (r.IsSuccess) return Ok();
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : BadRequest(new { error = r.Error });
    }

    [HttpPost("unblock")]
    public async Task<IActionResult> Unblock(Guid resourceId, [FromBody] UnblockDateRequest body)
    {
        var r = await mediator.Send(new UnblockDateCommand(resourceId, body.Date, body.Slot));
        if (r.IsSuccess) return Ok();
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Forbid();
    }
}

public sealed record SetCapacityRequest(DateOnly Date, ResourceCalendarSlot? Slot, int Capacity, string? Notes);
public sealed record BlockDateRequest(DateOnly Date, ResourceCalendarSlot? Slot, string? Notes);
public sealed record UnblockDateRequest(DateOnly Date, ResourceCalendarSlot? Slot);
