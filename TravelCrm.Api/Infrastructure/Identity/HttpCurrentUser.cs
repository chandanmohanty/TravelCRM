using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using TravelCrm.Api.Infrastructure.Auth;

namespace TravelCrm.Api.Infrastructure.Identity;

/// <summary>
/// Default <see cref="ICurrentUser"/> that reads claims from the authenticated
/// <see cref="HttpContext.User"/> populated by JWT middleware.
/// </summary>
public sealed class HttpCurrentUser(IHttpContextAccessor httpContextAccessor) : ICurrentUser
{
    private ClaimsPrincipal? Principal => httpContextAccessor.HttpContext?.User;

    public Guid UserId
    {
        get
        {
            var sub = Principal?.FindFirstValue(JwtRegisteredClaimNames.Sub)
                      ?? Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
            return Guid.TryParse(sub, out var id) ? id : Guid.Empty;
        }
    }

    public string? Email =>
        Principal?.FindFirstValue(JwtRegisteredClaimNames.Email)
        ?? Principal?.FindFirstValue(ClaimTypes.Email);

    public IReadOnlyList<string> Roles =>
        Principal?.FindAll(ClaimTypes.Role).Select(c => c.Value).ToArray()
        ?? [];

    public bool IsPlatformAdmin =>
        Principal?.FindFirstValue(CrmClaimTypes.IsPlatformAdmin) == "true";

    public bool IsAuthenticated =>
        Principal?.Identity?.IsAuthenticated == true && UserId != Guid.Empty;

    public bool IsInAnyRole(params string[] roles)
    {
        if (roles.Length == 0) return false;
        var mine = Roles;
        return roles.Any(r => mine.Contains(r, StringComparer.OrdinalIgnoreCase));
    }

    public bool HasPermission(string slug)
    {
        if (string.IsNullOrWhiteSpace(slug) || Principal is null) return false;
        // Platform admins hold a wildcard "*" — pass every check.
        if (Principal.HasClaim(CrmClaimTypes.Permission, "*")) return true;
        // Case-insensitive match against the user's own permission claims.
        return Principal.FindAll(CrmClaimTypes.Permission)
            .Any(c => string.Equals(c.Value, slug, StringComparison.OrdinalIgnoreCase));
    }
}
