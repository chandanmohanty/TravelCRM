using MediatR;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Auth.DTOs;
using TravelCrm.Api.Infrastructure.Auth;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Auth.Commands.Refresh;

public sealed class RefreshCommandHandler(
    ApplicationDbContext db,
    UserManager<ApplicationUser> userManager,
    JwtTokenService jwtTokenService,
    ILogger<RefreshCommandHandler> logger)
    : IRequestHandler<RefreshCommand, Result<LoginResponse>>
{
    public async Task<Result<LoginResponse>> Handle(RefreshCommand cmd, CancellationToken ct)
    {
        var hash = JwtTokenService.HashToken(cmd.RefreshToken);
        var storedToken = await db.RefreshTokens
            .FirstOrDefaultAsync(t => t.TokenHash == hash, ct);

        if (storedToken == null || storedToken.IsRevoked || storedToken.ExpiresAt < DateTime.UtcNow)
            return Result.Failure<LoginResponse>("Invalid or expired refresh token.");

        var user = await userManager.FindByIdAsync(storedToken.UserId.ToString());
        if (user == null || user.IsDeleted || user.Status == UserStatus.Inactive)
            return Result.Failure<LoginResponse>("User account is no longer active.");

        Tenant? tenant = user.TenantId.HasValue
            ? await db.Tenants.FindAsync([user.TenantId.Value], ct)
            : null;
        var tenantSlug = tenant?.Slug ?? (user.IsPlatformAdmin ? "platform" : "demo");

        // Rotate token
        storedToken.IsRevoked = true;
        var newRaw = jwtTokenService.GenerateRefreshToken();
        var newHash = JwtTokenService.HashToken(newRaw);

        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = newHash,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            CreatedByIp = cmd.IpAddress,
            ReplacedById = storedToken.Id
        });

        await db.SaveChangesAsync(ct);

        var accessToken = await jwtTokenService.GenerateAccessTokenAsync(user, tenantSlug);
        var roles = await userManager.GetRolesAsync(user);

        return Result.Success(new LoginResponse(
            AccessToken:     accessToken,
            RefreshToken:    newRaw,
            ExpiresAt:       DateTime.UtcNow.AddMinutes(15),
            UserId:          user.Id.ToString(),
            Email:           user.Email!,
            FullName:        user.FullName,
            Roles:           roles.ToArray(),
            TenantId:        user.TenantId?.ToString() ?? string.Empty,
            TenantSlug:      tenantSlug,
            IsPlatformAdmin: user.IsPlatformAdmin,
            PreferredLanguage: user.PreferredLanguage,
            TimeZone:        user.TimeZone,
            CurrencyCode:    user.CurrencyCode));
    }
}
