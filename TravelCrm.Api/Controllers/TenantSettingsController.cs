using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Features.Settings.Invoice.Commands;
using TravelCrm.Api.Features.Settings.Invoice.Queries;
using TravelCrm.Api.Features.Settings.System.Commands;
using TravelCrm.Api.Features.Settings.System.Queries;

namespace TravelCrm.Api.Controllers;

/// <summary>
/// Tenant-admin settings endpoints that don't have their own controller yet
/// (System + Invoice). Brand / Storage / Email / Identity each own theirs.
/// </summary>
[ApiController]
[Authorize]
[Route("api/settings")]
public sealed class TenantSettingsController(ISender mediator) : ControllerBase
{
    // ── System settings ──────────────────────────────────────────────────────
    [HttpGet("system")]
    public async Task<IActionResult> GetSystem(CancellationToken ct)
    {
        var r = await mediator.Send(new GetSystemSettingsQuery(), ct);
        return r.IsSuccess ? Ok(r.Value) : BadRequest(new { error = r.Error });
    }

    [HttpPut("system")]
    public async Task<IActionResult> UpdateSystem([FromBody] UpdateSystemSettingsCommand cmd, CancellationToken ct)
    {
        var r = await mediator.Send(cmd, ct);
        return r.IsSuccess ? Ok(r.Value) : BadRequest(new { error = r.Error });
    }

    // ── Invoice settings ─────────────────────────────────────────────────────
    [HttpGet("invoice")]
    public async Task<IActionResult> GetInvoice(CancellationToken ct)
    {
        var r = await mediator.Send(new GetInvoiceSettingsQuery(), ct);
        return r.IsSuccess ? Ok(r.Value) : BadRequest(new { error = r.Error });
    }

    [HttpPut("invoice")]
    public async Task<IActionResult> UpdateInvoice([FromBody] UpdateInvoiceSettingsCommand cmd, CancellationToken ct)
    {
        var r = await mediator.Send(cmd, ct);
        return r.IsSuccess ? Ok(r.Value) : BadRequest(new { error = r.Error });
    }
}
