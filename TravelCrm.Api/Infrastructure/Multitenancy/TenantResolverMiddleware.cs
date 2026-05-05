using System.IdentityModel.Tokens.Jwt;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Infrastructure.Auth;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Infrastructure.Multitenancy;

public sealed class TenantResolverMiddleware(RequestDelegate next, ILogger<TenantResolverMiddleware> logger)
{
    private static readonly string[] ExemptPaths =
    [
        "/health",
        "/api/auth/login",
        "/api/auth/refresh",
        "/api/auth/forgot-password",
        "/api/auth/reset-password",
        "/swagger",
        "/api/platform"
    ];

    public async Task InvokeAsync(HttpContext ctx, ApplicationDbContext db)
    {
        var path = ctx.Request.Path.Value ?? "";
        if (ExemptPaths.Any(p => path.StartsWith(p, StringComparison.OrdinalIgnoreCase)))
        {
            await next(ctx);
            return;
        }

        // Platform admin JWTs are not bound to any tenant — skip resolution
        if (IsPlatformAdminJwt(ctx))
        {
            ctx.Items["TenantId"] = null;
            await next(ctx);
            return;
        }

        // 1. Try JWT claim first
        var tenantId = ExtractTenantIdFromJwt(ctx);

        // 2. Try X-Tenant-Id header
        if (tenantId == null
            && ctx.Request.Headers.TryGetValue("X-Tenant-Id", out var headerVal)
            && Guid.TryParse(headerVal, out var hId))
        {
            tenantId = hId;
        }

        // 3. Try subdomain
        if (tenantId == null)
        {
            var host = ctx.Request.Host.Host;
            var slug = host.Split('.').FirstOrDefault();
            if (!string.IsNullOrEmpty(slug) && slug != "localhost" && slug != "www")
            {
                var tenant = await db.Tenants
                    .AsNoTracking()
                    .FirstOrDefaultAsync(t => t.Slug == slug && t.IsActive);
                if (tenant != null)
                    tenantId = tenant.Id;
            }
        }

        // Default to demo tenant for development
        if (tenantId == null)
            tenantId = Guid.Parse("00000000-0000-0000-0000-000000000001");

        ctx.Items["TenantId"] = tenantId.ToString();
        logger.LogDebug("Tenant resolved: {TenantId}", tenantId);

        await next(ctx);
    }

    private static Guid? ExtractTenantIdFromJwt(HttpContext ctx)
    {
        var jwt = ReadJwt(ctx);
        if (jwt is null) return null;
        var claim = jwt.Claims.FirstOrDefault(c => c.Type == CrmClaimTypes.TenantId);
        return Guid.TryParse(claim?.Value, out var id) ? id : null;
    }

    private static bool IsPlatformAdminJwt(HttpContext ctx)
    {
        var jwt = ReadJwt(ctx);
        if (jwt is null) return false;
        var claim = jwt.Claims.FirstOrDefault(c => c.Type == CrmClaimTypes.IsPlatformAdmin);
        return claim?.Value == "true";
    }

    private static JwtSecurityToken? ReadJwt(HttpContext ctx)
    {
        var authHeader = ctx.Request.Headers.Authorization.ToString();
        if (!authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            return null;
        var token = authHeader["Bearer ".Length..].Trim();
        try
        {
            var handler = new JwtSecurityTokenHandler();
            return handler.CanReadToken(token) ? handler.ReadJwtToken(token) : null;
        }
        catch { return null; }
    }
}
