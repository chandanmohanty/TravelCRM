using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Features.Email.Commands;
using TravelCrm.Api.Features.Email.DTOs;
using TravelCrm.Api.Features.Email.Queries;

namespace TravelCrm.Api.Controllers.Platform;

[ApiController]
[Route("api/platform/email")]
[Authorize(Policy = "PlatformAdmin")]
public sealed class PlatformEmailController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var result = await mediator.Send(new GetEmailConfigsQuery(TenantId: null), ct);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateEmailConfigRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateEmailConfigCommand(
            TenantId: null, req.Name, req.Provider, req.IsActive,
            req.SmtpHost, req.SmtpPort, req.Username, req.Password, req.EnableSsl,
            req.SenderEmail, req.SenderName,
            req.ApiKey, req.ApiDomain, req.AwsRegion), ct);
        return result.IsSuccess
            ? CreatedAtAction(nameof(GetAll), new { }, result.Value)
            : BadRequest(new { error = result.Error });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id, [FromBody] UpdateEmailConfigRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateEmailConfigCommand(
            id, TenantId: null, req.Name, req.Provider, req.IsActive,
            req.SmtpHost, req.SmtpPort, req.Username, req.Password, req.EnableSsl,
            req.SenderEmail, req.SenderName,
            req.ApiKey, req.ApiDomain, req.AwsRegion), ct);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteEmailConfigCommand(id, TenantId: null), ct);
        return result.IsSuccess ? NoContent() : BadRequest(new { error = result.Error });
    }

    [HttpPatch("{id:guid}/activate")]
    public async Task<IActionResult> Activate(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new SetActiveEmailConfigCommand(id, TenantId: null), ct);
        return result.IsSuccess ? Ok() : BadRequest(new { error = result.Error });
    }

    [HttpPost("{id:guid}/test")]
    public async Task<IActionResult> SendTestEmail(
        Guid id, [FromBody] SendTestEmailRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(
            new SendTestEmailCommand(id, TenantId: null, req.ToEmail), ct);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }
}
