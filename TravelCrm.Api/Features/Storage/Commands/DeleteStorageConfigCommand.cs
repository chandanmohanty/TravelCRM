using MediatR;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Storage.Commands;

/// <summary>
/// Deletes a storage configuration by id. Refuses to delete the active config
/// unless it's the last one — avoids leaving the scope with no fallback.
/// </summary>
public sealed record DeleteStorageConfigCommand(Guid Id, Guid? TenantId)
    : IRequest<Result>;

public sealed class DeleteStorageConfigCommandHandler(
    ApplicationDbContext db,
    ILogger<DeleteStorageConfigCommandHandler> logger)
    : IRequestHandler<DeleteStorageConfigCommand, Result>
{
    public async Task<Result> Handle(DeleteStorageConfigCommand cmd, CancellationToken ct)
    {
        var row = await db.StorageConfigurations.FindAsync([cmd.Id], ct);
        if (row is null)
            return Result.Failure("Storage configuration not found.");

        if (row.TenantId != cmd.TenantId)
            return Result.Failure("Storage configuration does not belong to this scope.");

        if (row.IsActive)
            return Result.Failure("Cannot delete the active storage configuration. Set another as active first.");

        db.StorageConfigurations.Remove(row);
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Storage config '{Name}' deleted from scope {Scope}",
            row.Name, row.TenantId?.ToString() ?? "platform");

        return Result.Success();
    }
}
