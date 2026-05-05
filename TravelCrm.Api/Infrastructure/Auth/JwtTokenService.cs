using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Infrastructure.Auth;

public sealed class JwtTokenService(
    IOptions<JwtSettings> jwtOptions,
    UserManager<ApplicationUser> userManager,
    ApplicationDbContext db)
{
    private readonly JwtSettings _settings = jwtOptions.Value;

    public async Task<string> GenerateAccessTokenAsync(ApplicationUser user, string tenantSlug)
    {
        var roles = await userManager.GetRolesAsync(user);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub,        user.Id.ToString()),
            new(JwtRegisteredClaimNames.Jti,        Guid.NewGuid().ToString()),
            new(JwtRegisteredClaimNames.Email,      user.Email!),
            new(JwtRegisteredClaimNames.GivenName,  user.FirstName),
            new(JwtRegisteredClaimNames.FamilyName, user.LastName),
            new(CrmClaimTypes.TenantId,             user.TenantId?.ToString() ?? string.Empty),
            new(CrmClaimTypes.TenantSlug,           tenantSlug),
            new(CrmClaimTypes.IsPlatformAdmin,      user.IsPlatformAdmin ? "true" : "false"),
            new(CrmClaimTypes.PreferredLanguage,    user.PreferredLanguage),
        };

        foreach (var role in roles)
            claims.Add(new Claim(ClaimTypes.Role, role));

        // ── Permission claims ────────────────────────────────────────────────
        // Platform admins get a wildcard. Everyone else gets the distinct set
        // of permission slugs resolved from their role memberships, so
        // authorization checks are O(1) on every request (no DB round-trip).
        if (user.IsPlatformAdmin)
        {
            claims.Add(new Claim(CrmClaimTypes.Permission, "*"));
        }
        else
        {
            var roleIds = await db.UserRoles
                .Where(ur => ur.UserId == user.Id)
                .Select(ur => ur.RoleId)
                .ToListAsync();

            if (roleIds.Count > 0)
            {
                var slugs = await db.RolePermissions
                    .Where(rp => roleIds.Contains(rp.RoleId))
                    .Join(db.Permissions, rp => rp.PermissionId, p => p.Id, (_, p) => p.Slug)
                    .Distinct()
                    .ToListAsync();

                foreach (var slug in slugs)
                    claims.Add(new Claim(CrmClaimTypes.Permission, slug));
            }
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.SecretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _settings.Issuer,
            audience: _settings.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(_settings.AccessTokenExpiryMinutes),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateRefreshToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));

    public static string HashToken(string token)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes);
    }
}
