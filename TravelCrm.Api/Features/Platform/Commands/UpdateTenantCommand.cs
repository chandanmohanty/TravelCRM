using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Platform.DTOs;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Platform.Commands;

public sealed record UpdateTenantCommand(
    Guid   Id,
    string Name,
    string Slug,
    string Plan)
    : IRequest<Result<TenantDto>>;

public sealed class UpdateTenantCommandValidator : AbstractValidator<UpdateTenantCommand>
{
    public UpdateTenantCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Slug).NotEmpty().MaximumLength(100)
            .Matches("^[a-z0-9-]+$").WithMessage("Slug must be lowercase letters, digits, or hyphens.");
        RuleFor(x => x.Plan).NotEmpty();
    }
}

public sealed class UpdateTenantCommandHandler(
    ApplicationDbContext db,
    ILogger<UpdateTenantCommandHandler> logger)
    : IRequestHandler<UpdateTenantCommand, Result<TenantDto>>
{
    public async Task<Result<TenantDto>> Handle(UpdateTenantCommand cmd, CancellationToken ct)
    {
        var tenant = await db.Tenants.FindAsync([cmd.Id], ct);
        if (tenant is null)
            return Result.Failure<TenantDto>("Tenant not found.");

        // Check slug uniqueness (excluding self)
        var slugTaken = await db.Tenants
            .AnyAsync(t => t.Slug == cmd.Slug && t.Id != cmd.Id, ct);
        if (slugTaken)
            return Result.Failure<TenantDto>($"Slug '{cmd.Slug}' is already taken.");

        tenant.Name = cmd.Name;
        tenant.Slug = cmd.Slug;
        tenant.Plan = cmd.Plan;
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Tenant {TenantId} updated", tenant.Id);

        var userCount = db.Users.Count(u => u.TenantId == tenant.Id && !u.IsDeleted);
        return Result.Success(new TenantDto(
            tenant.Id, tenant.Name, tenant.Slug, tenant.Plan, tenant.IsActive, userCount, tenant.CreatedAt));
    }
}
