using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Infrastructure.Identity;

namespace TravelCrm.Api.Infrastructure.Persistence;

/// <summary>
/// Assigns the standard permission set to a tenant's system roles
/// (SuperAdmin / Admin / Manager / ReadOnly). Idempotent — safe to call
/// on every startup and on every new-tenant creation.
///
/// Usage:
/// <list type="bullet">
///   <item><description>At startup for the default demo tenant (<see cref="SeedData"/>).</description></item>
///   <item><description>Inside <c>CreateTenantCommand</c> after roles have been created.</description></item>
/// </list>
/// </summary>
public static class RolePermissionSeeder
{
    /// <summary>Apply the default role → permission map for one tenant.</summary>
    public static async Task SeedForTenantAsync(
        ApplicationDbContext db,
        Guid tenantId,
        CancellationToken ct = default)
    {
        var roles = await db.Roles
            .Where(r => r.TenantId == tenantId)
            .ToListAsync(ct);

        var allPerms = await db.Permissions
            .Where(p => p.TenantId == null) // global catalog only
            .ToListAsync(ct);
        if (allPerms.Count == 0) return;

        foreach (var role in roles)
        {
            var slug = (role.Slug ?? role.Name ?? string.Empty).ToLowerInvariant();
            var desiredSlugs = PermissionsFor(slug);
            if (desiredSlugs is null) continue;

            var desired = desiredSlugs == MatchAll
                ? allPerms.Select(p => p.Id).ToHashSet()
                : allPerms.Where(p => desiredSlugs.Contains(p.Slug)).Select(p => p.Id).ToHashSet();

            var existing = await db.RolePermissions
                .Where(rp => rp.RoleId == role.Id)
                .ToListAsync(ct);

            // Add missing
            foreach (var permId in desired.Except(existing.Select(e => e.PermissionId)))
            {
                db.RolePermissions.Add(new RolePermission
                {
                    RoleId       = role.Id,
                    PermissionId = permId,
                    TenantId     = role.TenantId,
                    GrantedAt    = DateTime.UtcNow
                });
            }

            // Remove rows that aren't in the desired set (only for seeded system roles;
            // custom-created roles keep whatever admins configured)
            if (role.IsSystemRole)
            {
                foreach (var stale in existing.Where(e => !desired.Contains(e.PermissionId)))
                    db.RolePermissions.Remove(stale);
            }
        }

        await db.SaveChangesAsync(ct);
    }

    /// <summary>Sentinel value for "grant every permission in the catalog".</summary>
    private static readonly HashSet<string> MatchAll = new();

    /// <summary>
    /// Maps a role slug/name to the set of permission slugs it should hold,
    /// or <see cref="MatchAll"/> to mean "every permission in the catalog".
    /// Returns <c>null</c> for unknown roles — those are skipped.
    /// </summary>
    private static HashSet<string>? PermissionsFor(string roleKey) => roleKey switch
    {
        "superadmin" or "super_admin" => MatchAll,

        "admin" => new HashSet<string>
        {
            // User management (no delete)
            "admin.users.view", "admin.users.create", "admin.users.update",
            "admin.users.deactivate", "admin.users.assign_role", "admin.users.reset_password",
            // Role management — read only
            "admin.roles.view",
            // Departments — full
            "admin.departments.view", "admin.departments.create",
            "admin.departments.update", "admin.departments.delete",
            // Settings
            "admin.settings.view", "admin.settings.update",
            "admin.branding.update", "admin.storage.update", "admin.email.update",
            // AI providers
            "admin.ai.view", "admin.ai.update",
            // Scheduled tasks panel
            "admin.scheduled_tasks.view", "admin.scheduled_tasks.run",
            // Data reset (destructive — Admin can execute, Manager/ReadOnly cannot)
            "admin.data_reset.execute",
            // Audit
            "audit.logs.view",
            // Dashboards
            "dashboard.overview.view",
            // CRM — full task management for admins
            "crm.tasks.view", "crm.tasks.manage", "crm.tasks.admin",
            // Inventory — full
            "inventory.suppliers.view", "inventory.suppliers.manage",
            "inventory.resources.view", "inventory.resources.manage",
            "inventory.calendar.view",  "inventory.calendar.manage",
            "inventory.holds.view",     "inventory.holds.manage",
            // Tenant settings (HoldTtlHours override) — admin-only
            "inventory.tenant_settings.manage",
        },

        "manager" => new HashSet<string>
        {
            "admin.users.view",
            "admin.roles.view",
            "admin.departments.view",
            "admin.settings.view",
            "dashboard.overview.view",
            // CRM — managers can create / edit tasks but not manage the type catalog
            "crm.tasks.view", "crm.tasks.manage",
            // Inventory — managers can manage resources/calendar/holds but not suppliers
            "inventory.suppliers.view",
            "inventory.resources.view", "inventory.resources.manage",
            "inventory.calendar.view",  "inventory.calendar.manage",
            "inventory.holds.view",     "inventory.holds.manage",
        },

        "readonly" or "read_only" => new HashSet<string>
        {
            "admin.users.view",
            "admin.roles.view",
            "admin.departments.view",
            "admin.settings.view",
            "dashboard.overview.view",
            // CRM — read-only users can view tasks
            "crm.tasks.view",
            // Inventory — read-only sees the catalog
            "inventory.suppliers.view",
            "inventory.resources.view",
            "inventory.calendar.view",
            "inventory.holds.view",
        },

        _ => null
    };
}
