using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Email.Commands;

public sealed record SetActiveEmailConfigCommand(Guid Id, Guid? TenantId)
    : IRequest<Result>;

public sealed class SetActiveEmailConfigCommandHandler(
    ApplicationDbContext db,
    ILogger<SetActiveEmailConfigCommandHandler> logger)
    : IRequestHandler<SetActiveEmailConfigCommand, Result>
{
    public async Task<Result> Handle(SetActiveEmailConfigCommand cmd, CancellationToken ct)
    {
        var row = await db.EmailConfigurations.FindAsync([cmd.Id], ct);
        if (row is null)
            return Result.Failure("Email configuration not found.");

        if (row.TenantId != cmd.TenantId)
            return Result.Failure("Email configuration does not belong to this scope.");

        if (row.IsActive)
            return Result.Success();

        var others = await db.EmailConfigurations
            .Where(c => c.TenantId == cmd.TenantId && c.IsActive)
            .ToListAsync(ct);
        foreach (var o in others) o.IsActive = false;

        row.IsActive = true;
        row.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);

        logger.LogInformation("Email config '{Name}' set as active for scope {Scope}",
            row.Name, row.TenantId?.ToString() ?? "platform");

        return Result.Success();
    }
}
