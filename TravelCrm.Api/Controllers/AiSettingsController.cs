using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Features.Settings.Ai.Commands;
using TravelCrm.Api.Features.Settings.Ai.Queries;

namespace TravelCrm.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/settings/ai")]
public sealed class AiSettingsController(ISender mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var r = await mediator.Send(new ListAiProviderConfigsQuery(), ct);
        return r.IsSuccess ? Ok(r.Value) : Forbid();
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var r = await mediator.Send(new GetAiProviderConfigQuery(id), ct);
        return r.IsSuccess ? Ok(r.Value) : NotFound(new { error = r.Error });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateAiProviderConfigCommand cmd, CancellationToken ct)
    {
        var r = await mediator.Send(cmd, ct);
        return r.IsSuccess ? Ok(r.Value) : BadRequest(new { error = r.Error });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateAiProviderConfigCommand body, CancellationToken ct)
    {
        if (body.Id != id) return BadRequest(new { error = "Id mismatch between route and body." });
        var r = await mediator.Send(body, ct);
        return r.IsSuccess ? Ok(r.Value) : BadRequest(new { error = r.Error });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var r = await mediator.Send(new DeleteAiProviderConfigCommand(id), ct);
        return r.IsSuccess ? NoContent() : BadRequest(new { error = r.Error });
    }

    [HttpPost("{id:guid}/activate")]
    public async Task<IActionResult> SetActive(Guid id, CancellationToken ct)
    {
        var r = await mediator.Send(new SetActiveAiProviderConfigCommand(id), ct);
        return r.IsSuccess ? Ok(new { message = "Config activated." }) : BadRequest(new { error = r.Error });
    }

    [HttpPost("{id:guid}/test")]
    public async Task<IActionResult> Test(Guid id, CancellationToken ct)
    {
        var r = await mediator.Send(new TestAiProviderConfigCommand(id), ct);
        return r.IsSuccess ? Ok(r.Value) : BadRequest(new { error = r.Error });
    }
}
