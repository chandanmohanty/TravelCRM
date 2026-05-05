using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Features.Branding.Commands;
using TravelCrm.Api.Features.Branding.DTOs;
using TravelCrm.Api.Features.Branding.Queries;

namespace TravelCrm.Api.Controllers;

/// <summary>
/// Tenant-scoped brand settings CRUD. Gated by the <c>TenantAdmin</c> auth policy,
/// which requires the caller to hold an <c>Admin</c> or <c>SuperAdmin</c> role
/// claim for their tenant.
/// </summary>
[ApiController]
[Route("api/tenant/branding")]
[Authorize(Policy = "TenantAdmin")]
public sealed class TenantBrandController(IMediator mediator) : ControllerBase
{
    // GET /api/tenant/branding
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var result = await mediator.Send(new GetTenantBrandQuery(), ct);
        return result.IsSuccess
            ? Ok(result.Value)
            : BadRequest(new { error = result.Error });
    }

    // PUT /api/tenant/branding
    [HttpPut]
    public async Task<IActionResult> Update(
        [FromBody] UpdateBrandSettingsRequest req,
        CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateTenantBrandCommand(
            req.DisplayName, req.PrimaryColorHex, req.SupportEmail, req.SupportUrl), ct);

        return result.IsSuccess
            ? Ok(result.Value)
            : BadRequest(new { error = result.Error });
    }

    // POST /api/tenant/branding/assets?kind=LogoLight
    [HttpPost("assets")]
    [RequestSizeLimit(5 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 5 * 1024 * 1024)]
    public async Task<IActionResult> UploadAsset(
        [FromQuery] BrandAssetKind kind,
        IFormFile file,
        CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "File is required." });

        await using var stream = file.OpenReadStream();
        var result = await mediator.Send(new UploadBrandAssetCommand(
            BrandScope.Tenant, kind, stream, file.ContentType, file.Length), ct);

        return result.IsSuccess
            ? Ok(result.Value)
            : BadRequest(new { error = result.Error });
    }
}
