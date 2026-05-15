// TravelCrm.Api/Features/Leads/LeadsController.cs
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Leads.Commands;
using TravelCrm.Api.Features.Leads.Queries;

namespace TravelCrm.Api.Features.Leads;

[Authorize]
[ApiController]
[Route("api/crm/leads")]
public sealed class LeadsController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] int    pageSize = 20,
        [FromQuery] int    page     = 1,
        [FromQuery] bool?  hasDeals = null,
        CancellationToken ct = default)
    {
        var r = await mediator.Send(new ListLeadsQuery(pageSize, page, hasDeals), ct);
        return r.IsSuccess ? Ok(r.Value) : Forbid();
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var r = await mediator.Send(new GetLeadQuery(id), ct);
        if (!r.IsSuccess)
            return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
                ? NotFound(new { error = r.Error })
                : Forbid();
        return Ok(r.Value);
    }

    [HttpPost]
    public async Task<IActionResult> Create(LeadUpsertRequest body, CancellationToken ct)
    {
        var r = await mediator.Send(new CreateLeadCommand(
            body.FirstName, body.LastName, body.Email,
            body.Phone ?? string.Empty, body.Company ?? string.Empty,
            body.JobTitle ?? string.Empty, body.Status, body.Source,
            body.Score, body.AssignedTo ?? string.Empty,
            body.Tags ?? Enumerable.Empty<string>(),
            body.Notes ?? string.Empty, body.EstimatedValue), ct);

        return r.IsSuccess
            ? CreatedAtAction(nameof(Get), new { id = r.Value!.Id }, r.Value)
            : BadRequest(new { error = r.Error });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, LeadUpsertRequest body, CancellationToken ct)
    {
        var r = await mediator.Send(new UpdateLeadCommand(
            id, body.FirstName, body.LastName, body.Email,
            body.Phone ?? string.Empty, body.Company ?? string.Empty,
            body.JobTitle ?? string.Empty, body.Status, body.Source,
            body.Score, body.AssignedTo ?? string.Empty,
            body.Tags ?? Enumerable.Empty<string>(),
            body.Notes ?? string.Empty, body.EstimatedValue), ct);

        if (!r.IsSuccess)
            return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
                ? NotFound(new { error = r.Error })
                : BadRequest(new { error = r.Error });
        return Ok(r.Value);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var r = await mediator.Send(new DeleteLeadCommand(id), ct);
        if (!r.IsSuccess)
            return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
                ? NotFound(new { error = r.Error })
                : BadRequest(new { error = r.Error });
        return NoContent();
    }

}

public sealed record LeadUpsertRequest(
    string               FirstName,
    string               LastName,
    string               Email,
    string?              Phone,
    string?              Company,
    string?              JobTitle,
    LeadStatus           Status,
    LeadSource           Source,
    int                  Score,
    string?              AssignedTo,
    IEnumerable<string>? Tags,
    string?              Notes,
    decimal?             EstimatedValue
);
