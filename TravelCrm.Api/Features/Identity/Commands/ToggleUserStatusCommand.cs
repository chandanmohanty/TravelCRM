using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Identity.Commands;

public sealed record ToggleUserStatusCommand(Guid UserId, bool Activate) : IRequest<Result>;

public sealed class ToggleUserStatusCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser,
    IIdentityActivityWriter activity,
    ILogger<ToggleUserStatusCommandHandler> logger)
    : IRequestHandler<ToggleUserStatusCommand, Result>
{
    public async Task<Result> Handle(ToggleUserStatusCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure("Tenant context not resolved.");
        if (!currentUser.HasPermission("admin.users.deactivate"))
            return Result.Failure("You don't have permission to change user status.");
        if (cmd.UserId == currentUser.UserId)
            return Result.Failure("You cannot deactivate yourself.");

        var user = await db.Users.FirstOrDefaultAsync(u =>
            u.Id == cmd.UserId && u.TenantId == tenantId && !u.IsDeleted, ct);
        if (user is null) return Result.Failure("User not found.");

        var previous = user.Status;
        user.Status    = cmd.Activate ? UserStatus.Active : UserStatus.Inactive;
        user.UpdatedAt = DateTime.UtcNow;
        user.UpdatedBy = currentUser.UserId == Guid.Empty ? null : currentUser.UserId;

        activity.Record(
            subjectUserId: user.Id,
            activityType:  cmd.Activate ? "user.activated" : "user.deactivated",
            description:   cmd.Activate
                ? $"{user.FullName} was activated"
                : $"{user.FullName} was deactivated",
            metadata: new { previousStatus = previous.ToString() });

        await db.SaveChangesAsync(ct);

        logger.LogInformation("User {UserId} status → {Status}", user.Id, user.Status);
        return Result.Success();
    }
}
