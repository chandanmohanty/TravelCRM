using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Infrastructure.Identity;

namespace TravelCrm.Api.Infrastructure.Persistence;

public static class SeedData
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        var db = services.GetRequiredService<ApplicationDbContext>();
        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = services.GetRequiredService<RoleManager<ApplicationRole>>();

        // ── Platform brand singleton ─────────────────────────────────────────
        if (!await db.PlatformBrandSettings.AnyAsync())
        {
            db.PlatformBrandSettings.Add(new PlatformBrandSettings
            {
                Id              = Guid.Parse("00000000-0000-0000-0000-000000000010"),
                DisplayName     = "TravelCRM",
                PrimaryColorHex = "#5D87FF",
                SupportEmail    = "support@travelcrm.io",
                SupportUrl      = "https://help.travelcrm.io",
                CreatedAt       = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        // ── Permission catalog (global, idempotent) ──────────────────────────
        var catalog = PermissionCatalog.All();
        var existingSlugs = await db.Permissions
            .Where(p => p.TenantId == null)
            .Select(p => p.Slug)
            .ToListAsync();
        var existingSet = new HashSet<string>(existingSlugs, StringComparer.OrdinalIgnoreCase);
        foreach (var p in catalog)
        {
            if (!existingSet.Contains(p.Slug))
                db.Permissions.Add(p);
        }
        await db.SaveChangesAsync();

        // ── Default tenant ────────────────────────────────────────────────────
        if (!db.Tenants.Any())
        {
            db.Tenants.Add(new Tenant
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "TravelCRM Demo",
                Slug = "demo",
                Plan = "Enterprise",
                IsActive = true
            });
            await db.SaveChangesAsync();
        }

        var defaultTenantId = Guid.Parse("00000000-0000-0000-0000-000000000001");

        // ── Platform role ────────────────────────────────────────────────────
        if (!await roleManager.RoleExistsAsync("PlatformAdmin"))
        {
            await roleManager.CreateAsync(new ApplicationRole
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000099"),
                Name = "PlatformAdmin",
                Slug = "platform_admin",
                TenantId = null,
                IsSystemRole = true,
                Description = "SaaS platform administrator — full cross-tenant access"
            });
        }
        else
        {
            // Backfill slug for PlatformAdmin roles seeded before this migration
            var pa = await db.Roles.FirstOrDefaultAsync(r => r.Name == "PlatformAdmin" && r.TenantId == null);
            if (pa is not null && string.IsNullOrEmpty(pa.Slug))
            {
                pa.Slug = "platform_admin";
                await db.SaveChangesAsync();
            }
        }

        // ── Platform admin user ──────────────────────────────────────────────
        var platformEmail = "platform@travelcrm.io";
        var existingPlatform = await userManager.FindByEmailAsync(platformEmail);
        if (existingPlatform == null)
        {
            var platformUser = new ApplicationUser
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000099"),
                TenantId = null,
                IsPlatformAdmin = true,
                UserName = platformEmail,
                Email = platformEmail,
                EmailConfirmed = true,
                FirstName = "Platform",
                LastName = "Admin",
                Status = UserStatus.Active,
                CreatedAt = DateTime.UtcNow
            };
            var result = await userManager.CreateAsync(platformUser, "Platform@12345");
            if (result.Succeeded)
                await userManager.AddToRoleAsync(platformUser, "PlatformAdmin");
        }

        // ── Default-tenant system roles (with slugs + descriptions) ──────────
        var roleDefs = new (string Name, string Slug, string Description)[]
        {
            ("SuperAdmin", "super_admin", "Full tenant-scope access including role & permission management."),
            ("Admin",      "admin",       "Manage users, departments, and tenant settings."),
            ("Manager",    "manager",     "Read-only access to users, roles, and settings."),
            ("ReadOnly",   "read_only",   "Read-only access across the tenant.")
        };

        foreach (var def in roleDefs)
        {
            var existingRole = await db.Roles.FirstOrDefaultAsync(
                r => r.TenantId == defaultTenantId && r.Name == def.Name);

            if (existingRole is null)
            {
                await roleManager.CreateAsync(new ApplicationRole
                {
                    Id = Guid.NewGuid(),
                    Name = def.Name,
                    Slug = def.Slug,
                    TenantId = defaultTenantId,
                    IsSystemRole = true,
                    Description = def.Description
                });
            }
            else if (string.IsNullOrEmpty(existingRole.Slug))
            {
                // Backfill slug on roles seeded before this migration
                existingRole.Slug = def.Slug;
                if (string.IsNullOrEmpty(existingRole.Description))
                    existingRole.Description = def.Description;
                await db.SaveChangesAsync();
            }
        }

        // ── Default-tenant SuperAdmin user ───────────────────────────────────
        var adminEmail = "admin@travelcrm.io";
        var existingAdmin = await userManager.FindByEmailAsync(adminEmail);
        if (existingAdmin == null)
        {
            var adminUser = new ApplicationUser
            {
                Id = Guid.NewGuid(),
                TenantId = defaultTenantId,
                UserName = adminEmail,
                Email = adminEmail,
                EmailConfirmed = true,
                FirstName = "Super",
                LastName = "Admin",
                Status = UserStatus.Active,
                CreatedAt = DateTime.UtcNow
            };

            var result = await userManager.CreateAsync(adminUser, "Admin@12345");
            if (result.Succeeded)
                await userManager.AddToRoleAsync(adminUser, "SuperAdmin");
        }

        // ── Apply the standard role → permission matrix to every tenant ──────
        // Idempotent; safe on every startup. Ensures tenants created before
        // this migration also get their permissions wired up.
        var tenantIds = await db.Tenants.Select(t => t.Id).ToListAsync();
        foreach (var tid in tenantIds)
        {
            await RolePermissionSeeder.SeedForTenantAsync(db, tid);
        }

        // ── Plan catalogue + tenant subscription backfill (Phase 0) ──────────
        // Seeds the 6 plan tiers and ensures every tenant has a TenantSubscription
        // row. Idempotent. Run last so the tenants loop above has already
        // materialised any new tenants created in earlier seed steps.
        await PlanSeeder.SeedAsync(db);
    }
}
