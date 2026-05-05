using MediatR;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Features.Auth.Commands.Login;
using TravelCrm.Api.Features.Auth.Commands.Refresh;
using TravelCrm.Api.Features.Auth.DTOs;
using TravelCrm.Api.Features.Identity.Commands;
using TravelCrm.Api.Features.Identity.DTOs;

namespace TravelCrm.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(ISender mediator) : ControllerBase
{
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req, CancellationToken ct)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var result = await mediator.Send(new LoginCommand(req.Email, req.Password, ip), ct);
        return result.IsSuccess ? Ok(result.Value) : Unauthorized(new { error = result.Error });
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshRequest req, CancellationToken ct)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var result = await mediator.Send(new RefreshCommand(req.RefreshToken, ip), ct);
        return result.IsSuccess ? Ok(result.Value) : Unauthorized(new { error = result.Error });
    }

    /// <summary>Self-service password reset (step 1): request a reset email.</summary>
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword(
        [FromBody] ForgotPasswordRequest req, CancellationToken ct)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        // Always returns success (enumeration-safe)
        await mediator.Send(new ForgotPasswordCommand(req.Email, req.TenantSlug, ip), ct);
        return Ok(new { message = "If an account exists for this email, a reset link has been sent." });
    }

    /// <summary>Self-service password reset (step 2): consume the link, set new password.</summary>
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword(
        [FromBody] ResetPasswordRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(
            new ResetPasswordCommand(req.Uid, req.Token, req.NewPassword), ct);
        return result.IsSuccess ? Ok() : BadRequest(new { error = result.Error });
    }
}
