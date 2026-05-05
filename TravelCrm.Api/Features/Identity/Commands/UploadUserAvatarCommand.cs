using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.FileStorage;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Identity.Commands;

/// <summary>Uploads or replaces a user's avatar via the tenant's active storage.</summary>
public sealed record UploadUserAvatarCommand(
    Guid   UserId,
    Stream Content,
    string ContentType,
    long   ContentLength
) : IRequest<Result<string>>;

public sealed class UploadUserAvatarCommandHandler(
    ApplicationDbContext db,
    IFileStorage fileStorage,
    ITenantContext tenantContext,
    ICurrentUser currentUser,
    ILogger<UploadUserAvatarCommandHandler> logger)
    : IRequestHandler<UploadUserAvatarCommand, Result<string>>
{
    // Avatars are smaller than general assets
    private const long MaxBytes = 2 * 1024 * 1024; // 2 MB

    public async Task<Result<string>> Handle(UploadUserAvatarCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure<string>("Tenant context not resolved.");
        if (cmd.ContentLength > MaxBytes)
            return Result.Failure<string>($"Avatar exceeds {MaxBytes / 1024} KB limit.");

        var user = await db.Users.FirstOrDefaultAsync(u =>
            u.Id == cmd.UserId && u.TenantId == tenantId && !u.IsDeleted, ct);
        if (user is null) return Result.Failure<string>("User not found.");

        // Only self OR admin.users.update may change someone's avatar
        if (cmd.UserId != currentUser.UserId && !currentUser.HasPermission("admin.users.update"))
            return Result.Failure<string>("You don't have permission to change this user's avatar.");

        string newUrl;
        try
        {
            newUrl = await fileStorage.SaveAsync(
                cmd.Content, cmd.ContentType,
                folder: $"avatars/t-{tenantId:N}",
                fileNameStem: $"u-{user.Id:N}",
                ct);
        }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<string>(ex.Message);
        }

        var previous = user.AvatarUrl;
        user.AvatarUrl = newUrl;
        user.UpdatedAt = DateTime.UtcNow;
        user.UpdatedBy = currentUser.UserId == Guid.Empty ? null : currentUser.UserId;
        await db.SaveChangesAsync(ct);

        // Best-effort cleanup of the prior avatar
        if (!string.IsNullOrWhiteSpace(previous))
            await fileStorage.DeleteAsync(previous, ct);

        logger.LogInformation("Avatar updated for user {UserId}", user.Id);
        return Result.Success(newUrl);
    }
}
