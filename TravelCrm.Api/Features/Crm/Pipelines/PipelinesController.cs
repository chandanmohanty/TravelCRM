using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Crm.Pipelines.Commands;
using TravelCrm.Api.Features.Crm.Pipelines.Queries;
using TravelCrm.Api.Infrastructure.Subscriptions;

namespace TravelCrm.Api.Features.Crm.Pipelines;

[ApiController]
[Authorize]
[RequiresFeature(FeatureCatalog.Deals)]
[Route("api/crm/pipelines")]
public sealed class PipelinesController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] bool includeInactive = false, CancellationToken ct = default)
    {
        var r = await mediator.Send(new ListPipelinesQuery(includeInactive), ct);
        return r.IsSuccess ? Ok(r.Value) : Forbid();
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var r = await mediator.Send(new GetPipelineQuery(id), ct);
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Forbid();
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePipelineCommand body, CancellationToken ct)
    {
        var r = await mediator.Send(body, ct);
        return r.IsSuccess
            ? CreatedAtAction(nameof(Get), new { id = r.Value!.Id }, r.Value)
            : BadRequest(new { error = r.Error });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePipelineRequest body, CancellationToken ct)
    {
        var r = await mediator.Send(new UpdatePipelineCommand(
            id, body.Name, body.Description, body.IsActive, body.IsDefault), ct);
        return r.IsSuccess
            ? Ok(new { id = r.Value })
            : (r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
                ? NotFound(new { error = r.Error }) : BadRequest(new { error = r.Error }));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var r = await mediator.Send(new DeletePipelineCommand(id), ct);
        if (r.IsSuccess) return NoContent();
        if (r.Error!.Contains("deal(s)", StringComparison.OrdinalIgnoreCase))
            return Conflict(new { error = r.Error });
        if (r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase))
            return NotFound(new { error = r.Error });
        return BadRequest(new { error = r.Error });
    }

    // ── Stages ──────────────────────────────────────────────────────────────

    [HttpPost("{pipelineId:guid}/stages")]
    public async Task<IActionResult> AddStage(Guid pipelineId, [FromBody] AddStageRequest body, CancellationToken ct)
    {
        var r = await mediator.Send(new AddStageCommand(
            pipelineId, body.Name, body.Probability, body.Kind, body.ColorHex, body.SortOrder), ct);
        return r.IsSuccess ? Ok(r.Value) : BadRequest(new { error = r.Error });
    }

    [HttpPut("{pipelineId:guid}/stages/{stageId:guid}")]
    public async Task<IActionResult> UpdateStage(Guid pipelineId, Guid stageId, [FromBody] UpdateStageRequest body, CancellationToken ct)
    {
        var r = await mediator.Send(new UpdateStageCommand(
            pipelineId, stageId, body.Name, body.Probability, body.Kind, body.ColorHex, body.IsActive), ct);
        return r.IsSuccess
            ? Ok(new { id = r.Value })
            : (r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
                ? NotFound(new { error = r.Error }) : BadRequest(new { error = r.Error }));
    }

    [HttpDelete("{pipelineId:guid}/stages/{stageId:guid}")]
    public async Task<IActionResult> DeleteStage(Guid pipelineId, Guid stageId, CancellationToken ct)
    {
        var r = await mediator.Send(new DeleteStageCommand(pipelineId, stageId), ct);
        if (r.IsSuccess) return NoContent();
        if (r.Error!.Contains("deal(s)", StringComparison.OrdinalIgnoreCase))
            return Conflict(new { error = r.Error });
        if (r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase))
            return NotFound(new { error = r.Error });
        return BadRequest(new { error = r.Error });
    }

    [HttpPut("{pipelineId:guid}/stages/reorder")]
    public async Task<IActionResult> ReorderStages(Guid pipelineId, [FromBody] ReorderStagesRequest body, CancellationToken ct)
    {
        var r = await mediator.Send(new ReorderStagesCommand(pipelineId, body.StageIds), ct);
        return r.IsSuccess
            ? NoContent()
            : BadRequest(new { error = r.Error });
    }
}

public sealed record UpdatePipelineRequest(string Name, string? Description, bool IsActive, bool IsDefault);
public sealed record AddStageRequest(string Name, int Probability, string Kind, string ColorHex, int? SortOrder);
public sealed record UpdateStageRequest(string Name, int Probability, string Kind, string ColorHex, bool IsActive);
public sealed record ReorderStagesRequest(IReadOnlyList<Guid> StageIds);
