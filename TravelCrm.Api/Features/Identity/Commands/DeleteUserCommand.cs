using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Identity.Commands;

/// <summary>Soft-deletes a user. Their timer/task history is preserved.</summary>
public sealed record DeleteUserCommand(Guid UserId) : IRequest<Result>;

public sealed class DeleteUserCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser,
    IIdentityActivityWriter activity,
    ILogger<DeleteUserCommandHandler> logger)
    : IRequestHandler<DeleteUserCommand, Result>
{
    public async Task<Result> Handle(DeleteUserCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure("Tenant context not resolved.");
        if (!currentUser.HasPermission("admin.users.delete"))
            return Result.Failure("You don't have permission to delete users.");
        if (cmd.UserId == currentUser.UserId)
            return Result.Failure("You cannot delete yourself.");

        var user = await db.Users.FirstOrDefaultAsync(u =>
            u.Id == cmd.UserId && u.TenantId == tenantId && !u.IsDeleted, ct);
        if (user is null) return Result.Failure("User not found.");

        user.IsDeleted = true;
        user.Status    = UserStatus.Inactive;
        user.UpdatedAt = DateTime.UtcNow;
        user.UpdatedBy = currentUser.UserId == Guid.Empty ? null : currentUser.UserId;

        activity.Record(
            subjectUserId: user.Id,
            activityType:  "user.deleted",
            description:   $"{user.FullName} was deleted",
            metadata:      new { email = user.Email, employeeId = user.EmployeeId });

        await db.SaveChangesAsync(ct);

        logger.LogInformation("User {UserId} soft-deleted from tenant {TenantId}", user.Id, tenantId);
        return Result.Success();
    }
}
