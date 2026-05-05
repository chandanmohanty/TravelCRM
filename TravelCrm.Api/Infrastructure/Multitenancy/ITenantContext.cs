namespace TravelCrm.Api.Infrastructure.Multitenancy;

/// <summary>
/// Provides the current request's resolved tenant identifier, abstracted away from
/// <see cref="HttpContext"/>. Register as scoped. Implementations should resolve the
/// tenant from whatever mechanism <see cref="TenantResolverMiddleware"/> uses
/// (claim, header, subdomain, fallback) and expose it as a strong type.
/// </summary>
public interface ITenantContext
{
    /// <summary>
    /// The tenant id resolved for the current request, or <c>null</c> when the caller is
    /// a platform admin (cross-tenant) or the path is exempt from tenant resolution.
    /// </summary>
    Guid? TenantId { get; }

    /// <summary>True when <see cref="TenantId"/> is non-null.</summary>
    bool IsResolved { get; }
}
