using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Features.Branding.Commands;
using TravelCrm.Api.Features.Branding.DTOs;
using TravelCrm.Api.Features.Branding.Queries;

namespace TravelCrm.Api.Controllers.Platform;

/// <summary>
/// Application-wide brand settings CRUD, owned by the platform administrator.
/// Values set here are used as the fallback brand for tenants that haven't
/// configured their own overrides.
/// </summary>
[ApiController]
[Route("api/platform/branding")]
[Authorize(Policy = "PlatformAdmin")]
public sealed class PlatformBrandController(IMediator mediator) : ControllerBase
{
    // GET /api/platform/branding
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var result = await mediator.Send(new GetPlatformBrandQuery(), ct);
        return result.IsSuccess
            ? Ok(result.Value)
            : BadRequest(new { error = result.Error });
    }

    // PUT /api/platform/branding
    [HttpPut]
    public async Task<IActionResult> Update(
        [FromBody] UpdateBrandSettingsRequest req,
        CancellationToken ct)
    {
        var result = await mediator.Send(new UpdatePlatformBrandCommand(
            req.DisplayName, req.PrimaryColorHex, req.SupportEmail, req.SupportUrl), ct);

        return result.IsSuccess
            ? Ok(result.Value)
            : BadRequest(new { error = result.Error });
    }

    // POST /api/platform/branding/assets?kind=LogoLight
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
            BrandScope.Platform, kind, stream, file.ContentType, file.Length), ct);

        return result.IsSuccess
            ? Ok(result.Value)
            : BadRequest(new { error = result.Error });
    }
}
