using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Settings.DataReset.Commands;

/// <summary>
/// DESTRUCTIVE operation: wipes business + user data for the current tenant,
/// preserving the <see cref="Domain.Entities.Tenant"/> row itself, the
/// configuration tables (Brand / Storage / Email / System / Invoice /
/// Departments / Roles / RolePermissions), and the calling admin user.
/// Requires the caller to type the literal string "RESET" as confirmation
/// and hold the <c>admin.data_reset.execute</c> permission.
/// </summary>
public sealed record ResetTenantDataCommand(string Confirmation) : IRequest<Result<ResetTenantDataResultDto>>;

public sealed record ResetTenantDataResultDto(
    int UsersDeleted,
    int IdentityActivitiesDeleted,
    int AuditLogsDeleted,
    int NotificationsDeleted,
    int RefreshTokensDeleted,
    int PasswordResetTokensDeleted,
    int EmployeeSequencesDeleted);

public sealed class ResetTenantDataCommandValidator : AbstractValidator<ResetTenantDataCommand>
{
    public ResetTenantDataCommandValidator()
    {
        RuleFor(x => x.Confirmation).NotEmpty()
            .Must(c => string.Equals(c, "RESET", StringComparison.Ordinal))
            .WithMessage("Confirmation must be the literal string 'RESET'.");
    }
}

public sealed class ResetTenantDataCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser,
    IIdentityActivityWriter activity,
    ILogger<ResetTenantDataCommandHandler> logger)
    : IRequestHandler<ResetTenantDataCommand, Result<ResetTenantDataResultDto>>
{
    public async Task<Result<ResetTenantDataResultDto>> Handle(
        ResetTenantDataCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure<ResetTenantDataResultDto>("Tenant context not resolved.");
        if (!currentUser.HasPermission("admin.data_reset.execute"))
            return Result.Failure<ResetTenantDataResultDto>("You don't have permission to reset tenant data.");
        if (currentUser.UserId == Guid.Empty)
            return Result.Failure<ResetTenantDataResultDto>("Authenticated actor required.");

        var actorId = currentUser.UserId;

        // Run inside a transaction so a partial wipe can't leave the tenant in a
        // half-reset state if any step fails mid-way.
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        try
        {
            // 1. Users (everyone except the current admin)
            var usersDeleted = await db.Users
                .Where(u => u.TenantId == tenantId && u.Id != actorId)
                .ExecuteDeleteAsync(ct);

            // 2. Audit + activity trail for this tenant
            var activityDeleted = await db.IdentityActivities
                .Where(a => a.TenantId == tenantId)
                .ExecuteDeleteAsync(ct);
            var auditDeleted = await db.AuditLogs
                .Where(a => a.TenantId == tenantId)
                .ExecuteDeleteAsync(ct);

            // 3. Notifications for this tenant
            var notifDeleted = await db.Notifications
                .Where(n => n.TenantId == tenantId)
                .ExecuteDeleteAsync(ct);

            // 4. Token tables (orphaned once users are gone, but be explicit)
            var refreshDeleted = await db.RefreshTokens
                .Where(r => db.Users.Any(u => u.Id == r.UserId && u.TenantId == tenantId && u.Id != actorId))
                .ExecuteDeleteAsync(ct);
            var resetDeleted = await db.PasswordResetTokens
                .Where(p => p.TenantId == tenantId)
                .ExecuteDeleteAsync(ct);

            // 5. Per-tenant sequence state (employee-id counters)
            var seqDeleted = await db.EmployeeIdSequences
                .Where(s => s.TenantId == tenantId)
                .ExecuteDeleteAsync(ct);

            // 6. Leave an audit-trail activity row on the way out. Because the
            //    wipe above already ran, we record this AFTER the wipe so it
            //    survives and gives the tenant a clear "reset happened here"
            //    event in the activity feed going forward.
            activity.Record(
                subjectUserId: actorId,
                activityType:  "tenant.data_reset",
                description:   "Tenant data was reset (wipe preserving admin + config).",
                metadata: new {
                    usersDeleted, activityDeleted, auditDeleted, notifDeleted,
                    refreshDeleted, resetDeleted, seqDeleted,
                });
            await db.SaveChangesAsync(ct);

            await tx.CommitAsync(ct);

            logger.LogWarning(
                "TENANT DATA RESET completed for tenant {TenantId} by {ActorId}. "
                + "Users={Users} Activity={Act} Audit={Audit} Notif={Notif} "
                + "Refresh={Refresh} Reset={Reset} Seq={Seq}",
                tenantId, actorId,
                usersDeleted, activityDeleted, auditDeleted, notifDeleted,
                refreshDeleted, resetDeleted, seqDeleted);

            return Result.Success(new ResetTenantDataResultDto(
                UsersDeleted:             usersDeleted,
                IdentityActivitiesDeleted: activityDeleted,
                AuditLogsDeleted:         auditDeleted,
                NotificationsDeleted:     notifDeleted,
                RefreshTokensDeleted:     refreshDeleted,
                PasswordResetTokensDeleted: resetDeleted,
                EmployeeSequencesDeleted: seqDeleted));
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync(ct);
            logger.LogError(ex, "Tenant data reset FAILED for tenant {TenantId}; rolled back.", tenantId);
            return Result.Failure<ResetTenantDataResultDto>(
                $"Data reset failed and was rolled back: {ex.Message}");
        }
    }
}
