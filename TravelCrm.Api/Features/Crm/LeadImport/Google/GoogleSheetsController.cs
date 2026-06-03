using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Crm.LeadImport.Queries;
using TravelCrm.Api.Infrastructure.Subscriptions;

namespace TravelCrm.Api.Features.Crm.LeadImport.Google;

[Authorize]
[ApiController]
[RequiresFeature(FeatureCatalog.LeadImport)]
[Route("api/crm/leads/import/google/sheets")]
public sealed class GoogleSheetsController(IMediator mediator) : ControllerBase
{
    [HttpGet("{spreadsheetId}/tabs")]
    public async Task<IActionResult> Tabs(string spreadsheetId, CancellationToken ct)
    {
        var r = await mediator.Send(new ListSheetTabsQuery(spreadsheetId), ct);
        return r.IsSuccess ? Ok(r.Value) : BadRequest(new { error = r.Error });
    }

    [HttpGet("{spreadsheetId}/headers")]
    public async Task<IActionResult> Headers(string spreadsheetId, [FromQuery] string tab, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tab))
            return BadRequest(new { error = "Query parameter 'tab' is required." });
        var r = await mediator.Send(new GetSheetHeadersQuery(spreadsheetId, tab), ct);
        return r.IsSuccess ? Ok(r.Value) : BadRequest(new { error = r.Error });
    }
}
