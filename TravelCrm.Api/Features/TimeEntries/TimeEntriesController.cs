using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Features.TimeEntries.Commands;
using TravelCrm.Api.Features.TimeEntries.Queries;

namespace TravelCrm.Api.Features.TimeEntries;

[ApiController]
[Authorize]
[Route("api/crm/tasks/{taskId:guid}/time-entries")]
public sealed class TimeEntriesController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(Guid taskId)
    {
        var r = await mediator.Send(new ListTimeEntriesQuery(taskId));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Forbid();
    }

    [HttpPost]
    public async Task<IActionResult> Log(Guid taskId, [FromBody] TimeEntryWriteRequest body)
    {
        var r = await mediator.Send(new LogTimeCommand(taskId, body.Minutes, body.Notes));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : BadRequest(new { error = r.Error });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid taskId, Guid id)
    {
        var r = await mediator.Send(new DeleteTimeEntryCommand(taskId, id));
        if (r.IsSuccess) return NoContent();
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Forbid();
    }
}

public sealed record TimeEntryWriteRequest(int Minutes, string? Notes);
