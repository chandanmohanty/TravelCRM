using System.Text.RegularExpressions;
using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Identity.DTOs;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Identity.Commands;

public sealed record CreateRoleCommand(string Name, string? Description) : IRequest<Result<RoleDto>>;

public sealed class CreateRoleCommandValidator : AbstractValidator<CreateRoleCommand>
{
    public CreateRoleCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Description).MaximumLength(500);
    }
}

public sealed class CreateRoleCommandHandler(
    ApplicationDbContext db,
    RoleManager<ApplicationRole> roleManager,
    ITenantContext tenantContext,
    ICurrentUser currentUser,
    ILogger<CreateRoleCommandHandler> logger)
    : IRequestHandler<CreateRoleCommand, Result<RoleDto>>
{
    public async Task<Result<RoleDto>> Handle(CreateRoleCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null)
            return Result.Failure<RoleDto>("Tenant context not resolved.");
        if (!currentUser.HasPermission("admin.roles.create"))
            return Result.Failure<RoleDto>("You don't have permission to create roles.");

        var slug = Slugify(cmd.Name);

        // Uniqueness within tenant
        if (await db.Roles.AnyAsync(r => r.TenantId == tenantId && r.Name == cmd.Name, ct))
            return Result.Failure<RoleDto>($"A role named '{cmd.Name}' already exists.");
        if (await db.Roles.AnyAsync(r => r.TenantId == tenantId && r.Slug == slug, ct))
            return Result.Failure<RoleDto>($"Role slug '{slug}' is already taken.");

        var role = new ApplicationRole
        {
            Id           = Guid.NewGuid(),
            Name         = cmd.Name,
            Slug         = slug,
            TenantId     = tenantId,
            IsSystemRole = false,
            Description  = cmd.Description,
            CreatedAt    = DateTime.UtcNow
        };

        var result = await roleManager.CreateAsync(role);
        if (!result.Succeeded)
            return Result.Failure<RoleDto>(string.Join("; ", result.Errors.Select(e => e.Description)));

        logger.LogInformation("Role '{Name}' created in tenant {TenantId}", role.Name, tenantId);

        return Result.Success(new RoleDto(
            role.Id, role.TenantId, role.Name!, role.Slug, role.Description,
            role.IsSystemRole, 0, 0, role.CreatedAt));
    }

    private static string Slugify(string name)
    {
        var s = name.Trim().ToLowerInvariant();
        s = Regex.Replace(s, @"[^a-z0-9]+", "_");
        s = s.Trim('_');
        return string.IsNullOrEmpty(s) ? "role" : s;
    }
}
