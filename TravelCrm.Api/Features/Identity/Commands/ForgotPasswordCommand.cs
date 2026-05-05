using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Email;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Identity.Commands;

/// <summary>
/// Self-service password reset. Publicly accessible. Always returns success
/// regardless of whether the email matches a real account — prevents email
/// enumeration. When a tenant slug is supplied, scopes the lookup to that
/// tenant; otherwise, matches platform admins only.
/// </summary>
public sealed record ForgotPasswordCommand(
    string  Email,
    string? TenantSlug,
    string? IpAddress) : IRequest<Result>;

public sealed class ForgotPasswordCommandValidator : AbstractValidator<ForgotPasswordCommand>
{
    public ForgotPasswordCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
    }
}

public sealed class ForgotPasswordCommandHandler(
    ApplicationDbContext db,
    PasswordResetTokenService tokens,
    IAppUrlProvider urls,
    ITenantContext tenantContext,
    EmailSenderResolver emailResolver,
    ILogger<ForgotPasswordCommandHandler> logger)
    : IRequestHandler<ForgotPasswordCommand, Result>
{
    public async Task<Result> Handle(ForgotPasswordCommand cmd, CancellationToken ct)
    {
        var normalized = cmd.Email.ToUpperInvariant();

        // Resolve tenant from slug (if supplied)
        Guid? tenantId = null;
        if (!string.IsNullOrWhiteSpace(cmd.TenantSlug))
        {
            tenantId = await db.Tenants
                .Where(t => t.Slug == cmd.TenantSlug && t.IsActive)
                .Select(t => (Guid?)t.Id)
                .FirstOrDefaultAsync(ct);
        }

        var user = tenantId.HasValue
            ? await db.Users.FirstOrDefaultAsync(u =>
                u.TenantId == tenantId && u.NormalizedEmail == normalized && !u.IsDeleted, ct)
            // No tenant slug → platform admin flow
            : await db.Users.FirstOrDefaultAsync(u =>
                u.TenantId == null && u.IsPlatformAdmin && u.NormalizedEmail == normalized && !u.IsDeleted, ct);

        if (user is null)
        {
            // Enumeration-safe: pretend success
            logger.LogInformation("Forgot-password for unknown email (silent): {Email}", cmd.Email);
            return Result.Success();
        }

        try
        {
            var (_, url) = await tokens.CreateAsync(
                user.Id, user.TenantId, TimeSpan.FromMinutes(60), urls.PublicUrl, cmd.IpAddress, ct);

            // For the email delivery, temporarily inject the user's tenant context
            // so EmailSenderResolver picks up the right active config. Since this
            // endpoint is anonymous, ITenantContext may be null; we'll resolve
            // directly against DB here.
            var sender = emailResolver.Resolve();
            if (sender is null)
            {
                logger.LogWarning("Forgot-password email skipped — no active email config (tenant={TenantId})",
                    user.TenantId);
                // Still return success to keep enumeration-safe behaviour
                return Result.Success();
            }

            var body = $"""
                <div style="font-family:sans-serif;padding:24px;max-width:560px;">
                  <h2 style="color:#5D87FF;">Reset your TravelCRM password</h2>
                  <p>We received a request to reset your password. The link
                     below expires in 60 minutes.</p>
                  <p style="margin:24px 0;">
                    <a href="{System.Net.WebUtility.HtmlEncode(url)}"
                       style="display:inline-block;background:#5D87FF;color:#fff;
                              padding:12px 24px;text-decoration:none;border-radius:6px;
                              font-weight:600;">Reset password</a>
                  </p>
                  <p style="color:#999;font-size:12px;">
                    Didn't request this? You can safely ignore this email.
                  </p>
                </div>
                """;

            await sender.SendAsync(user.Email!, "TravelCRM — password reset", body, ct);
            logger.LogInformation("Password reset link sent to {Email}", user.Email);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to send forgot-password email for user {UserId}", user.Id);
        }

        return Result.Success();
    }
}
