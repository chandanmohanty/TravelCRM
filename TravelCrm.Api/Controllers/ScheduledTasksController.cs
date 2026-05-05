using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Features.Jobs.Commands;
using TravelCrm.Api.Features.Jobs.Queries;

namespace TravelCrm.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/scheduled-tasks")]
public sealed class ScheduledTasksController(ISender mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var r = await mediator.Send(new ListRecurringJobsQuery(), ct);
        return r.IsSuccess ? Ok(r.Value) : Forbid();
    }

    [HttpPost("{jobId}/run")]
    public async Task<IActionResult> Run(string jobId, CancellationToken ct)
    {
        var r = await mediator.Send(new TriggerRecurringJobCommand(jobId), ct);
        return r.IsSuccess
            ? Ok(new { message = $"Job '{jobId}' has been enqueued." })
            : BadRequest(new { error = r.Error });
    }
}
