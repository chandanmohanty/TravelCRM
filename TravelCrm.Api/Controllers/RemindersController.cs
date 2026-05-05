using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Features.Reminders.Commands;
using TravelCrm.Api.Features.Reminders.Queries;

namespace TravelCrm.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/reminders")]
public sealed class RemindersController(ISender mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var r = await mediator.Send(new ListRemindersQuery(), ct);
        return r.IsSuccess ? Ok(r.Value) : Forbid();
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var r = await mediator.Send(new GetReminderQuery(id), ct);
        return r.IsSuccess ? Ok(r.Value) : NotFound(new { error = r.Error });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateReminderCommand cmd, CancellationToken ct)
    {
        var r = await mediator.Send(cmd, ct);
        return r.IsSuccess ? Ok(r.Value) : BadRequest(new { error = r.Error });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateReminderCommand body, CancellationToken ct)
    {
        if (body.Id != id) return BadRequest(new { error = "Id mismatch between route and body." });
        var r = await mediator.Send(body, ct);
        return r.IsSuccess ? Ok(r.Value) : BadRequest(new { error = r.Error });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var r = await mediator.Send(new DeleteReminderCommand(id), ct);
        return r.IsSuccess ? NoContent() : BadRequest(new { error = r.Error });
    }
}
