using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Features.Email.Commands;
using TravelCrm.Api.Features.Email.DTOs;
using TravelCrm.Api.Features.Email.Queries;
using TravelCrm.Api.Infrastructure.Multitenancy;

namespace TravelCrm.Api.Controllers;

[ApiController]
[Route("api/tenant/email")]
[Authorize(Policy = "TenantAdmin")]
public sealed class TenantEmailController(
    IMediator mediator,
    ITenantContext tenantContext) : ControllerBase
{
    private Guid TenantId =>
        tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context not resolved.");

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var result = await mediator.Send(new GetEmailConfigsQuery(TenantId), ct);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateEmailConfigRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateEmailConfigCommand(
            TenantId, req.Name, req.Provider, req.IsActive,
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
            id, TenantId, req.Name, req.Provider, req.IsActive,
            req.SmtpHost, req.SmtpPort, req.Username, req.Password, req.EnableSsl,
            req.SenderEmail, req.SenderName,
            req.ApiKey, req.ApiDomain, req.AwsRegion), ct);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteEmailConfigCommand(id, TenantId), ct);
        return result.IsSuccess ? NoContent() : BadRequest(new { error = result.Error });
    }

    [HttpPatch("{id:guid}/activate")]
    public async Task<IActionResult> Activate(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new SetActiveEmailConfigCommand(id, TenantId), ct);
        return result.IsSuccess ? Ok() : BadRequest(new { error = result.Error });
    }

    [HttpPost("{id:guid}/test")]
    public async Task<IActionResult> SendTestEmail(
        Guid id, [FromBody] SendTestEmailRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(
            new SendTestEmailCommand(id, TenantId, req.ToEmail), ct);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }
}
