using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Crm.LeadImport.Commands;
using TravelCrm.Api.Features.Crm.LeadImport.Queries;
using TravelCrm.Api.Infrastructure.Subscriptions;

namespace TravelCrm.Api.Features.Crm.LeadImport;

[Authorize]
[ApiController]
[RequiresFeature(FeatureCatalog.LeadImport)]
[Route("api/crm/lead-sources")]
public sealed class LeadSourcesController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var r = await mediator.Send(new ListLeadImportSourcesQuery(), ct);
        return r.IsSuccess ? Ok(r.Value) : Forbid();
    }

    public sealed record CreateBody(
        string DisplayName,
        string SpreadsheetId,
        string SheetName,
        Dictionary<string, string> ColumnMapping,
        string MatchKeyField,
        string SyncCadence);

    [HttpPost]
    public async Task<IActionResult> Create(CreateBody b, CancellationToken ct)
    {
        var r = await mediator.Send(new CreateLeadImportSourceCommand(
            b.DisplayName, b.SpreadsheetId, b.SheetName,
            b.ColumnMapping ?? new Dictionary<string, string>(),
            b.MatchKeyField, b.SyncCadence), ct);
        return r.IsSuccess
            ? Ok(r.Value)
            : BadRequest(new { error = r.Error });
    }

    public sealed record UpdateBody(
        string RowVersion,
        string DisplayName,
        string SheetName,
        Dictionary<string, string> ColumnMapping,
        string MatchKeyField,
        string SyncCadence);

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateBody b, CancellationToken ct)
    {
        var r = await mediator.Send(new UpdateLeadImportSourceCommand(
            id, b.RowVersion, b.DisplayName, b.SheetName,
            b.ColumnMapping ?? new Dictionary<string, string>(),
            b.MatchKeyField, b.SyncCadence), ct);
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : BadRequest(new { error = r.Error });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var r = await mediator.Send(new DeleteLeadImportSourceCommand(id), ct);
        if (r.IsSuccess) return NoContent();
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : BadRequest(new { error = r.Error });
    }

    [HttpPost("{id:guid}/sync")]
    public async Task<IActionResult> Sync(Guid id, CancellationToken ct)
    {
        var r = await mediator.Send(new RunLeadImportSyncCommand(id), ct);
        if (r.IsSuccess) return Accepted();
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : BadRequest(new { error = r.Error });
    }

    [HttpPost("{id:guid}/pause")]
    public async Task<IActionResult> Pause(Guid id, CancellationToken ct)
    {
        var r = await mediator.Send(new SetLeadImportSourceStatusCommand(id, Pause: true), ct);
        if (r.IsSuccess) return Ok();
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : BadRequest(new { error = r.Error });
    }

    [HttpPost("{id:guid}/resume")]
    public async Task<IActionResult> Resume(Guid id, CancellationToken ct)
    {
        var r = await mediator.Send(new SetLeadImportSourceStatusCommand(id, Pause: false), ct);
        if (r.IsSuccess) return Ok();
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : BadRequest(new { error = r.Error });
    }
}
