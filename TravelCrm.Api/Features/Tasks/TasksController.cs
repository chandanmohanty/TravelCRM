using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Features.Tasks.Commands;
using TravelCrm.Api.Features.Tasks.Queries;

namespace TravelCrm.Api.Features.Tasks;

[ApiController]
[Authorize]
[Route("api/crm/tasks")]
public sealed class TasksController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] string? priority,
        [FromQuery] Guid? assignedToUserId,
        [FromQuery] Guid? taskTypeId,
        [FromQuery] bool includeDeleted = false)
    {
        var r = await mediator.Send(new ListTasksQuery(
            search, status, priority, assignedToUserId, taskTypeId, includeDeleted));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("Tenant", StringComparison.OrdinalIgnoreCase)
            ? BadRequest(new { error = r.Error })
            : Forbid();
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var r = await mediator.Send(new GetTaskQuery(id));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Forbid();
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] TaskWriteRequest body)
    {
        var r = await mediator.Send(new CreateTaskCommand(
            body.Title, body.Description, body.Status, body.Priority,
            body.TaskTypeId, body.AssignedToUserId, body.ParentTaskId,
            body.DueDate, body.EstimatedMinutes));
        return r.IsSuccess
            ? CreatedAtAction(nameof(Get), new { id = r.Value!.Id }, r.Value)
            : BadRequest(new { error = r.Error });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] TaskWriteRequest body)
    {
        var r = await mediator.Send(new UpdateTaskCommand(
            id, body.Title, body.Description, body.Status, body.Priority,
            body.TaskTypeId, body.AssignedToUserId, body.ParentTaskId,
            body.DueDate, body.EstimatedMinutes));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : BadRequest(new { error = r.Error });
    }

    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] StatusUpdateRequest body)
    {
        var r = await mediator.Send(new UpdateTaskStatusCommand(id, body.Status));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : BadRequest(new { error = r.Error });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var r = await mediator.Send(new DeleteTaskCommand(id));
        if (r.IsSuccess) return NoContent();
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Forbid();
    }

    [HttpPost("{id:guid}/restore")]
    public async Task<IActionResult> Restore(Guid id)
    {
        var r = await mediator.Send(new RestoreTaskCommand(id));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Forbid();
    }
}

public sealed record TaskWriteRequest(
    string Title,
    string? Description,
    string Status,
    string Priority,
    Guid? TaskTypeId,
    Guid? AssignedToUserId,
    Guid? ParentTaskId,
    DateTime? DueDate,
    int? EstimatedMinutes
);

public sealed record StatusUpdateRequest(string Status);
