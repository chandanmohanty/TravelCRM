using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Features.TaskTypes.Commands;
using TravelCrm.Api.Features.TaskTypes.Queries;

namespace TravelCrm.Api.Features.TaskTypes;

[ApiController]
[Authorize]
[Route("api/crm/task-types")]
public sealed class TaskTypesController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List()
    {
        var r = await mediator.Send(new ListTaskTypesQuery());
        return r.IsSuccess ? Ok(r.Value) : Forbid();
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] TaskTypeWriteRequest body)
    {
        var r = await mediator.Send(new CreateTaskTypeCommand(body.Name, body.Color));
        return r.IsSuccess ? Ok(r.Value) : BadRequest(new { error = r.Error });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] TaskTypeUpdateRequest body)
    {
        var r = await mediator.Send(new UpdateTaskTypeCommand(id, body.Name, body.Color, body.IsActive));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : BadRequest(new { error = r.Error });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var r = await mediator.Send(new DeleteTaskTypeCommand(id));
        if (r.IsSuccess) return NoContent();
        if (r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase))
            return NotFound(new { error = r.Error });
        if (r.Error!.Contains("in use", StringComparison.OrdinalIgnoreCase))
            return Conflict(new { error = r.Error });
        return Forbid();
    }
}

public sealed record TaskTypeWriteRequest(string Name, string Color);
public sealed record TaskTypeUpdateRequest(string Name, string Color, bool IsActive);
