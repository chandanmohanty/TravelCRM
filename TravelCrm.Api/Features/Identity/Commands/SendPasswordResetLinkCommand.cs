using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Email;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Identity.Commands;

/// <summary>
/// Admin-initiated password reset — sends a signed 60-minute reset link
/// to the user's email using the tenant's active email configuration.
/// </summary>
public sealed record SendPasswordResetLinkCommand(Guid UserId) : IRequest<Result>;

public sealed class SendPasswordResetLinkCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser,
    PasswordResetTokenService tokens,
    IAppUrlProvider urls,
    EmailSenderResolver emailResolver,
    IIdentityActivityWriter activity,
    ILogger<SendPasswordResetLinkCommandHandler> logger)
    : IRequestHandler<SendPasswordResetLinkCommand, Result>
{
    public async Task<Result> Handle(SendPasswordResetLinkCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure("Tenant context not resolved.");
        if (!currentUser.HasPermission("admin.users.reset_password"))
            return Result.Failure("You don't have permission to send password reset links.");

        var user = await db.Users.FirstOrDefaultAsync(u =>
            u.Id == cmd.UserId && u.TenantId == tenantId && !u.IsDeleted, ct);
        if (user is null) return Result.Failure("User not found.");

        var (_, url) = await tokens.CreateAsync(
            user.Id, tenantId, TimeSpan.FromMinutes(60), urls.PublicUrl, ipAddress: null, ct);

        var sender = emailResolver.Resolve();
        if (sender is null)
            return Result.Failure("No active email configuration — cannot send reset link.");

        var body = $"""
            <div style="font-family:sans-serif;padding:24px;max-width:560px;">
              <h2 style="color:#5D87FF;">Password reset requested</h2>
              <p>An administrator asked to reset your TravelCRM password.
                 Click the link below — it expires in 60 minutes.</p>
              <p style="margin:24px 0;">
                <a href="{System.Net.WebUtility.HtmlEncode(url)}"
                   style="display:inline-block;background:#5D87FF;color:#fff;
                          padding:12px 24px;text-decoration:none;border-radius:6px;
                          font-weight:600;">Reset password</a>
              </p>
              <p style="color:#999;font-size:12px;">
                If the button doesn't work, paste this URL:<br>
                <code>{System.Net.WebUtility.HtmlEncode(url)}</code>
              </p>
            </div>
            """;

        var send = await sender.SendAsync(user.Email!, "TravelCRM — password reset", body, ct);
        if (!send.Success)
            return Result.Failure($"Failed to send email: {send.Message}");

        activity.Record(
            subjectUserId: user.Id,
            activityType:  "user.password_reset_sent",
            description:   $"Password reset link sent to {user.FullName}",
            metadata:      new { email = user.Email });
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Admin-initiated password reset link sent to {Email}", user.Email);
        return Result.Success();
    }
}
