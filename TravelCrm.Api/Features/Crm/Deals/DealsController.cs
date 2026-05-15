using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Crm.Deals.Commands;
using TravelCrm.Api.Features.Crm.Deals.Queries;
using TravelCrm.Api.Infrastructure.Subscriptions;

namespace TravelCrm.Api.Features.Crm.Deals;

[ApiController]
[Authorize]
[RequiresFeature(FeatureCatalog.Deals)]
[Route("api/crm/deals")]
public sealed class DealsController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] Guid? pipelineId,
        [FromQuery] Guid? stageId,
        [FromQuery] Guid? ownerUserId,
        [FromQuery] string? status,
        [FromQuery] bool? hasLead,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var r = await mediator.Send(
            new ListDealsQuery(pipelineId, stageId, ownerUserId, status, hasLead, search, page, pageSize), ct);
        return r.IsSuccess ? Ok(r.Value) : Forbid();
    }

    [HttpGet("kanban")]
    public async Task<IActionResult> Kanban(
        [FromQuery] Guid? pipelineId,
        CancellationToken ct)
    {
        var r = await mediator.Send(new GetKanbanQuery(pipelineId), ct);
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Forbid();
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var r = await mediator.Send(new GetDealQuery(id), ct);
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Forbid();
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateDealCommand body, CancellationToken ct)
    {
        var r = await mediator.Send(body, ct);
        return r.IsSuccess
            ? CreatedAtAction(nameof(Get), new { id = r.Value!.Id }, r.Value)
            : BadRequest(new { error = r.Error });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] DealUpdateRequest body, CancellationToken ct)
    {
        var r = await mediator.Send(new UpdateDealCommand(
            id, body.RowVersion, body.Title, body.Value, body.Currency,
            body.Probability, body.ExpectedCloseDate, body.Tags, body.Notes), ct);
        return MapDealResult(r);
    }

    [HttpPost("{id:guid}/move")]
    public async Task<IActionResult> Move(Guid id, [FromBody] DealMoveRequest body, CancellationToken ct)
    {
        var r = await mediator.Send(new MoveDealStageCommand(id, body.RowVersion, body.StageId, body.Note), ct);
        return MapDealResult(r);
    }

    [HttpPost("{id:guid}/reassign")]
    public async Task<IActionResult> Reassign(Guid id, [FromBody] DealReassignRequest body, CancellationToken ct)
    {
        var r = await mediator.Send(new ReassignDealCommand(id, body.RowVersion, body.OwnerUserId, body.Note), ct);
        return MapDealResult(r);
    }

    [HttpPost("{id:guid}/notes")]
    public async Task<IActionResult> AddNote(Guid id, [FromBody] DealNoteRequest body, CancellationToken ct)
    {
        var r = await mediator.Send(new AddDealNoteCommand(id, body.Note), ct);
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : BadRequest(new { error = r.Error });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var r = await mediator.Send(new DeleteDealCommand(id), ct);
        if (r.IsSuccess) return NoContent();
        if (r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase))
            return NotFound(new { error = r.Error });
        if (r.Error!.Contains("immutable", StringComparison.OrdinalIgnoreCase))
            return Conflict(new { error = r.Error });
        return BadRequest(new { error = r.Error });
    }

    private IActionResult MapDealResult(Result<DealDto> r)
    {
        if (r.IsSuccess) return Ok(r.Value);
        if (r.Error == "concurrency_conflict")
            return Conflict(new { error = "concurrency_conflict",
                message = "This deal was just updated by someone else. Refresh and retry." });
        if (r.Error == "invalid_row_version")
            return BadRequest(new { error = "invalid_row_version" });
        if (r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase))
            return NotFound(new { error = r.Error });
        if (r.Error == "Forbidden")
            return Forbid();
        return BadRequest(new { error = r.Error });
    }
}

public sealed record DealUpdateRequest(
    string RowVersion, string Title, decimal? Value, string Currency,
    int Probability, DateOnly? ExpectedCloseDate, IReadOnlyList<string>? Tags, string? Notes);
public sealed record DealMoveRequest(string RowVersion, Guid StageId, string? Note);
public sealed record DealReassignRequest(string RowVersion, Guid OwnerUserId, string? Note);
public sealed record DealNoteRequest(string Note);
