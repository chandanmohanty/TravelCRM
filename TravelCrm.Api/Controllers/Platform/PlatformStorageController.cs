using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Features.Storage.Commands;
using TravelCrm.Api.Features.Storage.DTOs;
using TravelCrm.Api.Features.Storage.Queries;

namespace TravelCrm.Api.Controllers.Platform;

/// <summary>
/// Platform-scoped storage configuration CRUD. Configs created here serve as
/// the default for all tenants that haven't set up their own storage overrides.
/// </summary>
[ApiController]
[Route("api/platform/storage")]
[Authorize(Policy = "PlatformAdmin")]
public sealed class PlatformStorageController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var result = await mediator.Send(new GetStorageConfigsQuery(TenantId: null), ct);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateStorageConfigRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateStorageConfigCommand(
            TenantId: null, req.Name, req.Driver, req.IsActive,
            req.BasePath, req.AwsAccessKey, req.AwsSecretKey, req.AwsRegion,
            req.AwsBucket, req.AwsEndpoint, req.AzureConnectionString,
            req.AzureContainerName, req.GcsServiceAccountJson, req.GcsBucket,
            req.MaxFileSizeBytes, req.AllowedContentTypes), ct);
        return result.IsSuccess
            ? CreatedAtAction(nameof(GetAll), new { }, result.Value)
            : BadRequest(new { error = result.Error });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id, [FromBody] UpdateStorageConfigRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateStorageConfigCommand(
            id, TenantId: null, req.Name, req.Driver, req.IsActive,
            req.BasePath, req.AwsAccessKey, req.AwsSecretKey, req.AwsRegion,
            req.AwsBucket, req.AwsEndpoint, req.AzureConnectionString,
            req.AzureContainerName, req.GcsServiceAccountJson, req.GcsBucket,
            req.MaxFileSizeBytes, req.AllowedContentTypes), ct);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteStorageConfigCommand(id, TenantId: null), ct);
        return result.IsSuccess ? NoContent() : BadRequest(new { error = result.Error });
    }

    [HttpPatch("{id:guid}/activate")]
    public async Task<IActionResult> Activate(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new SetActiveStorageConfigCommand(id, TenantId: null), ct);
        return result.IsSuccess ? Ok() : BadRequest(new { error = result.Error });
    }

    [HttpPost("{id:guid}/test")]
    public async Task<IActionResult> TestConnection(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new TestStorageConnectionCommand(id, TenantId: null), ct);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }
}
