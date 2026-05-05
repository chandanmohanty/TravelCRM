using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Infrastructure.Email;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Identity.Events;

/// <summary>
/// Sends a welcome / invite email when a tenant user is created. Best-effort:
/// any failure is logged but never surfaces to the creator. Uses the tenant's
/// active <see cref="Domain.Entities.EmailConfiguration"/> via
/// <see cref="EmailSenderResolver"/>; skips silently if none is configured.
/// </summary>
public sealed class SendAccountCreatedEmailHandler(
    ApplicationDbContext db,
    EmailSenderResolver emailResolver,
    ILogger<SendAccountCreatedEmailHandler> logger) : INotificationHandler<UserCreatedEvent>
{
    public async Task Handle(UserCreatedEvent ev, CancellationToken ct)
    {
        try
        {
            var user = await db.Users.AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == ev.UserId, ct);
            if (user is null || string.IsNullOrWhiteSpace(user.Email)) return;

            var sender = emailResolver.Resolve();
            if (sender is null)
            {
                logger.LogInformation(
                    "No active email config for tenant {TenantId}; skipping welcome email for user {UserId}",
                    ev.TenantId, ev.UserId);
                return;
            }

            var subject = ev.SendInvite
                ? "You've been invited to TravelCRM"
                : "Welcome to TravelCRM";

            var body = ev.SendInvite && !string.IsNullOrWhiteSpace(ev.InviteUrl)
                ? RenderInviteHtml(user.FirstName, ev.InviteUrl!)
                : RenderWelcomeHtml(user.FirstName);

            await sender.SendAsync(user.Email!, subject, body, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to send account-created email for user {UserId}", ev.UserId);
        }
    }

    private static string RenderInviteHtml(string firstName, string link) => $"""
        <div style="font-family:sans-serif;padding:24px;max-width:560px;">
          <h2 style="color:#5D87FF;">Welcome, {System.Net.WebUtility.HtmlEncode(firstName)}!</h2>
          <p>You've been invited to join your team on TravelCRM.</p>
          <p>Click the button below to set your password and sign in. The link
             expires in 7 days.</p>
          <p style="margin:24px 0;">
            <a href="{System.Net.WebUtility.HtmlEncode(link)}"
               style="display:inline-block;background:#5D87FF;color:#fff;
                      padding:12px 24px;text-decoration:none;border-radius:6px;
                      font-weight:600;">
              Accept invitation
            </a>
          </p>
          <p style="color:#999;font-size:12px;">
            If the button doesn't work, paste this URL into your browser:<br>
            <code>{System.Net.WebUtility.HtmlEncode(link)}</code>
          </p>
        </div>
        """;

    private static string RenderWelcomeHtml(string firstName) => $"""
        <div style="font-family:sans-serif;padding:24px;max-width:560px;">
          <h2 style="color:#5D87FF;">Welcome, {System.Net.WebUtility.HtmlEncode(firstName)}!</h2>
          <p>Your TravelCRM account has been created. Please reach out to your
             administrator if you don't yet have sign-in credentials.</p>
        </div>
        """;
}
