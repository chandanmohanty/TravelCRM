namespace TravelCrm.Api.Infrastructure.Multitenancy;

/// <summary>
/// Default <see cref="ITenantContext"/> implementation that reads the tenant id from
/// <c>HttpContext.Items["TenantId"]</c>. This value is populated by
/// <see cref="TenantResolverMiddleware"/> early in the pipeline.
/// </summary>
public sealed class HttpTenantContext(IHttpContextAccessor httpContextAccessor) : ITenantContext
{
    public Guid? TenantId
    {
        get
        {
            var raw = httpContextAccessor.HttpContext?.Items["TenantId"]?.ToString();
            return Guid.TryParse(raw, out var id) ? id : null;
        }
    }

    public bool IsResolved => TenantId.HasValue;
}
