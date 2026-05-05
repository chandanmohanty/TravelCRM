using Hangfire.Dashboard;
using TravelCrm.Api.Infrastructure.Auth;

namespace TravelCrm.Api.Infrastructure.Jobs;

/// <summary>
/// Restricts <c>/hangfire</c> to authenticated users carrying the
/// <c>is_platform_admin=true</c> JWT claim. The dashboard exposes
/// all recurring jobs across the server, so it's intentionally a
/// platform-admin-only surface.
/// </summary>
public sealed class HangfireDashboardAuthorization : IDashboardAuthorizationFilter
{
    public bool Authorize(DashboardContext context)
    {
        var http = context.GetHttpContext();
        if (http.User?.Identity?.IsAuthenticated != true) return false;
        var claim = http.User.FindFirst(CrmClaimTypes.IsPlatformAdmin);
        return claim is not null && string.Equals(claim.Value, "true", StringComparison.OrdinalIgnoreCase);
    }
}
