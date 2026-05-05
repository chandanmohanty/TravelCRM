using MediatR;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Auth.DTOs;
using TravelCrm.Api.Infrastructure.Auth;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Auth.Commands.Login;

public sealed class LoginCommandHandler(
    UserManager<ApplicationUser> userManager,
    SignInManager<ApplicationUser> signInManager,
    JwtTokenService jwtTokenService,
    IOptions<JwtSettings> jwtOptions,
    ApplicationDbContext db,
    ILogger<LoginCommandHandler> logger)
    : IRequestHandler<LoginCommand, Result<LoginResponse>>
{
    public async Task<Result<LoginResponse>> Handle(LoginCommand cmd, CancellationToken ct)
    {
        // Find user by email
        var user = await userManager.Users
            .FirstOrDefaultAsync(u => u.NormalizedEmail == cmd.Email.ToUpperInvariant() && !u.IsDeleted, ct);

        if (user == null)
        {
            logger.LogWarning("Login failed: user {Email} not found", cmd.Email);
            return Result.Failure<LoginResponse>("Invalid email or password.");
        }

        if (user.Status == UserStatus.Inactive)
            return Result.Failure<LoginResponse>("Your account has been deactivated. Contact your administrator.");

        if (user.Status == UserStatus.Suspended)
            return Result.Failure<LoginResponse>("Your account has been suspended.");

        var signInResult = await signInManager.CheckPasswordSignInAsync(user, cmd.Password, lockoutOnFailure: true);
        if (!signInResult.Succeeded)
        {
            if (signInResult.IsLockedOut)
                return Result.Failure<LoginResponse>("Account locked due to too many failed attempts. Try again in 15 minutes.");
            return Result.Failure<LoginResponse>("Invalid email or password.");
        }

        // Get tenant (platform admin has no tenant)
        Tenant? tenant = user.TenantId.HasValue
            ? await db.Tenants.FindAsync([user.TenantId.Value], ct)
            : null;
        var tenantSlug = tenant?.Slug ?? (user.IsPlatformAdmin ? "platform" : "demo");

        // Generate tokens
        var accessToken = await jwtTokenService.GenerateAccessTokenAsync(user, tenantSlug);
        var rawRefresh = jwtTokenService.GenerateRefreshToken();
        var tokenHash = JwtTokenService.HashToken(rawRefresh);

        // Revoke old refresh tokens for this user
        var oldTokens = await db.RefreshTokens
            .Where(t => t.UserId == user.Id && !t.IsRevoked && t.ExpiresAt > DateTime.UtcNow)
            .ToListAsync(ct);
        foreach (var old in oldTokens)
            old.IsRevoked = true;

        // Save new refresh token
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = tokenHash,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            CreatedByIp = cmd.IpAddress
        });

        user.LastLoginAt = DateTime.UtcNow;
        if (user.Status == UserStatus.PendingInvitation)
            user.Status = UserStatus.Active;

        await db.SaveChangesAsync(ct);

        var roles = await userManager.GetRolesAsync(user);
        var expiresAt = DateTime.UtcNow.AddMinutes(jwtOptions.Value.AccessTokenExpiryMinutes);

        logger.LogInformation("User {UserId} logged in from {Ip}", user.Id, cmd.IpAddress);

        return Result.Success(new LoginResponse(
            AccessToken:    accessToken,
            RefreshToken:   rawRefresh,
            ExpiresAt:      expiresAt,
            UserId:         user.Id.ToString(),
            Email:          user.Email!,
            FullName:       user.FullName,
            Roles:          roles.ToArray(),
            TenantId:       user.TenantId?.ToString() ?? string.Empty,
            TenantSlug:     tenantSlug,
            IsPlatformAdmin: user.IsPlatformAdmin,
            PreferredLanguage: user.PreferredLanguage,
            TimeZone:       user.TimeZone,
            CurrencyCode:   user.CurrencyCode));
    }
}
