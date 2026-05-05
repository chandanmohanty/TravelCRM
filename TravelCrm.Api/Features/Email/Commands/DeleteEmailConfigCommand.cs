using MediatR;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Email.Commands;

public sealed record DeleteEmailConfigCommand(Guid Id, Guid? TenantId)
    : IRequest<Result>;

public sealed class DeleteEmailConfigCommandHandler(
    ApplicationDbContext db,
    ILogger<DeleteEmailConfigCommandHandler> logger)
    : IRequestHandler<DeleteEmailConfigCommand, Result>
{
    public async Task<Result> Handle(DeleteEmailConfigCommand cmd, CancellationToken ct)
    {
        var row = await db.EmailConfigurations.FindAsync([cmd.Id], ct);
        if (row is null)
            return Result.Failure("Email configuration not found.");

        if (row.TenantId != cmd.TenantId)
            return Result.Failure("Email configuration does not belong to this scope.");

        if (row.IsActive)
            return Result.Failure("Cannot delete the active email configuration. Set another as active first.");

        db.EmailConfigurations.Remove(row);
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Email config '{Name}' deleted from scope {Scope}",
            row.Name, row.TenantId?.ToString() ?? "platform");

        return Result.Success();
    }
}
