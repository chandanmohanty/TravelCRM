using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Branding.DTOs;
using TravelCrm.Api.Features.Branding.Queries;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Branding.Commands;

/// <summary>
/// Upserts the calling tenant's brand settings (non-asset fields only). Requires
/// the caller to be a tenant Admin or SuperAdmin — enforced by the controller
/// policy <c>TenantAdmin</c>, with a defence-in-depth check inside the handler.
/// </summary>
public sealed record UpdateTenantBrandCommand(
    string? DisplayName,
    string? PrimaryColorHex,
    string? SupportEmail,
    string? SupportUrl)
    : IRequest<Result<BrandSettingsDto>>;

public sealed class UpdateTenantBrandCommandValidator : AbstractValidator<UpdateTenantBrandCommand>
{
    public UpdateTenantBrandCommandValidator()
    {
        RuleFor(x => x.DisplayName).MaximumLength(200);
        RuleFor(x => x.PrimaryColorHex)
            .Matches("^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
            .When(x => !string.IsNullOrWhiteSpace(x.PrimaryColorHex))
            .WithMessage("Primary colour must be a 3- or 6-digit hex code, e.g. #5D87FF.");
        RuleFor(x => x.SupportEmail)
            .EmailAddress().MaximumLength(256)
            .When(x => !string.IsNullOrWhiteSpace(x.SupportEmail));
        RuleFor(x => x.SupportUrl)
            .MaximumLength(500)
            .Must(BeValidUrl).When(x => !string.IsNullOrWhiteSpace(x.SupportUrl))
            .WithMessage("Support URL must be a valid absolute URL.");
    }

    private static bool BeValidUrl(string? url) =>
        Uri.TryCreate(url, UriKind.Absolute, out var u) && (u.Scheme == Uri.UriSchemeHttp || u.Scheme == Uri.UriSchemeHttps);
}

public sealed class UpdateTenantBrandCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser,
    ILogger<UpdateTenantBrandCommandHandler> logger)
    : IRequestHandler<UpdateTenantBrandCommand, Result<BrandSettingsDto>>
{
    public async Task<Result<BrandSettingsDto>> Handle(UpdateTenantBrandCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null)
            return Result.Failure<BrandSettingsDto>("Tenant context not resolved.");

        // Defence-in-depth: confirm the caller has a tenant-admin role. The controller
        // also gates this via the TenantAdmin policy, but a second check here is cheap.
        if (!currentUser.IsInAnyRole("Admin", "SuperAdmin"))
            return Result.Failure<BrandSettingsDto>("You do not have permission to update brand settings.");

        // Concurrency-safe upsert: try once, re-fetch-and-update if a unique index
        // violation tells us another request beat us to the insert.
        TenantBrandSettings row;
        try
        {
            row = await UpsertAsync(tenantId.Value, cmd, isRetry: false, ct);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            logger.LogInformation("Unique violation upserting tenant brand for {TenantId}; retrying as update", tenantId.Value);
            row = await UpsertAsync(tenantId.Value, cmd, isRetry: true, ct);
        }

        logger.LogInformation("Tenant brand settings updated for tenant {TenantId}", tenantId.Value);
        return Result.Success(GetTenantBrandQueryHandler.ToDto(row));
    }

    private async Task<TenantBrandSettings> UpsertAsync(
        Guid tenantId, UpdateTenantBrandCommand cmd, bool isRetry, CancellationToken ct)
    {
        var row = await db.TenantBrandSettings
            .FirstOrDefaultAsync(t => t.TenantId == tenantId, ct);

        var now = DateTime.UtcNow;
        var userId = currentUser.UserId == Guid.Empty ? (Guid?)null : currentUser.UserId;

        if (row is null)
        {
            // Safety: if this is the retry path, not finding a row means an unexpected
            // error that isn't a race. Surface it rather than looping.
            if (isRetry)
                throw new InvalidOperationException("Tenant brand row disappeared between retry attempts.");

            row = new TenantBrandSettings
            {
                Id              = Guid.NewGuid(),
                TenantId        = tenantId,
                DisplayName     = cmd.DisplayName,
                PrimaryColorHex = cmd.PrimaryColorHex,
                SupportEmail    = cmd.SupportEmail,
                SupportUrl      = cmd.SupportUrl,
                CreatedAt       = now,
                CreatedBy       = userId
            };
            db.TenantBrandSettings.Add(row);
        }
        else
        {
            row.DisplayName     = cmd.DisplayName;
            row.PrimaryColorHex = cmd.PrimaryColorHex;
            row.SupportEmail    = cmd.SupportEmail;
            row.SupportUrl      = cmd.SupportUrl;
            row.UpdatedAt       = now;
            row.UpdatedBy       = userId;
        }

        await db.SaveChangesAsync(ct);
        return row;
    }

    /// <summary>True when the exception is caused by a PostgreSQL unique-index violation (SQLSTATE 23505).</summary>
    internal static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is Npgsql.PostgresException pg && pg.SqlState == "23505";
}
