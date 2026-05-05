using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Branding.DTOs;
using TravelCrm.Api.Infrastructure.FileStorage;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Branding.Commands;

public enum BrandScope
{
    Tenant   = 0,
    Platform = 1
}

/// <summary>
/// Streams an uploaded brand asset to <see cref="IFileStorage"/>, updates the
/// appropriate URL field on the settings row, and cleans up the previous file
/// (best-effort). Works for both tenant and platform scopes based on
/// <see cref="Scope"/>.
/// </summary>
public sealed record UploadBrandAssetCommand(
    BrandScope     Scope,
    BrandAssetKind AssetKind,
    Stream         Content,
    string         ContentType,
    long           ContentLength)
    : IRequest<Result<BrandAssetUploadResponse>>;

public sealed class UploadBrandAssetCommandValidator : AbstractValidator<UploadBrandAssetCommand>
{
    public UploadBrandAssetCommandValidator()
    {
        RuleFor(x => x.ContentType).NotEmpty();
        RuleFor(x => x.ContentLength).GreaterThan(0).WithMessage("Empty file.");
    }
}

public sealed class UploadBrandAssetCommandHandler(
    ApplicationDbContext db,
    IFileStorage fileStorage,
    ITenantContext tenantContext,
    ICurrentUser currentUser,
    ILogger<UploadBrandAssetCommandHandler> logger)
    : IRequestHandler<UploadBrandAssetCommand, Result<BrandAssetUploadResponse>>
{
    public async Task<Result<BrandAssetUploadResponse>> Handle(UploadBrandAssetCommand cmd, CancellationToken ct)
    {
        // Authorize + resolve the destination folder based on scope.
        string folder;
        Guid? tenantId = null;
        if (cmd.Scope == BrandScope.Tenant)
        {
            tenantId = tenantContext.TenantId;
            if (tenantId is null)
                return Result.Failure<BrandAssetUploadResponse>("Tenant context not resolved.");
            if (!currentUser.IsInAnyRole("Admin", "SuperAdmin"))
                return Result.Failure<BrandAssetUploadResponse>("You do not have permission to upload brand assets.");
            folder = $"branding/t-{tenantId.Value:N}";
        }
        else
        {
            if (!currentUser.IsPlatformAdmin)
                return Result.Failure<BrandAssetUploadResponse>("Platform admin permission required.");
            folder = "branding/platform";
        }

        // Stream the file to storage BEFORE touching the DB. If storage fails we just
        // return the error — no DB mutation has happened yet.
        string newUrl;
        try
        {
            var stem = cmd.AssetKind.ToString().ToLowerInvariant();
            newUrl = await fileStorage.SaveAsync(cmd.Content, cmd.ContentType, folder, stem, ct);
        }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<BrandAssetUploadResponse>(ex.Message);
        }

        // Apply the URL to the row and save, with a race-safe retry on unique-index violation.
        string? previousUrl;
        try
        {
            previousUrl = await ApplyAndSaveAsync(cmd, newUrl, tenantId, isRetry: false, ct);
        }
        catch (DbUpdateException ex) when (UpdateTenantBrandCommandHandler.IsUniqueViolation(ex))
        {
            logger.LogInformation("Unique violation saving brand asset for scope {Scope}; retrying", cmd.Scope);
            previousUrl = await ApplyAndSaveAsync(cmd, newUrl, tenantId, isRetry: true, ct);
        }

        // Best-effort cleanup of the previous file AFTER the new row is saved, so a
        // failed delete never breaks the user-visible operation.
        if (!string.IsNullOrWhiteSpace(previousUrl))
            await fileStorage.DeleteAsync(previousUrl, ct);

        logger.LogInformation(
            "Uploaded {Kind} for scope {Scope} → {Url}", cmd.AssetKind, cmd.Scope, newUrl);

        return Result.Success(new BrandAssetUploadResponse(cmd.AssetKind, newUrl));
    }

    /// <summary>
    /// Loads the settings row (or creates one), stamps the new asset URL onto the
    /// appropriate column, and saves. Returns the previous URL for that asset
    /// kind so the caller can delete the file on disk afterwards.
    /// </summary>
    private async Task<string?> ApplyAndSaveAsync(
        UploadBrandAssetCommand cmd, string newUrl, Guid? tenantId, bool isRetry, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var userId = currentUser.UserId == Guid.Empty ? (Guid?)null : currentUser.UserId;
        string? previousUrl;

        if (cmd.Scope == BrandScope.Tenant)
        {
            var row = await db.TenantBrandSettings
                .FirstOrDefaultAsync(t => t.TenantId == tenantId!.Value, ct);
            if (row is null)
            {
                if (isRetry)
                    throw new InvalidOperationException("Tenant brand row disappeared between retry attempts.");
                row = new TenantBrandSettings
                {
                    Id        = Guid.NewGuid(),
                    TenantId  = tenantId!.Value,
                    CreatedAt = now,
                    CreatedBy = userId
                };
                db.TenantBrandSettings.Add(row);
            }

            previousUrl = GetAssetUrl(row.LogoLightUrl, row.LogoDarkUrl, row.FaviconUrl, cmd.AssetKind);
            ApplyAssetUrl(cmd.AssetKind, newUrl,
                light:   v => row.LogoLightUrl = v,
                dark:    v => row.LogoDarkUrl  = v,
                favicon: v => row.FaviconUrl   = v);
            row.UpdatedAt = now;
            row.UpdatedBy = userId;
        }
        else // Platform
        {
            var row = await db.PlatformBrandSettings
                .OrderBy(p => p.CreatedAt)
                .FirstOrDefaultAsync(ct);
            if (row is null)
            {
                if (isRetry)
                    throw new InvalidOperationException("Platform brand row disappeared between retry attempts.");
                row = new PlatformBrandSettings { Id = Guid.NewGuid(), CreatedAt = now };
                db.PlatformBrandSettings.Add(row);
            }

            previousUrl = GetAssetUrl(row.LogoLightUrl, row.LogoDarkUrl, row.FaviconUrl, cmd.AssetKind);
            ApplyAssetUrl(cmd.AssetKind, newUrl,
                light:   v => row.LogoLightUrl = v,
                dark:    v => row.LogoDarkUrl  = v,
                favicon: v => row.FaviconUrl   = v);
            row.UpdatedAt = now;
            row.UpdatedBy = userId;
        }

        await db.SaveChangesAsync(ct);
        return previousUrl;
    }

    private static string? GetAssetUrl(string? light, string? dark, string? favicon, BrandAssetKind kind) => kind switch
    {
        BrandAssetKind.LogoLight => light,
        BrandAssetKind.LogoDark  => dark,
        BrandAssetKind.Favicon   => favicon,
        _                        => null
    };

    private static void ApplyAssetUrl(
        BrandAssetKind kind,
        string newUrl,
        Action<string> light,
        Action<string> dark,
        Action<string> favicon)
    {
        switch (kind)
        {
            case BrandAssetKind.LogoLight: light(newUrl); break;
            case BrandAssetKind.LogoDark:  dark(newUrl); break;
            case BrandAssetKind.Favicon:   favicon(newUrl); break;
        }
    }
}
