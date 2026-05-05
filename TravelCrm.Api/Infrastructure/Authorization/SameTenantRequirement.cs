using Microsoft.AspNetCore.Authorization;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;

namespace TravelCrm.Api.Infrastructure.Authorization;

/// <summary>
/// Resource-based authorization requirement: the caller's tenant (from
/// <see cref="ITenantContext"/>) must match the resource's <c>TenantId</c>.
/// Platform admins (wildcard <c>*</c> permission) are allowed to cross tenants.
///
/// Usage (in a handler or controller):
/// <code>
///   var authz = await authService.AuthorizeAsync(
///       User, resource, new SameTenantRequirement());
///   if (!authz.Succeeded) return Result.Failure("Forbidden.");
/// </code>
/// This is defence-in-depth on top of the tenant-scoped DbContext filters —
/// it protects against id-spoofing in routes where the id isn't pre-filtered.
/// </summary>
public sealed class SameTenantRequirement : IAuthorizationRequirement;

public sealed class SameTenantHandler(
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : AuthorizationHandler<SameTenantRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        SameTenantRequirement requirement)
    {
        // Platform admins bypass tenant boundary.
        if (currentUser.HasPermission("*"))
        {
            context.Succeed(requirement);
            return Task.CompletedTask;
        }

        var callerTenant = tenantContext.TenantId;
        if (callerTenant is null) return Task.CompletedTask;

        var resourceTenant = context.Resource switch
        {
            BaseEntity be        => (Guid?)be.TenantId,
            ITenantScoped ts     => ts.TenantId,
            Guid g               => g,
            _                    => null
        };

        if (resourceTenant is Guid t && t == callerTenant)
            context.Succeed(requirement);

        return Task.CompletedTask;
    }
}

/// <summary>Opt-in marker for non-BaseEntity resources that still carry a TenantId.</summary>
public interface ITenantScoped
{
    Guid? TenantId { get; }
}
