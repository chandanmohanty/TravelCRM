using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Platform.DTOs;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;

namespace TravelCrm.Api.Features.Platform.Commands;

public sealed record CreateTenantCommand(
    string Name,
    string Slug,
    string Plan,
    // Initial admin user
    string AdminEmail,
    string AdminFirstName,
    string AdminLastName,
    string AdminPassword)
    : IRequest<Result<TenantDto>>;

public sealed class CreateTenantCommandValidator : AbstractValidator<CreateTenantCommand>
{
    public CreateTenantCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Slug).NotEmpty().MaximumLength(100)
            .Matches("^[a-z0-9-]+$").WithMessage("Slug must be lowercase letters, digits, or hyphens.");
        RuleFor(x => x.Plan).NotEmpty();
        RuleFor(x => x.AdminEmail).NotEmpty().EmailAddress();
        RuleFor(x => x.AdminFirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.AdminLastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.AdminPassword).NotEmpty().MinimumLength(8);
    }
}

public sealed class CreateTenantCommandHandler(
    ApplicationDbContext db,
    UserManager<ApplicationUser> userManager,
    RoleManager<ApplicationRole> roleManager,
    ILogger<CreateTenantCommandHandler> logger)
    : IRequestHandler<CreateTenantCommand, Result<TenantDto>>
{
    public async Task<Result<TenantDto>> Handle(CreateTenantCommand cmd, CancellationToken ct)
    {
        // Slug must be unique
        if (await db.Tenants.AnyAsync(t => t.Slug == cmd.Slug, ct))
            return Result.Failure<TenantDto>($"Slug '{cmd.Slug}' is already taken.");

        // Create tenant
        var tenant = new Tenant
        {
            Id        = Guid.NewGuid(),
            Name      = cmd.Name,
            Slug      = cmd.Slug,
            Plan      = cmd.Plan,
            IsActive  = true,
            CreatedAt = DateTime.UtcNow
        };
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync(ct);

        // Ensure standard roles exist for this tenant
        foreach (var roleName in new[] { "SuperAdmin", "Admin", "Manager", "ReadOnly" })
        {
            var existsForTenant = await db.Roles
                .AnyAsync(r => r.Name == roleName && r.TenantId == tenant.Id, ct);
            if (!existsForTenant)
            {
                await roleManager.CreateAsync(new ApplicationRole
                {
                    Name         = roleName,
                    TenantId     = tenant.Id,
                    IsSystemRole = true,
                    Description  = $"{roleName} role"
                });
            }
        }

        // Create tenant SuperAdmin user
        var adminUser = new ApplicationUser
        {
            TenantId       = tenant.Id,
            UserName       = cmd.AdminEmail,
            Email          = cmd.AdminEmail,
            EmailConfirmed = true,
            FirstName      = cmd.AdminFirstName,
            LastName       = cmd.AdminLastName,
            Status         = UserStatus.Active,
            CreatedAt      = DateTime.UtcNow
        };
        var result = await userManager.CreateAsync(adminUser, cmd.AdminPassword);
        if (!result.Succeeded)
        {
            // Rollback tenant
            db.Tenants.Remove(tenant);
            await db.SaveChangesAsync(ct);
            var errors = string.Join("; ", result.Errors.Select(e => e.Description));
            return Result.Failure<TenantDto>($"Failed to create admin user: {errors}");
        }

        await userManager.AddToRoleAsync(adminUser, "SuperAdmin");

        logger.LogInformation("Tenant {TenantId} ({Slug}) created by platform admin", tenant.Id, tenant.Slug);

        return Result.Success(new TenantDto(
            tenant.Id, tenant.Name, tenant.Slug, tenant.Plan, tenant.IsActive, 1, tenant.CreatedAt));
    }
}
