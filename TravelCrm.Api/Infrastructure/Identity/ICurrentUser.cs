namespace TravelCrm.Api.Infrastructure.Identity;

/// <summary>
/// Exposes the authenticated caller's identity claims as strongly-typed properties,
/// so handlers can read user context without reaching into <see cref="HttpContext"/>
/// or parsing JWTs. Register as scoped.
/// </summary>
public interface ICurrentUser
{
    /// <summary>User id (from <c>sub</c>), or <see cref="Guid.Empty"/> when unauthenticated.</summary>
    Guid UserId { get; }

    /// <summary>Email claim, or null when unauthenticated.</summary>
    string? Email { get; }

    /// <summary>All role claims attached to the JWT.</summary>
    IReadOnlyList<string> Roles { get; }

    /// <summary>True when <c>is_platform_admin</c> claim is "true".</summary>
    bool IsPlatformAdmin { get; }

    /// <summary>True when authenticated (UserId is non-empty).</summary>
    bool IsAuthenticated { get; }

    /// <summary>Convenience check: caller has ANY of the supplied role names.</summary>
    bool IsInAnyRole(params string[] roles);

    /// <summary>
    /// True when the caller holds the given permission slug. Platform admins
    /// (who carry a wildcard <c>permission=*</c> claim) return <c>true</c> for
    /// any slug. Slug comparison is case-insensitive.
    /// </summary>
    bool HasPermission(string slug);
}
