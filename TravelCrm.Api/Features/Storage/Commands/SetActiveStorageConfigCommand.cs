using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Storage.Commands;

/// <summary>
/// Sets a storage configuration as active for its scope (deactivating all
/// others in the same scope). Transactional — the deactivate+activate happen
/// in a single SaveChangesAsync call.
/// </summary>
public sealed record SetActiveStorageConfigCommand(Guid Id, Guid? TenantId)
    : IRequest<Result>;

public sealed class SetActiveStorageConfigCommandHandler(
    ApplicationDbContext db,
    ILogger<SetActiveStorageConfigCommandHandler> logger)
    : IRequestHandler<SetActiveStorageConfigCommand, Result>
{
    public async Task<Result> Handle(SetActiveStorageConfigCommand cmd, CancellationToken ct)
    {
        var row = await db.StorageConfigurations.FindAsync([cmd.Id], ct);
        if (row is null)
            return Result.Failure("Storage configuration not found.");

        if (row.TenantId != cmd.TenantId)
            return Result.Failure("Storage configuration does not belong to this scope.");

        if (row.IsActive)
            return Result.Success(); // Already active — no-op

        // Deactivate all others in the same scope
        var others = await db.StorageConfigurations
            .Where(c => c.TenantId == cmd.TenantId && c.IsActive)
            .ToListAsync(ct);
        foreach (var o in others)
            o.IsActive = false;

        row.IsActive = true;
        row.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);

        logger.LogInformation("Storage config '{Name}' set as active for scope {Scope}",
            row.Name, row.TenantId?.ToString() ?? "platform");

        return Result.Success();
    }
}
