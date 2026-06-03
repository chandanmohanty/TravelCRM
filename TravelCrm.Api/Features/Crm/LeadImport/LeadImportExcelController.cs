using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Crm.LeadImport.Commands;
using TravelCrm.Api.Infrastructure.Subscriptions;

namespace TravelCrm.Api.Features.Crm.LeadImport;

[Authorize]
[ApiController]
[RequiresFeature(FeatureCatalog.LeadImport)]
[Route("api/crm/leads/import/excel")]
public sealed class LeadImportExcelController(IMediator mediator) : ControllerBase
{
    [HttpPost("parse")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<IActionResult> Parse([FromForm] IFormFile file, CancellationToken ct)
    {
        var r = await mediator.Send(new ParseExcelCommand(file), ct);
        return r.IsSuccess ? Ok(r.Value) : BadRequest(new { error = r.Error });
    }

    public sealed record MapBody(Guid StagingId, Dictionary<string, string> Mapping, string? MatchKeyField);

    [HttpPost("preview")]
    public async Task<IActionResult> Preview(MapBody body, CancellationToken ct)
    {
        var r = await mediator.Send(
            new PreviewImportCommand(body.StagingId, body.Mapping, body.MatchKeyField ?? "email"), ct);
        return r.IsSuccess ? Ok(r.Value) : BadRequest(new { error = r.Error });
    }

    [HttpPost("commit")]
    public async Task<IActionResult> Commit(MapBody body, CancellationToken ct)
    {
        var r = await mediator.Send(
            new CommitExcelImportCommand(body.StagingId, body.Mapping, body.MatchKeyField ?? "email"), ct);
        return r.IsSuccess ? Ok(r.Value) : BadRequest(new { error = r.Error });
    }
}
