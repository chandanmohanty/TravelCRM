using TravelCrm.Api.Domain.Entities;

namespace TravelCrm.Api.Common;

/// <summary>
/// Single source of truth for every permission slug the app knows about.
/// Seeded into the global <see cref="Permission"/> catalog at startup —
/// idempotent, keyed on <see cref="Permission.Slug"/>.
///
/// Structure: <c>module.submodule.action</c>.
///
/// When a new module lands, extend this catalog (add a static class + entries)
/// so the seeder picks it up on next boot. The existing static constants in
/// <see cref="Permissions"/> stay as type-safe references for code that checks
/// capabilities via <c>ICurrentUser.HasPermission(Permissions.Users.Create)</c>.
/// </summary>
public static class PermissionCatalog
{
    // ── Standard CRUD template ─────────────────────────────────────────

    private static IEnumerable<Permission> Crud(
        string module, string submodule, string label, int baseOrder,
        bool includeViewAll = false)
    {
        yield return New(module, submodule, "view",   $"View {label}",   baseOrder + 0);
        if (includeViewAll)
            yield return New(module, submodule, "view-all", $"View All {label}", baseOrder + 1);
        yield return New(module, submodule, "create", $"Create {label}", baseOrder + 2);
        yield return New(module, submodule, "update", $"Update {label}", baseOrder + 3);
        yield return New(module, submodule, "delete", $"Delete {label}", baseOrder + 4);
    }

    private static Permission New(string module, string submodule, string action,
        string name, int sortOrder, string? description = null)
        => new()
        {
            Id          = Guid.NewGuid(),
            TenantId    = null,              // global catalog entry
            Slug        = $"{module}.{submodule}.{action}",
            Name        = name,
            Module      = module,
            Submodule   = submodule,
            Action      = action,
            Description = description,
            SortOrder   = sortOrder,
            CreatedAt   = DateTime.UtcNow
        };

    /// <summary>Full catalog — enumerated by <c>SeedData</c>.</summary>
    public static IReadOnlyList<Permission> All()
    {
        var items = new List<Permission>();

        // Admin — Users
        items.AddRange(Crud("admin", "users", "Users", 100));
        items.Add(New("admin", "users", "deactivate",
            "Activate / Deactivate Users", 105,
            "Toggle a user's active status without deleting their data."));
        items.Add(New("admin", "users", "assign_role",
            "Assign User Roles", 106));
        items.Add(New("admin", "users", "reset_password",
            "Send Password Reset Links", 107));

        // Admin — Roles
        items.AddRange(Crud("admin", "roles", "Roles", 200));
        items.Add(New("admin", "roles", "assign_permissions",
            "Assign Permissions to Roles", 205,
            "Edit the permission matrix for custom tenant roles."));

        // Admin — Departments
        items.AddRange(Crud("admin", "departments", "Departments", 300));

        // Admin — Settings
        items.Add(New("admin", "settings", "view",   "View Settings",   400));
        items.Add(New("admin", "settings", "update", "Update Settings", 401));

        // Admin — Branding / Storage / Email configuration sections
        items.Add(New("admin", "branding", "update", "Manage Brand Settings",   410));
        items.Add(New("admin", "storage",  "update", "Manage Storage Settings", 420));
        items.Add(New("admin", "email",    "update", "Manage Email Settings",   430));

        // AI Providers (Claude / OpenAI config per tenant)
        items.Add(New("admin", "ai", "view",   "View AI Provider Settings", 435));
        items.Add(New("admin", "ai", "update", "Manage AI Provider Settings", 436,
            "Create, edit, activate, and test Claude / OpenAI configurations."));

        // Scheduled tasks (Hangfire recurring jobs panel)
        items.Add(New("admin", "scheduled_tasks", "view",
            "View Scheduled Tasks", 440));
        items.Add(New("admin", "scheduled_tasks", "run",
            "Run Scheduled Tasks Manually", 441,
            "Fire a recurring job immediately via the Scheduled Tasks panel."));

        // Data reset (destructive — admin/super-admin only)
        items.Add(New("admin", "data_reset", "execute",
            "Reset Tenant Data", 450,
            "Wipe tenant data except the admin user, tenant row, and config tables."));

        // Audit logs
        items.Add(New("audit", "logs", "view", "View Audit Logs", 500));

        // Dashboards — baseline viewer permissions (extend per-dashboard later)
        items.Add(New("dashboard", "overview", "view", "View Overview Dashboard", 600));

        // CRM — Tasks (task management module)
        items.Add(New("crm", "tasks", "view", "View Tasks", 700,
            "Read tasks, time entries, and task types within the tenant."));
        items.Add(New("crm", "tasks", "manage", "Create / Update / Delete Tasks", 701,
            "Create tasks, edit fields, log time, soft-delete and restore."));
        items.Add(New("crm", "tasks", "admin", "Manage Task Types", 702,
            "Create / update / delete the tenant's task type catalog."));

        // CRM — Deals (pipeline kanban)
        items.Add(New("crm", "deals", "view", "View Deals", 710,
            "List, view, and see the kanban of deals."));
        items.Add(New("crm", "deals", "manage", "Manage Deals", 711,
            "Create, edit, move stages, reassign, and add notes."));
        items.Add(New("crm", "deals", "delete", "Delete Deals", 712,
            "Delete open deals (closed deals are immutable)."));

        // CRM — Pipelines
        items.Add(New("crm", "pipelines", "manage", "Manage Pipelines", 721,
            "Create, edit, reorder and delete pipelines and stages."));

        // Inventory — Suppliers / Resources / Calendar / Holds (foundation)
        items.Add(New("inventory", "suppliers", "view", "View Suppliers", 800,
            "Read suppliers in the tenant."));
        items.Add(New("inventory", "suppliers", "manage", "Manage Suppliers", 801,
            "Create / update / delete suppliers."));
        items.Add(New("inventory", "resources", "view", "View Resources", 802,
            "Read inventory resources (hotels, rooms, vehicles, drivers, ...)."));
        items.Add(New("inventory", "resources", "manage", "Manage Resources", 803,
            "Create / update / block resources."));
        items.Add(New("inventory", "calendar", "view", "View Calendar", 804,
            "Read availability calendars."));
        items.Add(New("inventory", "calendar", "manage", "Manage Calendar", 805,
            "Set capacity overrides and block / unblock dates."));
        items.Add(New("inventory", "holds", "view", "View Holds", 806,
            "Read soft and confirmed inventory holds (audit)."));
        items.Add(New("inventory", "holds", "manage", "Manage Holds", 807,
            "Create / confirm / release / extend holds."));

        // Inventory — Tenant Settings (admin-only, sensitive TTL override)
        items.Add(New("inventory", "tenant_settings", "manage", "Manage Inventory Tenant Settings", 808,
            "View and update per-tenant inventory settings such as HoldTtlHours."));

        return items;
    }
}
