using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Features.Identity.Commands;
using TravelCrm.Api.Features.Identity.DTOs;
using TravelCrm.Api.Features.Identity.Queries;

namespace TravelCrm.Api.Controllers;

/// <summary>
/// Tenant-scoped Identity endpoints: users, roles, permissions, departments,
/// and the self-service profile. Gated by <c>TenantAdmin</c> policy; individual
/// handlers apply fine-grained <c>admin.users.*</c> / <c>admin.roles.*</c> /
/// <c>admin.departments.*</c> permission checks for defence-in-depth.
///
/// Self-service endpoints under <c>/me</c> use a relaxed <c>[Authorize]</c>
/// so every tenant user — not just admins — can read/update their own profile.
/// </summary>
[ApiController]
[Route("api/tenant/identity")]
public sealed class TenantIdentityController(IMediator mediator) : ControllerBase
{
    // ── Users ────────────────────────────────────────────────────────────────

    [HttpGet("users")]
    [Authorize(Policy = "TenantAdmin")]
    public async Task<IActionResult> ListUsers(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] Guid? roleId = null,
        [FromQuery] Guid? departmentId = null,
        [FromQuery] Guid? teamLeaderId = null,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(
            new ListUsersQuery(page, pageSize, search, status, roleId, departmentId, teamLeaderId), ct);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpGet("users/{id:guid}")]
    [Authorize(Policy = "TenantAdmin")]
    public async Task<IActionResult> GetUser(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new GetUserQuery(id), ct);
        return result.IsSuccess ? Ok(result.Value) : NotFound(new { error = result.Error });
    }

    [HttpPost("users")]
    [Authorize(Policy = "TenantAdmin")]
    public async Task<IActionResult> CreateUser(
        [FromBody] CreateUserRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateUserCommand(
            req.Email, req.FirstName, req.LastName, req.Phone, req.JobTitle,
            req.DepartmentId, req.RoleId, req.TeamLeaderId,
            req.Password, req.SendInvite), ct);
        return result.IsSuccess
            ? CreatedAtAction(nameof(GetUser), new { id = result.Value!.Id }, result.Value)
            : BadRequest(new { error = result.Error });
    }

    [HttpPut("users/{id:guid}")]
    [Authorize(Policy = "TenantAdmin")]
    public async Task<IActionResult> UpdateUser(
        Guid id, [FromBody] UpdateUserRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateUserCommand(
            id, req.FirstName, req.LastName, req.Phone, req.JobTitle,
            req.DepartmentId, req.RoleId, req.TeamLeaderId,
            req.PreferredLanguage, req.TimeZone, req.CurrencyCode), ct);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpDelete("users/{id:guid}")]
    [Authorize(Policy = "TenantAdmin")]
    public async Task<IActionResult> DeleteUser(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteUserCommand(id), ct);
        return result.IsSuccess ? NoContent() : BadRequest(new { error = result.Error });
    }

    [HttpPatch("users/{id:guid}/toggle-status")]
    [Authorize(Policy = "TenantAdmin")]
    public async Task<IActionResult> ToggleStatus(
        Guid id, [FromBody] ToggleUserStatusRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new ToggleUserStatusCommand(id, req.Activate), ct);
        return result.IsSuccess ? Ok() : BadRequest(new { error = result.Error });
    }

    [HttpPost("users/{id:guid}/set-password")]
    [Authorize(Policy = "TenantAdmin")]
    public async Task<IActionResult> SetPassword(
        Guid id, [FromBody] SetUserPasswordRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new SetUserPasswordCommand(id, req.NewPassword), ct);
        return result.IsSuccess ? Ok() : BadRequest(new { error = result.Error });
    }

    [HttpPost("users/{id:guid}/reset-link")]
    [Authorize(Policy = "TenantAdmin")]
    public async Task<IActionResult> SendResetLink(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new SendPasswordResetLinkCommand(id), ct);
        return result.IsSuccess ? Ok() : BadRequest(new { error = result.Error });
    }

    [HttpPost("users/{id:guid}/avatar")]
    [Authorize(Policy = "TenantAdmin")]
    [RequestSizeLimit(2 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 2 * 1024 * 1024)]
    public async Task<IActionResult> UploadAvatar(
        Guid id, IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "File is required." });
        await using var stream = file.OpenReadStream();
        var result = await mediator.Send(new UploadUserAvatarCommand(
            id, stream, file.ContentType, file.Length), ct);
        return result.IsSuccess ? Ok(new { url = result.Value }) : BadRequest(new { error = result.Error });
    }

    // ── Roles ────────────────────────────────────────────────────────────────

    [HttpGet("roles")]
    [Authorize]
    public async Task<IActionResult> ListRoles(CancellationToken ct)
    {
        var result = await mediator.Send(new ListRolesQuery(), ct);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpGet("roles/{id:guid}")]
    [Authorize(Policy = "TenantAdmin")]
    public async Task<IActionResult> GetRole(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new GetRoleWithPermissionsQuery(id), ct);
        return result.IsSuccess ? Ok(result.Value) : NotFound(new { error = result.Error });
    }

    [HttpPost("roles")]
    [Authorize(Policy = "TenantAdmin")]
    public async Task<IActionResult> CreateRole(
        [FromBody] CreateRoleRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateRoleCommand(req.Name, req.Description), ct);
        return result.IsSuccess
            ? CreatedAtAction(nameof(GetRole), new { id = result.Value!.Id }, result.Value)
            : BadRequest(new { error = result.Error });
    }

    [HttpPut("roles/{id:guid}")]
    [Authorize(Policy = "TenantAdmin")]
    public async Task<IActionResult> UpdateRole(
        Guid id, [FromBody] UpdateRoleRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateRoleCommand(id, req.Name, req.Description), ct);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpDelete("roles/{id:guid}")]
    [Authorize(Policy = "TenantAdmin")]
    public async Task<IActionResult> DeleteRole(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteRoleCommand(id), ct);
        return result.IsSuccess ? NoContent() : BadRequest(new { error = result.Error });
    }

    [HttpPatch("roles/{id:guid}/permissions")]
    [Authorize(Policy = "TenantAdmin")]
    public async Task<IActionResult> AssignPermissions(
        Guid id, [FromBody] AssignPermissionsRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(
            new AssignPermissionsToRoleCommand(id, req.PermissionIds), ct);
        return result.IsSuccess ? Ok() : BadRequest(new { error = result.Error });
    }

    // ── Permissions catalog ──────────────────────────────────────────────────

    [HttpGet("permissions")]
    [Authorize]
    public async Task<IActionResult> ListPermissions(CancellationToken ct)
    {
        var result = await mediator.Send(new ListPermissionsQuery(), ct);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    // ── Departments ──────────────────────────────────────────────────────────

    [HttpGet("departments")]
    [Authorize]
    public async Task<IActionResult> ListDepartments(CancellationToken ct)
    {
        var result = await mediator.Send(new ListDepartmentsQuery(), ct);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPost("departments")]
    [Authorize(Policy = "TenantAdmin")]
    public async Task<IActionResult> CreateDepartment(
        [FromBody] CreateDepartmentRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateDepartmentCommand(
            req.Name, req.Description, req.ManagerId), ct);
        return result.IsSuccess
            ? CreatedAtAction(nameof(ListDepartments), new { }, result.Value)
            : BadRequest(new { error = result.Error });
    }

    [HttpPut("departments/{id:guid}")]
    [Authorize(Policy = "TenantAdmin")]
    public async Task<IActionResult> UpdateDepartment(
        Guid id, [FromBody] UpdateDepartmentRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateDepartmentCommand(
            id, req.Name, req.Description, req.ManagerId), ct);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpDelete("departments/{id:guid}")]
    [Authorize(Policy = "TenantAdmin")]
    public async Task<IActionResult> DeleteDepartment(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteDepartmentCommand(id), ct);
        return result.IsSuccess ? NoContent() : BadRequest(new { error = result.Error });
    }

    // ── Self-service profile ────────────────────────────────────────────────

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> GetMyProfile(CancellationToken ct)
    {
        var result = await mediator.Send(new GetMyProfileQuery(), ct);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPut("me")]
    [Authorize]
    public async Task<IActionResult> UpdateMyProfile(
        [FromBody] UpdateMyProfileRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateMyProfileCommand(
            req.FirstName, req.LastName, req.Phone, req.JobTitle,
            req.PreferredLanguage, req.TimeZone, req.CurrencyCode), ct);
        return result.IsSuccess ? Ok() : BadRequest(new { error = result.Error });
    }

    [HttpPost("me/change-password")]
    [Authorize]
    public async Task<IActionResult> ChangeMyPassword(
        [FromBody] ChangeMyPasswordRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(
            new ChangeMyPasswordCommand(req.CurrentPassword, req.NewPassword), ct);
        return result.IsSuccess ? Ok() : BadRequest(new { error = result.Error });
    }
}
