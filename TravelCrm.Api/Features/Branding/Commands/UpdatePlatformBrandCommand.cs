using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Branding.DTOs;
using TravelCrm.Api.Features.Branding.Queries;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Branding.Commands;

/// <summary>
/// Updates the application-wide (platform) brand settings singleton.
/// Gated by <c>[Authorize(Policy = "PlatformAdmin")]</c> at the controller.
/// </summary>
public sealed record UpdatePlatformBrandCommand(
    string? DisplayName,
    string? PrimaryColorHex,
    string? SupportEmail,
    string? SupportUrl)
    : IRequest<Result<BrandSettingsDto>>;

public sealed class UpdatePlatformBrandCommandValidator : AbstractValidator<UpdatePlatformBrandCommand>
{
    public UpdatePlatformBrandCommandValidator()
    {
        RuleFor(x => x.DisplayName).MaximumLength(200);
        RuleFor(x => x.PrimaryColorHex)
            .Matches("^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
            .When(x => !string.IsNullOrWhiteSpace(x.PrimaryColorHex))
            .WithMessage("Primary colour must be a 3- or 6-digit hex code.");
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

public sealed class UpdatePlatformBrandCommandHandler(
    ApplicationDbContext db,
    ICurrentUser currentUser,
    ILogger<UpdatePlatformBrandCommandHandler> logger)
    : IRequestHandler<UpdatePlatformBrandCommand, Result<BrandSettingsDto>>
{
    public async Task<Result<BrandSettingsDto>> Handle(UpdatePlatformBrandCommand cmd, CancellationToken ct)
    {
        PlatformBrandSettings row;
        try
        {
            row = await UpsertAsync(cmd, isRetry: false, ct);
        }
        catch (DbUpdateException ex) when (UpdateTenantBrandCommandHandler.IsUniqueViolation(ex))
        {
            logger.LogInformation("Unique violation upserting platform brand; retrying as update");
            row = await UpsertAsync(cmd, isRetry: true, ct);
        }

        logger.LogInformation("Platform brand settings updated by {UserId}", currentUser.UserId);
        return Result.Success(GetPlatformBrandQueryHandler.ToDto(row));
    }

    private async Task<PlatformBrandSettings> UpsertAsync(
        UpdatePlatformBrandCommand cmd, bool isRetry, CancellationToken ct)
    {
        var row = await db.PlatformBrandSettings
            .OrderBy(p => p.CreatedAt)
            .FirstOrDefaultAsync(ct);

        var now = DateTime.UtcNow;
        var userId = currentUser.UserId == Guid.Empty ? (Guid?)null : currentUser.UserId;

        if (row is null)
        {
            if (isRetry)
                throw new InvalidOperationException("Platform brand row disappeared between retry attempts.");

            row = new PlatformBrandSettings
            {
                Id              = Guid.NewGuid(),
                DisplayName     = cmd.DisplayName,
                PrimaryColorHex = cmd.PrimaryColorHex,
                SupportEmail    = cmd.SupportEmail,
                SupportUrl      = cmd.SupportUrl,
                CreatedAt       = now
            };
            db.PlatformBrandSettings.Add(row);
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
}
