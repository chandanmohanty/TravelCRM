# Inventory Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the generic Resource + Supplier + Calendar + Hold engine that downstream travel-resource sub-projects (Hotel, Vehicle, Driver, Guide, Activity) will extend.

**Architecture:** Single-project ASP.NET Core 8 + EF Core 8 + PostgreSQL backend with MediatR CQRS handlers (one feature per file). 5 entities (`Supplier`, `Resource` TPH `PoolResource`/`AssetResource`, `ResourceCalendar`, `ResourceHold`, plus `InventorySettings`); ~20 CQRS handlers across 4 features (Suppliers, Resources, Calendar, Holds); strategy interface for future pricing modules; Hangfire daily job for hold expiry. Angular 21 standalone frontend ships only the Suppliers CRUD page.

**Tech Stack:** ASP.NET Core 8, MediatR 12, EF Core 8 (snake_case via EFCore.NamingConventions), Hangfire, FluentValidation; xUnit + FluentAssertions + hand-rolled fakes (no Moq); Angular 21 standalone components, OnPush change detection, Tabler icons.

**Reference spec:** `docs/superpowers/specs/2026-04-27-inventory-foundation-design.md`

---

## File Map

### Backend — files to create

```
TravelCrm.Api/Domain/Entities/Inventory/
  Supplier.cs
  SupplierType.cs                                              (enum)
  Resource.cs                                                  (abstract)
  ResourceKind.cs                                              (enum)
  ResourceStatus.cs                                            (enum)
  PoolResource.cs                                              (: Resource)
  AssetResource.cs                                             (: Resource)
  ResourceCalendar.cs
  ResourceCalendarSlot.cs                                      (enum)
  ResourceHold.cs
  ResourceHoldStatus.cs                                        (enum)

TravelCrm.Api/Domain/Entities/
  InventorySettings.cs                                         (per-tenant hold TTL settings)

TravelCrm.Api/Features/Inventory/
  Suppliers/
    SupplierDto.cs                                             (DTO + mapper)
    Commands/CreateSupplierCommand.cs                          (cmd + validator + handler)
    Commands/UpdateSupplierCommand.cs
    Commands/DeleteSupplierCommand.cs
    Queries/ListSuppliersQuery.cs
    Queries/GetSupplierQuery.cs
    SuppliersController.cs

  Resources/
    ResourceDto.cs                                             (handles both Pool + Asset)
    Commands/CreateResourceCommand.cs
    Commands/UpdateResourceCommand.cs
    Commands/BlockResourceCommand.cs
    Commands/UnblockResourceCommand.cs
    Queries/ListResourcesQuery.cs
    Queries/GetResourceQuery.cs
    ResourcesController.cs

  Calendar/
    AvailabilityDto.cs
    AvailabilityCalculator.cs                                  (CRITICAL — pure availability algorithm)
    Commands/SetCapacityCommand.cs
    Commands/BlockDateCommand.cs
    Commands/UnblockDateCommand.cs
    Queries/CheckAvailabilityQuery.cs
    CalendarController.cs

  Holds/
    HoldDto.cs
    IResourcePricing.cs                                        (strategy interface)
    NullResourcePricing.cs                                     (default impl)
    Commands/CreateHoldCommand.cs                              (with SELECT FOR UPDATE)
    Commands/ConfirmHoldCommand.cs
    Commands/ReleaseHoldCommand.cs
    Commands/ExtendHoldCommand.cs
    Queries/ListHoldsQuery.cs
    Queries/GetHoldQuery.cs
    HoldsController.cs

TravelCrm.Api/Infrastructure/Jobs/
  HoldExpirySweepJob.cs

TravelCrm.Tests/Inventory/
  SupplierHandlersTests.cs
  ResourceHandlersTests.cs
  CalendarHandlersTests.cs
  HoldHandlersTests.cs
  AvailabilityCalculationTests.cs                              (CRITICAL — table-driven)
  HoldExpirySweepJobTests.cs
  HoldConcurrencyTests.cs                                      (PG-only, optional)
```

### Backend — files to modify

```
TravelCrm.Api/Infrastructure/Persistence/ApplicationDbContext.cs       (add 6 DbSets + TPH config + indexes)
TravelCrm.Api/Common/PermissionCatalog.cs                              (add 8 inventory.* slugs)
TravelCrm.Api/Infrastructure/Persistence/RolePermissionSeeder.cs       (assign new slugs to admin/manager/readonly)
TravelCrm.Api/Infrastructure/Jobs/RecurringJobRegistrar.cs             (register HoldExpirySweepJob)
TravelCrm.Api/Program.cs                                               (DI registration: NullResourcePricing, HoldExpirySweepJob)
```

### Frontend — files to create

```
src/app/models/
  inventory.model.ts                                           (Supplier/SupplierType + Resource interfaces)

src/app/core/services/
  suppliers.service.ts                                         (HTTP service)

src/app/pages/inventory/
  inventory.routes.ts                                          (lazy children: suppliers/*)
  suppliers/
    supplier-list/supplier-list.component.ts
    supplier-form/supplier-form.component.ts
```

### Frontend — files to modify

```
src/app/app.routes.ts                                                  (register inventory route group)
src/app/layouts/full/vertical/sidebar/sidebar-data.ts                  (Inventory section + Suppliers entry)
src/app/layouts/full/vertical/sidebar/icon-menu/iconmenu-data.ts       (id: 11 Inventory icon)
src/app/layouts/full/vertical/header/header.component.ts               (Suppliers in apps[] tenantOnly)
src/app/layouts/full/horizontal/header/header.component.ts             (same)
```

### EF migration

```
TravelCrm.Api/Migrations/<timestamp>_AddInventoryFoundation.cs         (generated)
```

---

## Common Commands Reference

```bash
# Build the API
dotnet build TravelCrm.Api

# Run inventory tests
dotnet test TravelCrm.Tests --filter "FullyQualifiedName~Inventory" -v minimal

# Run all tests
dotnet test TravelCrm.Tests -v minimal

# EF migration (run from TravelCrm.Api/)
cd TravelCrm.Api
dotnet ef migrations add AddInventoryFoundation
dotnet ef database update

# Angular build
npx ng build --configuration development
```

---

## Codebase Conventions to Honor

These are derived from existing patterns the implementer must mirror exactly:

1. **`ICurrentUser.UserId`** — the property is `UserId`, not `Id`. Lives in `TravelCrm.Api.Infrastructure.Identity`.
2. **`Result` and `Result<T>`** — at `TravelCrm.Api.Common`. Use `Result.Failure<T>("message")` / `Result.Success(value)`.
3. **`ITenantContext`** — at `TravelCrm.Api.Infrastructure.Multitenancy`. Always check `tenantContext.IsResolved` before using `TenantId`.
4. **Sealed everything** — entities, commands, validators, handlers all `sealed`.
5. **Primary constructor DI** — handler classes use `(ApplicationDbContext db, ITenantContext tenantContext, ICurrentUser currentUser)` etc.
6. **`default!` for required string properties** (matches `Notification` entity pattern).
7. **`AsNoTracking()` on every read query** — match `LeadsQuery` pattern.
8. **Tests use `TestDb.New()`** — returns `(db, tenant, tenantId)`. `FakeCurrentUser(Guid userId, bool hasPermission = true)` exposes `.UserId`. `FakeTenantContext(Guid tenantId)`.
9. **Handler order: permission → tenant resolved → load → mutate → save → return DTO**.
10. **Stage commits explicitly** — never `git add .` (the repo has many untracked unrelated files).
11. **Frontend service URLs** must include `/api/` prefix: `${this.base}/api/inventory/...`.
12. **Frontend layout** — use the `crm-page` / `page-header` / `page-actions` / `kpi-grid` pattern from `Companies` / `Tasks` components. Use `<i-tabler name="...">` for icons.

---

---

## Task 1: Domain Entities & Enums

**Files:**
- Create: `TravelCrm.Api/Domain/Entities/Inventory/SupplierType.cs`
- Create: `TravelCrm.Api/Domain/Entities/Inventory/Supplier.cs`
- Create: `TravelCrm.Api/Domain/Entities/Inventory/ResourceKind.cs`
- Create: `TravelCrm.Api/Domain/Entities/Inventory/ResourceStatus.cs`
- Create: `TravelCrm.Api/Domain/Entities/Inventory/Resource.cs`
- Create: `TravelCrm.Api/Domain/Entities/Inventory/PoolResource.cs`
- Create: `TravelCrm.Api/Domain/Entities/Inventory/AssetResource.cs`
- Create: `TravelCrm.Api/Domain/Entities/Inventory/ResourceCalendarSlot.cs`
- Create: `TravelCrm.Api/Domain/Entities/Inventory/ResourceCalendar.cs`
- Create: `TravelCrm.Api/Domain/Entities/Inventory/ResourceHoldStatus.cs`
- Create: `TravelCrm.Api/Domain/Entities/Inventory/ResourceHold.cs`
- Create: `TravelCrm.Api/Domain/Entities/InventorySettings.cs`

> **Read first:** `TravelCrm.Api/Domain/Entities/BaseEntity.cs` (gives `Id`, `TenantId`, `CreatedAt`, `UpdatedAt`, `CreatedBy` (Guid?), `UpdatedBy` (Guid?)) and `TravelCrm.Api/Domain/Entities/SystemSettings.cs` (settings entities use `IAuditableEntity` not `BaseEntity` because `Id` and `TenantId` are both first-class with `TenantId` being the unique-per-tenant FK).

- [ ] **Step 1: Create `SupplierType.cs`**

```csharp
namespace TravelCrm.Api.Domain.Entities.Inventory;

public enum SupplierType
{
    Hotel = 0,
    Transport = 1,
    Activity = 2,
    Guide = 3,
    Other = 4,
}
```

- [ ] **Step 2: Create `Supplier.cs`**

```csharp
namespace TravelCrm.Api.Domain.Entities.Inventory;

public sealed class Supplier : BaseEntity
{
    public string Name { get; set; } = default!;
    public SupplierType SupplierType { get; set; } = SupplierType.Other;
    public string? ContactName { get; set; }
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public string? Address { get; set; }
    public DateOnly? ContractValidFrom { get; set; }
    public DateOnly? ContractValidTo { get; set; }
    public bool IsActive { get; set; } = true;
}
```

- [ ] **Step 3: Create `ResourceKind.cs`**

```csharp
namespace TravelCrm.Api.Domain.Entities.Inventory;

public enum ResourceKind
{
    Pool = 0,
    Asset = 1,
}
```

- [ ] **Step 4: Create `ResourceStatus.cs`**

```csharp
namespace TravelCrm.Api.Domain.Entities.Inventory;

public enum ResourceStatus
{
    Active = 0,
    Inactive = 1,
    Maintenance = 2,
    Blocked = 3,
}
```

- [ ] **Step 5: Create `Resource.cs` (abstract base)**

```csharp
namespace TravelCrm.Api.Domain.Entities.Inventory;

public abstract class Resource : BaseEntity
{
    /// <summary>Discriminator. Set automatically by subclass constructors.</summary>
    public ResourceKind Kind { get; protected set; }

    /// <summary>Free-form type slug ("Hotel", "RoomType", "Vehicle", "Driver", ...). Sub-modules add their own values.</summary>
    public string Type { get; set; } = default!;

    public string Name { get; set; } = default!;

    /// <summary>Nullable: null = tenant-owned, otherwise FK to Supplier.</summary>
    public Guid? SupplierId { get; set; }

    public ResourceStatus Status { get; set; } = ResourceStatus.Active;

    /// <summary>Module-specific JSON metadata (room amenities, vehicle reg, license number). Opaque to the foundation.</summary>
    public string? Metadata { get; set; }

    public Supplier? Supplier { get; set; }
}
```

- [ ] **Step 6: Create `PoolResource.cs`**

```csharp
namespace TravelCrm.Api.Domain.Entities.Inventory;

public sealed class PoolResource : Resource
{
    public PoolResource() { Kind = ResourceKind.Pool; }

    /// <summary>Available units per date when no ResourceCalendar override exists.</summary>
    public int DefaultCapacity { get; set; }
}
```

- [ ] **Step 7: Create `AssetResource.cs`**

```csharp
namespace TravelCrm.Api.Domain.Entities.Inventory;

public sealed class AssetResource : Resource
{
    public AssetResource() { Kind = ResourceKind.Asset; }

    /// <summary>Vehicle registration / employee code / license number — for human reference. Not unique-constrained.</summary>
    public string? AssetCode { get; set; }
}
```

- [ ] **Step 8: Create `ResourceCalendarSlot.cs`**

```csharp
namespace TravelCrm.Api.Domain.Entities.Inventory;

public enum ResourceCalendarSlot
{
    Morning = 0,
    Afternoon = 1,
    Evening = 2,
}
```

- [ ] **Step 9: Create `ResourceCalendar.cs`**

```csharp
namespace TravelCrm.Api.Domain.Entities.Inventory;

public sealed class ResourceCalendar : BaseEntity
{
    public Guid ResourceId { get; set; }

    public DateOnly Date { get; set; }

    /// <summary>Null = whole-day bucket. Otherwise specific slot.</summary>
    public ResourceCalendarSlot? Slot { get; set; }

    /// <summary>For pool: overrides PoolResource.DefaultCapacity. For asset: 0 or 1.</summary>
    public int Capacity { get; set; }

    public bool IsBlocked { get; set; }

    public string? Notes { get; set; }

    /// <summary>EF concurrency token. PostgreSQL xmin.</summary>
    public uint RowVersion { get; set; }

    public Resource? Resource { get; set; }
}
```

- [ ] **Step 10: Create `ResourceHoldStatus.cs`**

```csharp
namespace TravelCrm.Api.Domain.Entities.Inventory;

public enum ResourceHoldStatus
{
    Held = 0,
    Confirmed = 1,
    Released = 2,
    Expired = 3,
}
```

- [ ] **Step 11: Create `ResourceHold.cs`**

```csharp
namespace TravelCrm.Api.Domain.Entities.Inventory;

public sealed class ResourceHold : BaseEntity
{
    public Guid ResourceId { get; set; }

    /// <summary>Inclusive.</summary>
    public DateOnly StartDate { get; set; }

    /// <summary>Inclusive. Single-day hold has Start == End.</summary>
    public DateOnly EndDate { get; set; }

    /// <summary>Same enum as ResourceCalendar.Slot.</summary>
    public ResourceCalendarSlot? Slot { get; set; }

    /// <summary>For pool: number of units. For asset: must be 1.</summary>
    public int Quantity { get; set; } = 1;

    public ResourceHoldStatus Status { get; set; } = ResourceHoldStatus.Held;

    /// <summary>UTC. Non-null only when Status == Held.</summary>
    public DateTime? ExpiresAt { get; set; }

    /// <summary>Set when the future Booking module attaches a booking id.</summary>
    public string? BookingRef { get; set; }

    public Guid HeldByUserId { get; set; }

    public string? Notes { get; set; }

    /// <summary>Number of times ExtendHold has been invoked. Caps at 3.</summary>
    public int ExtensionCount { get; set; }

    public Resource? Resource { get; set; }
}
```

- [ ] **Step 12: Create `InventorySettings.cs`**

> Matches the existing `SystemSettings` / `InvoiceSettings` pattern — implements `IAuditableEntity` (not `BaseEntity`) so `TenantId` can be the unique-per-tenant FK, and the row is lazy-created on first save.

```csharp
namespace TravelCrm.Api.Domain.Entities;

/// <summary>
/// Tenant-scoped Inventory module settings (one row per tenant, lazy-created).
/// Currently only holds HoldTtlHours; future inventory features add their own columns here.
/// </summary>
public sealed class InventorySettings : IAuditableEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    /// <summary>How long a soft-hold remains valid before the sweeper expires it. Default 24h.</summary>
    public int HoldTtlHours { get; set; } = 24;

    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
}
```

- [ ] **Step 13: Verify build**

Run: `dotnet build TravelCrm.Api`
Expected: 0 errors. Pre-existing CS9113 warnings in unrelated Auth / Identity files are fine.

- [ ] **Step 14: Commit**

```bash
git add TravelCrm.Api/Domain/Entities/Inventory/ \
        TravelCrm.Api/Domain/Entities/InventorySettings.cs
git commit -m "feat(inventory): add domain entities and enums for inventory foundation"
```

---

## Task 2: DbContext Configuration & EF Migration

**Files:**
- Modify: `TravelCrm.Api/Infrastructure/Persistence/ApplicationDbContext.cs` (add 6 DbSets + entity configs)
- Generated: `TravelCrm.Api/Migrations/<timestamp>_AddInventoryFoundation.cs`

- [ ] **Step 1: Add DbSets to `ApplicationDbContext.cs`**

Find the existing DbSet declarations (e.g. `public DbSet<Lead> Leads => Set<Lead>();`) and add a new section grouped under a comment banner:

```csharp
// ── Inventory ──
public DbSet<Supplier> Suppliers => Set<Supplier>();
public DbSet<Resource> Resources => Set<Resource>();
public DbSet<PoolResource> PoolResources => Set<PoolResource>();
public DbSet<AssetResource> AssetResources => Set<AssetResource>();
public DbSet<ResourceCalendar> ResourceCalendar => Set<ResourceCalendar>();
public DbSet<ResourceHold> ResourceHolds => Set<ResourceHold>();
public DbSet<InventorySettings> InventorySettings => Set<InventorySettings>();
```

If a `using TravelCrm.Api.Domain.Entities.Inventory;` isn't already present, add it at the top of the file.

- [ ] **Step 2: Add entity configurations to `OnModelCreating`**

After the existing entity configs (and after `base.OnModelCreating(modelBuilder)`), append:

```csharp
modelBuilder.Entity<Supplier>(b =>
{
    b.Property(s => s.Name).IsRequired().HasMaxLength(200);
    b.Property(s => s.SupplierType).HasConversion<int>();
    b.Property(s => s.ContactName).HasMaxLength(200);
    b.Property(s => s.ContactEmail).HasMaxLength(200);
    b.Property(s => s.ContactPhone).HasMaxLength(50);
    b.Property(s => s.Address).HasMaxLength(1000);
    b.HasIndex(s => new { s.TenantId, s.Name }).IsUnique();
    b.HasIndex(s => new { s.TenantId, s.SupplierType });
});

modelBuilder.Entity<Resource>(b =>
{
    b.ToTable("resources");
    b.HasDiscriminator(r => r.Kind)
        .HasValue<PoolResource>(ResourceKind.Pool)
        .HasValue<AssetResource>(ResourceKind.Asset);

    b.Property(r => r.Type).IsRequired().HasMaxLength(50);
    b.Property(r => r.Name).IsRequired().HasMaxLength(200);
    b.Property(r => r.Status).HasConversion<int>();
    b.Property(r => r.Metadata).HasColumnType("jsonb");

    b.HasOne(r => r.Supplier)
        .WithMany()
        .HasForeignKey(r => r.SupplierId)
        .OnDelete(DeleteBehavior.SetNull);

    b.HasIndex(r => new { r.TenantId, r.Type, r.Status });
    b.HasIndex(r => new { r.TenantId, r.SupplierId });
});

modelBuilder.Entity<PoolResource>(b =>
{
    // DefaultCapacity stored in same `resources` table via TPH; column is nullable
    // since AssetResource rows won't set it.
    b.Property(p => p.DefaultCapacity).IsRequired();
});

modelBuilder.Entity<AssetResource>(b =>
{
    b.Property(a => a.AssetCode).HasMaxLength(100);
});

modelBuilder.Entity<ResourceCalendar>(b =>
{
    b.Property(c => c.Slot).HasConversion<int?>();
    b.Property(c => c.Notes).HasMaxLength(500);
    b.Property(c => c.RowVersion).IsRowVersion();

    b.HasOne(c => c.Resource)
        .WithMany()
        .HasForeignKey(c => c.ResourceId)
        .OnDelete(DeleteBehavior.Cascade);

    b.HasIndex(c => new { c.TenantId, c.ResourceId, c.Date, c.Slot }).IsUnique();
});

modelBuilder.Entity<ResourceHold>(b =>
{
    b.Property(h => h.Slot).HasConversion<int?>();
    b.Property(h => h.Status).HasConversion<int>();
    b.Property(h => h.BookingRef).HasMaxLength(100);
    b.Property(h => h.Notes).HasMaxLength(500);

    b.HasOne(h => h.Resource)
        .WithMany()
        .HasForeignKey(h => h.ResourceId)
        .OnDelete(DeleteBehavior.Restrict);

    b.HasIndex(h => new { h.TenantId, h.ResourceId, h.StartDate, h.EndDate });
    b.HasIndex(h => new { h.Status, h.ExpiresAt });
});

modelBuilder.Entity<InventorySettings>(b =>
{
    b.HasIndex(s => s.TenantId).IsUnique();
});
```

- [ ] **Step 3: Verify build**

Run: `dotnet build TravelCrm.Api`
Expected: 0 errors.

- [ ] **Step 4: Generate the EF migration**

```bash
cd TravelCrm.Api
dotnet ef migrations add AddInventoryFoundation
```

Expected: New file `TravelCrm.Api/Migrations/<timestamp>_AddInventoryFoundation.cs` plus a `.Designer.cs` and updates to `ApplicationDbContextModelSnapshot.cs`.

- [ ] **Step 5: Inspect the migration file**

Open `TravelCrm.Api/Migrations/<timestamp>_AddInventoryFoundation.cs`. Verify:
- 5 `CreateTable` calls: `suppliers`, `resources`, `resource_calendar`, `resource_holds`, `inventory_settings`
- `resources` table has both `default_capacity int NULL` and `asset_code varchar(100) NULL`, plus `kind int NOT NULL` discriminator column
- `resources` table has FK `fk_resources_suppliers_supplier_id` with `OnDelete: ReferentialAction.SetNull`
- `resource_calendar` FK to `resources` with `OnDelete: ReferentialAction.Cascade`; `row_version uint NOT NULL` (PG xmin emulation)
- `resource_holds` FK to `resources` with `OnDelete: ReferentialAction.Restrict`
- All snake_case naming
- All 7 indexes from Step 2 present (suppliers: 2, resources: 2, calendar: 1 unique, holds: 2, settings: 1 unique)

If anything looks wrong, delete the generated files (`*.Designer.cs` + the migration `.cs`), fix the entity/config, re-run `dotnet ef migrations add`.

- [ ] **Step 6: Apply the migration**

```bash
dotnet ef database update
```

Expected: Done. If the DB is unavailable, report it but compilation alone is sufficient for this task.

- [ ] **Step 7: Commit**

```bash
git add TravelCrm.Api/Infrastructure/Persistence/ApplicationDbContext.cs \
        TravelCrm.Api/Migrations/
git commit -m "feat(inventory): add EF migration for inventory foundation tables"
```

---

## Task 3: Permission Slugs & Role Seeding

**Files:**
- Modify: `TravelCrm.Api/Common/PermissionCatalog.cs` (add 8 inventory.* slugs)
- Modify: `TravelCrm.Api/Infrastructure/Persistence/RolePermissionSeeder.cs` (assign to roles)

- [ ] **Step 1: Add slugs to `PermissionCatalog.All()`**

In `TravelCrm.Api/Common/PermissionCatalog.cs`, find the line `// CRM — Tasks (task management module)` block (which ends around sort order 702). Immediately after it, add:

```csharp
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
```

- [ ] **Step 2: Update `RolePermissionSeeder.PermissionsFor()`**

In `TravelCrm.Api/Infrastructure/Persistence/RolePermissionSeeder.cs`, find the `"admin"` HashSet block. At the end of it (just before the closing `}`), append the inventory slugs:

```csharp
// Inventory — full
"inventory.suppliers.view", "inventory.suppliers.manage",
"inventory.resources.view", "inventory.resources.manage",
"inventory.calendar.view",  "inventory.calendar.manage",
"inventory.holds.view",     "inventory.holds.manage",
```

In the `"manager"` block, add at the end:

```csharp
// Inventory — managers can manage resources/calendar/holds but not suppliers
"inventory.suppliers.view",
"inventory.resources.view", "inventory.resources.manage",
"inventory.calendar.view",  "inventory.calendar.manage",
"inventory.holds.view",     "inventory.holds.manage",
```

In the `"readonly" or "read_only"` block, add at the end:

```csharp
// Inventory — read-only sees the catalog
"inventory.suppliers.view",
"inventory.resources.view",
"inventory.calendar.view",
"inventory.holds.view",
```

- [ ] **Step 3: Verify build**

Run: `dotnet build TravelCrm.Api`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add TravelCrm.Api/Common/PermissionCatalog.cs \
        TravelCrm.Api/Infrastructure/Persistence/RolePermissionSeeder.cs
git commit -m "feat(inventory): seed inventory.* permissions and assign to roles"
```

---

## Task 4: Suppliers Feature (DTO + Handlers + Tests + Controller)

**Files:**
- Create: `TravelCrm.Api/Features/Inventory/Suppliers/SupplierDto.cs`
- Create: `TravelCrm.Api/Features/Inventory/Suppliers/Commands/CreateSupplierCommand.cs`
- Create: `TravelCrm.Api/Features/Inventory/Suppliers/Commands/UpdateSupplierCommand.cs`
- Create: `TravelCrm.Api/Features/Inventory/Suppliers/Commands/DeleteSupplierCommand.cs`
- Create: `TravelCrm.Api/Features/Inventory/Suppliers/Queries/ListSuppliersQuery.cs`
- Create: `TravelCrm.Api/Features/Inventory/Suppliers/Queries/GetSupplierQuery.cs`
- Create: `TravelCrm.Api/Features/Inventory/Suppliers/SuppliersController.cs`
- Create: `TravelCrm.Tests/Inventory/SupplierHandlersTests.cs`

- [ ] **Step 1: Write the failing tests `SupplierHandlersTests.cs`**

```csharp
using FluentAssertions;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Features.Inventory.Suppliers.Commands;
using TravelCrm.Api.Features.Inventory.Suppliers.Queries;

namespace TravelCrm.Tests.Inventory;

public class SupplierHandlersTests
{
    [Fact]
    public async Task CreateSupplier_Persists_AndReturnsDto()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var handler = new CreateSupplierHandler(db, new FakeTenantContext(tenantId), user);

        var result = await handler.Handle(
            new CreateSupplierCommand("Taj Hotels", "Hotel", null, null, null, null, null, null), default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Name.Should().Be("Taj Hotels");
        db.Suppliers.Should().ContainSingle(s => s.Name == "Taj Hotels" && s.TenantId == tenantId);
    }

    [Fact]
    public async Task CreateSupplier_DuplicateName_ReturnsFailure()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        db.Suppliers.Add(new Supplier { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Taj", SupplierType = SupplierType.Hotel });
        await db.SaveChangesAsync();

        var handler = new CreateSupplierHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(
            new CreateSupplierCommand("Taj", "Hotel", null, null, null, null, null, null), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("already exists");
    }

    [Fact]
    public async Task ListSuppliers_FiltersByTenant()
    {
        var (db, _, tenantId) = TestDb.New();
        var otherTenantId = Guid.NewGuid();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        db.Suppliers.Add(new Supplier { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Mine", SupplierType = SupplierType.Hotel });
        db.Suppliers.Add(new Supplier { Id = Guid.NewGuid(), TenantId = otherTenantId, Name = "Theirs", SupplierType = SupplierType.Hotel });
        await db.SaveChangesAsync();

        var handler = new ListSuppliersHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new ListSuppliersQuery(null), default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Should().HaveCount(1);
        result.Value!.Single().Name.Should().Be("Mine");
    }

    [Fact]
    public async Task UpdateSupplier_ChangesFields()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var id = Guid.NewGuid();
        db.Suppliers.Add(new Supplier { Id = id, TenantId = tenantId, Name = "Old", SupplierType = SupplierType.Hotel, IsActive = true });
        await db.SaveChangesAsync();

        var handler = new UpdateSupplierHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(
            new UpdateSupplierCommand(id, "New Name", "Transport", "John", "j@x.io", "+91", "Addr", null, null, false), default);

        result.IsSuccess.Should().BeTrue();
        var fresh = db.Suppliers.Find(id)!;
        fresh.Name.Should().Be("New Name");
        fresh.SupplierType.Should().Be(SupplierType.Transport);
        fresh.IsActive.Should().BeFalse();
    }

    [Fact]
    public async Task DeleteSupplier_WhenInUse_ReturnsConflict()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var supplierId = Guid.NewGuid();
        db.Suppliers.Add(new Supplier { Id = supplierId, TenantId = tenantId, Name = "InUse", SupplierType = SupplierType.Hotel });
        db.PoolResources.Add(new PoolResource
        {
            Id = Guid.NewGuid(), TenantId = tenantId, Type = "Hotel", Name = "Taj Goa",
            SupplierId = supplierId, DefaultCapacity = 10,
        });
        await db.SaveChangesAsync();

        var handler = new DeleteSupplierHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new DeleteSupplierCommand(supplierId), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("in use");
    }
}
```

- [ ] **Step 2: Run tests to confirm they fail (compile errors)**

Run: `dotnet test TravelCrm.Tests --filter "FullyQualifiedName~SupplierHandlersTests"`
Expected: build error — types not defined.

- [ ] **Step 3: Create `SupplierDto.cs`**

```csharp
using TravelCrm.Api.Domain.Entities.Inventory;

namespace TravelCrm.Api.Features.Inventory.Suppliers;

public sealed record SupplierDto(
    Guid Id,
    string Name,
    string SupplierType,
    string? ContactName,
    string? ContactEmail,
    string? ContactPhone,
    string? Address,
    DateOnly? ContractValidFrom,
    DateOnly? ContractValidTo,
    bool IsActive,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public static class SupplierMapper
{
    public static SupplierDto ToDto(Supplier s) => new(
        s.Id, s.Name, s.SupplierType.ToString(),
        s.ContactName, s.ContactEmail, s.ContactPhone, s.Address,
        s.ContractValidFrom, s.ContractValidTo, s.IsActive,
        s.CreatedAt, s.UpdatedAt ?? s.CreatedAt
    );
}
```

- [ ] **Step 4: Create `Commands/CreateSupplierCommand.cs`**

```csharp
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Suppliers.Commands;

public sealed record CreateSupplierCommand(
    string Name,
    string SupplierType,
    string? ContactName,
    string? ContactEmail,
    string? ContactPhone,
    string? Address,
    DateOnly? ContractValidFrom,
    DateOnly? ContractValidTo
) : IRequest<Result<SupplierDto>>;

public sealed class CreateSupplierValidator : AbstractValidator<CreateSupplierCommand>
{
    public CreateSupplierValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.SupplierType)
            .Must(s => Enum.TryParse<SupplierType>(s, ignoreCase: true, out _))
            .WithMessage("SupplierType must be Hotel, Transport, Activity, Guide, or Other");
        RuleFor(x => x.ContactName).MaximumLength(200);
        RuleFor(x => x.ContactEmail).MaximumLength(200);
        RuleFor(x => x.ContactPhone).MaximumLength(50);
        RuleFor(x => x.Address).MaximumLength(1000);
    }
}

public sealed class CreateSupplierHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<CreateSupplierCommand, Result<SupplierDto>>
{
    public async Task<Result<SupplierDto>> Handle(CreateSupplierCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.suppliers.manage"))
            return Result.Failure<SupplierDto>("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure<SupplierDto>("Tenant not resolved");

        var dup = await db.Suppliers.AnyAsync(
            s => s.TenantId == tenantContext.TenantId && s.Name == cmd.Name, ct);
        if (dup) return Result.Failure<SupplierDto>("A supplier with this name already exists");

        var entity = new Supplier
        {
            Id = Guid.NewGuid(),
            TenantId = tenantContext.TenantId!.Value,
            Name = cmd.Name,
            SupplierType = Enum.Parse<SupplierType>(cmd.SupplierType, ignoreCase: true),
            ContactName = cmd.ContactName,
            ContactEmail = cmd.ContactEmail,
            ContactPhone = cmd.ContactPhone,
            Address = cmd.Address,
            ContractValidFrom = cmd.ContractValidFrom,
            ContractValidTo = cmd.ContractValidTo,
            IsActive = true,
        };
        db.Suppliers.Add(entity);
        await db.SaveChangesAsync(ct);
        return Result.Success(SupplierMapper.ToDto(entity));
    }
}
```

- [ ] **Step 5: Create `Commands/UpdateSupplierCommand.cs`**

```csharp
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Suppliers.Commands;

public sealed record UpdateSupplierCommand(
    Guid Id,
    string Name,
    string SupplierType,
    string? ContactName,
    string? ContactEmail,
    string? ContactPhone,
    string? Address,
    DateOnly? ContractValidFrom,
    DateOnly? ContractValidTo,
    bool IsActive
) : IRequest<Result<SupplierDto>>;

public sealed class UpdateSupplierValidator : AbstractValidator<UpdateSupplierCommand>
{
    public UpdateSupplierValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.SupplierType)
            .Must(s => Enum.TryParse<SupplierType>(s, ignoreCase: true, out _))
            .WithMessage("Invalid SupplierType");
        RuleFor(x => x.ContactEmail).MaximumLength(200);
    }
}

public sealed class UpdateSupplierHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<UpdateSupplierCommand, Result<SupplierDto>>
{
    public async Task<Result<SupplierDto>> Handle(UpdateSupplierCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.suppliers.manage"))
            return Result.Failure<SupplierDto>("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure<SupplierDto>("Tenant not resolved");

        var entity = await db.Suppliers.FirstOrDefaultAsync(
            s => s.Id == cmd.Id && s.TenantId == tenantContext.TenantId, ct);
        if (entity is null) return Result.Failure<SupplierDto>("Supplier not found");

        var dup = await db.Suppliers.AnyAsync(
            s => s.TenantId == tenantContext.TenantId && s.Name == cmd.Name && s.Id != cmd.Id, ct);
        if (dup) return Result.Failure<SupplierDto>("A supplier with this name already exists");

        entity.Name = cmd.Name;
        entity.SupplierType = Enum.Parse<SupplierType>(cmd.SupplierType, ignoreCase: true);
        entity.ContactName = cmd.ContactName;
        entity.ContactEmail = cmd.ContactEmail;
        entity.ContactPhone = cmd.ContactPhone;
        entity.Address = cmd.Address;
        entity.ContractValidFrom = cmd.ContractValidFrom;
        entity.ContractValidTo = cmd.ContractValidTo;
        entity.IsActive = cmd.IsActive;

        await db.SaveChangesAsync(ct);
        return Result.Success(SupplierMapper.ToDto(entity));
    }
}
```

- [ ] **Step 6: Create `Commands/DeleteSupplierCommand.cs`**

```csharp
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Suppliers.Commands;

public sealed record DeleteSupplierCommand(Guid Id) : IRequest<Result>;

public sealed class DeleteSupplierHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<DeleteSupplierCommand, Result>
{
    public async Task<Result> Handle(DeleteSupplierCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.suppliers.manage"))
            return Result.Failure("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure("Tenant not resolved");

        var entity = await db.Suppliers.FirstOrDefaultAsync(
            s => s.Id == cmd.Id && s.TenantId == tenantContext.TenantId, ct);
        if (entity is null) return Result.Failure("Supplier not found");

        var inUse = await db.Resources.AnyAsync(
            r => r.SupplierId == cmd.Id && r.TenantId == tenantContext.TenantId, ct);
        if (inUse) return Result.Failure("Supplier is in use by existing resources");

        db.Suppliers.Remove(entity);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
```

- [ ] **Step 7: Create `Queries/ListSuppliersQuery.cs`**

```csharp
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Suppliers.Queries;

public sealed record ListSuppliersQuery(string? SupplierType) : IRequest<Result<List<SupplierDto>>>;

public sealed class ListSuppliersHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<ListSuppliersQuery, Result<List<SupplierDto>>>
{
    public async Task<Result<List<SupplierDto>>> Handle(ListSuppliersQuery q, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.suppliers.view"))
            return Result.Failure<List<SupplierDto>>("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure<List<SupplierDto>>("Tenant not resolved");

        var query = db.Suppliers
            .AsNoTracking()
            .Where(s => s.TenantId == tenantContext.TenantId);

        if (!string.IsNullOrWhiteSpace(q.SupplierType)
            && Enum.TryParse<SupplierType>(q.SupplierType, ignoreCase: true, out var st))
            query = query.Where(s => s.SupplierType == st);

        var rows = await query.OrderBy(s => s.Name).ToListAsync(ct);
        return Result.Success(rows.Select(SupplierMapper.ToDto).ToList());
    }
}
```

- [ ] **Step 8: Create `Queries/GetSupplierQuery.cs`**

```csharp
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Suppliers.Queries;

public sealed record GetSupplierQuery(Guid Id) : IRequest<Result<SupplierDto>>;

public sealed class GetSupplierHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<GetSupplierQuery, Result<SupplierDto>>
{
    public async Task<Result<SupplierDto>> Handle(GetSupplierQuery q, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.suppliers.view"))
            return Result.Failure<SupplierDto>("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure<SupplierDto>("Tenant not resolved");

        var entity = await db.Suppliers
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == q.Id && s.TenantId == tenantContext.TenantId, ct);
        if (entity is null) return Result.Failure<SupplierDto>("Supplier not found");

        return Result.Success(SupplierMapper.ToDto(entity));
    }
}
```

- [ ] **Step 9: Create `SuppliersController.cs`**

```csharp
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Features.Inventory.Suppliers.Commands;
using TravelCrm.Api.Features.Inventory.Suppliers.Queries;

namespace TravelCrm.Api.Features.Inventory.Suppliers;

[ApiController]
[Authorize]
[Route("api/inventory/suppliers")]
public sealed class SuppliersController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? supplierType)
    {
        var r = await mediator.Send(new ListSuppliersQuery(supplierType));
        return r.IsSuccess ? Ok(r.Value) : Forbid();
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var r = await mediator.Send(new GetSupplierQuery(id));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Forbid();
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] SupplierWriteRequest body)
    {
        var r = await mediator.Send(new CreateSupplierCommand(
            body.Name, body.SupplierType, body.ContactName, body.ContactEmail,
            body.ContactPhone, body.Address, body.ContractValidFrom, body.ContractValidTo));
        return r.IsSuccess
            ? CreatedAtAction(nameof(Get), new { id = r.Value!.Id }, r.Value)
            : BadRequest(new { error = r.Error });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] SupplierUpdateRequest body)
    {
        var r = await mediator.Send(new UpdateSupplierCommand(
            id, body.Name, body.SupplierType, body.ContactName, body.ContactEmail,
            body.ContactPhone, body.Address, body.ContractValidFrom, body.ContractValidTo, body.IsActive));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : BadRequest(new { error = r.Error });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var r = await mediator.Send(new DeleteSupplierCommand(id));
        if (r.IsSuccess) return NoContent();
        if (r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase))
            return NotFound(new { error = r.Error });
        if (r.Error!.Contains("in use", StringComparison.OrdinalIgnoreCase))
            return Conflict(new { error = r.Error });
        return Forbid();
    }
}

public sealed record SupplierWriteRequest(
    string Name, string SupplierType,
    string? ContactName, string? ContactEmail, string? ContactPhone, string? Address,
    DateOnly? ContractValidFrom, DateOnly? ContractValidTo);

public sealed record SupplierUpdateRequest(
    string Name, string SupplierType,
    string? ContactName, string? ContactEmail, string? ContactPhone, string? Address,
    DateOnly? ContractValidFrom, DateOnly? ContractValidTo, bool IsActive);
```

- [ ] **Step 10: Run tests**

Run: `dotnet test TravelCrm.Tests --filter "FullyQualifiedName~SupplierHandlersTests" -v minimal`
Expected: 5/5 pass.

- [ ] **Step 11: Commit**

```bash
git add TravelCrm.Api/Features/Inventory/Suppliers/ \
        TravelCrm.Tests/Inventory/SupplierHandlersTests.cs
git commit -m "feat(inventory): add Suppliers CQRS feature + controller + tests"
```

---

## Task 5: Resources Feature (DTO + Handlers + Tests + Controller)

**Files:**
- Create: `TravelCrm.Api/Features/Inventory/Resources/ResourceDto.cs`
- Create: `TravelCrm.Api/Features/Inventory/Resources/Commands/CreateResourceCommand.cs`
- Create: `TravelCrm.Api/Features/Inventory/Resources/Commands/UpdateResourceCommand.cs`
- Create: `TravelCrm.Api/Features/Inventory/Resources/Commands/BlockResourceCommand.cs`
- Create: `TravelCrm.Api/Features/Inventory/Resources/Commands/UnblockResourceCommand.cs`
- Create: `TravelCrm.Api/Features/Inventory/Resources/Queries/ListResourcesQuery.cs`
- Create: `TravelCrm.Api/Features/Inventory/Resources/Queries/GetResourceQuery.cs`
- Create: `TravelCrm.Api/Features/Inventory/Resources/ResourcesController.cs`
- Create: `TravelCrm.Tests/Inventory/ResourceHandlersTests.cs`

- [ ] **Step 1: Write the failing tests in `ResourceHandlersTests.cs`**

```csharp
using FluentAssertions;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Features.Inventory.Resources.Commands;
using TravelCrm.Api.Features.Inventory.Resources.Queries;

namespace TravelCrm.Tests.Inventory;

public class ResourceHandlersTests
{
    [Fact]
    public async Task CreatePoolResource_Persists()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var handler = new CreateResourceHandler(db, new FakeTenantContext(tenantId), user);

        var result = await handler.Handle(
            new CreateResourceCommand("Pool", "RoomType", "Deluxe Room @ Taj", null, 10, null, null), default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Kind.Should().Be("Pool");
        result.Value!.DefaultCapacity.Should().Be(10);
        db.PoolResources.Should().ContainSingle(r => r.Name == "Deluxe Room @ Taj");
    }

    [Fact]
    public async Task CreateAssetResource_Persists()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var handler = new CreateResourceHandler(db, new FakeTenantContext(tenantId), user);

        var result = await handler.Handle(
            new CreateResourceCommand("Asset", "Vehicle", "Toyota Innova", null, null, "KA-01-AB-1234", null), default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Kind.Should().Be("Asset");
        result.Value!.AssetCode.Should().Be("KA-01-AB-1234");
    }

    [Fact]
    public async Task CreateResource_PoolWithoutCapacity_Fails()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var handler = new CreateResourceHandler(db, new FakeTenantContext(tenantId), user);

        var result = await handler.Handle(
            new CreateResourceCommand("Pool", "RoomType", "X", null, null, null, null), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("DefaultCapacity");
    }

    [Fact]
    public async Task BlockResource_SetsStatusBlocked()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var id = Guid.NewGuid();
        db.PoolResources.Add(new PoolResource
        {
            Id = id, TenantId = tenantId, Type = "RoomType", Name = "X",
            Status = ResourceStatus.Active, DefaultCapacity = 10,
        });
        await db.SaveChangesAsync();

        var handler = new BlockResourceHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new BlockResourceCommand(id), default);

        result.IsSuccess.Should().BeTrue();
        db.Resources.Find(id)!.Status.Should().Be(ResourceStatus.Blocked);
    }

    [Fact]
    public async Task ListResources_FilteredByType()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        db.PoolResources.Add(new PoolResource { Id = Guid.NewGuid(), TenantId = tenantId, Type = "Hotel", Name = "Taj", DefaultCapacity = 1, Status = ResourceStatus.Active });
        db.PoolResources.Add(new PoolResource { Id = Guid.NewGuid(), TenantId = tenantId, Type = "RoomType", Name = "Deluxe", DefaultCapacity = 10, Status = ResourceStatus.Active });
        await db.SaveChangesAsync();

        var handler = new ListResourcesHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new ListResourcesQuery("Hotel", null, null), default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Should().HaveCount(1);
        result.Value!.Single().Type.Should().Be("Hotel");
    }

    [Fact]
    public async Task GetResource_FromOtherTenant_ReturnsNotFound()
    {
        var (db, _, tenantId) = TestDb.New();
        var otherTenantId = Guid.NewGuid();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var id = Guid.NewGuid();
        db.PoolResources.Add(new PoolResource { Id = id, TenantId = otherTenantId, Type = "Hotel", Name = "Theirs", DefaultCapacity = 1, Status = ResourceStatus.Active });
        await db.SaveChangesAsync();

        var handler = new GetResourceHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new GetResourceQuery(id), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("not found");
    }
}
```

- [ ] **Step 2: Verify failure (compile errors)**

Run: `dotnet test TravelCrm.Tests --filter "FullyQualifiedName~ResourceHandlersTests"`
Expected: build error.

- [ ] **Step 3: Create `ResourceDto.cs`**

```csharp
using TravelCrm.Api.Domain.Entities.Inventory;

namespace TravelCrm.Api.Features.Inventory.Resources;

public sealed record ResourceDto(
    Guid Id,
    string Kind,        // "Pool" | "Asset"
    string Type,
    string Name,
    Guid? SupplierId,
    string? SupplierName,
    string Status,
    int? DefaultCapacity,
    string? AssetCode,
    string? Metadata,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public static class ResourceMapper
{
    public static ResourceDto ToDto(Resource r) => new(
        r.Id,
        r.Kind.ToString(),
        r.Type,
        r.Name,
        r.SupplierId,
        r.Supplier?.Name,
        r.Status.ToString(),
        (r as PoolResource)?.DefaultCapacity,
        (r as AssetResource)?.AssetCode,
        r.Metadata,
        r.CreatedAt,
        r.UpdatedAt ?? r.CreatedAt
    );
}
```

- [ ] **Step 4: Create `Commands/CreateResourceCommand.cs`**

```csharp
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Resources.Commands;

public sealed record CreateResourceCommand(
    string Kind,                // "Pool" | "Asset"
    string Type,                // "Hotel" | "RoomType" | "Vehicle" | ...
    string Name,
    Guid? SupplierId,
    int? DefaultCapacity,       // required for Pool
    string? AssetCode,          // optional for Asset
    string? Metadata
) : IRequest<Result<ResourceDto>>;

public sealed class CreateResourceValidator : AbstractValidator<CreateResourceCommand>
{
    public CreateResourceValidator()
    {
        RuleFor(x => x.Kind)
            .Must(k => Enum.TryParse<ResourceKind>(k, ignoreCase: true, out _))
            .WithMessage("Kind must be Pool or Asset");
        RuleFor(x => x.Type).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.AssetCode).MaximumLength(100);
        RuleFor(x => x.DefaultCapacity)
            .NotNull().GreaterThan(0)
            .When(x => string.Equals(x.Kind, "Pool", StringComparison.OrdinalIgnoreCase))
            .WithMessage("DefaultCapacity is required and must be > 0 for Pool resources");
    }
}

public sealed class CreateResourceHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<CreateResourceCommand, Result<ResourceDto>>
{
    public async Task<Result<ResourceDto>> Handle(CreateResourceCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.resources.manage"))
            return Result.Failure<ResourceDto>("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure<ResourceDto>("Tenant not resolved");

        var kind = Enum.Parse<ResourceKind>(cmd.Kind, ignoreCase: true);

        if (kind == ResourceKind.Pool && (cmd.DefaultCapacity is null or <= 0))
            return Result.Failure<ResourceDto>("DefaultCapacity is required for Pool resources");

        if (cmd.SupplierId.HasValue)
        {
            var supplierExists = await db.Suppliers.AnyAsync(
                s => s.Id == cmd.SupplierId.Value && s.TenantId == tenantContext.TenantId, ct);
            if (!supplierExists)
                return Result.Failure<ResourceDto>("Supplier not found");
        }

        Resource entity = kind == ResourceKind.Pool
            ? new PoolResource
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId!.Value,
                Type = cmd.Type,
                Name = cmd.Name,
                SupplierId = cmd.SupplierId,
                Status = ResourceStatus.Active,
                Metadata = cmd.Metadata,
                DefaultCapacity = cmd.DefaultCapacity!.Value,
            }
            : new AssetResource
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId!.Value,
                Type = cmd.Type,
                Name = cmd.Name,
                SupplierId = cmd.SupplierId,
                Status = ResourceStatus.Active,
                Metadata = cmd.Metadata,
                AssetCode = cmd.AssetCode,
            };

        db.Resources.Add(entity);
        await db.SaveChangesAsync(ct);

        var fresh = await db.Resources
            .AsNoTracking()
            .Include(r => r.Supplier)
            .FirstAsync(r => r.Id == entity.Id, ct);
        return Result.Success(ResourceMapper.ToDto(fresh));
    }
}
```

- [ ] **Step 5: Create `Commands/UpdateResourceCommand.cs`**

```csharp
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Resources.Commands;

public sealed record UpdateResourceCommand(
    Guid Id,
    string Name,
    Guid? SupplierId,
    int? DefaultCapacity,
    string? AssetCode,
    string? Metadata
) : IRequest<Result<ResourceDto>>;

public sealed class UpdateResourceValidator : AbstractValidator<UpdateResourceCommand>
{
    public UpdateResourceValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.AssetCode).MaximumLength(100);
        RuleFor(x => x.DefaultCapacity).GreaterThan(0).When(x => x.DefaultCapacity.HasValue);
    }
}

public sealed class UpdateResourceHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<UpdateResourceCommand, Result<ResourceDto>>
{
    public async Task<Result<ResourceDto>> Handle(UpdateResourceCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.resources.manage"))
            return Result.Failure<ResourceDto>("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure<ResourceDto>("Tenant not resolved");

        var entity = await db.Resources
            .Include(r => r.Supplier)
            .FirstOrDefaultAsync(r => r.Id == cmd.Id && r.TenantId == tenantContext.TenantId, ct);
        if (entity is null) return Result.Failure<ResourceDto>("Resource not found");

        if (cmd.SupplierId.HasValue)
        {
            var supplierExists = await db.Suppliers.AnyAsync(
                s => s.Id == cmd.SupplierId.Value && s.TenantId == tenantContext.TenantId, ct);
            if (!supplierExists)
                return Result.Failure<ResourceDto>("Supplier not found");
        }

        entity.Name = cmd.Name;
        entity.SupplierId = cmd.SupplierId;
        entity.Metadata = cmd.Metadata;

        if (entity is PoolResource pool)
        {
            if (cmd.DefaultCapacity.HasValue) pool.DefaultCapacity = cmd.DefaultCapacity.Value;
        }
        else if (entity is AssetResource asset)
        {
            asset.AssetCode = cmd.AssetCode;
        }

        await db.SaveChangesAsync(ct);

        // Reload supplier in case SupplierId changed
        await db.Entry(entity).Reference(r => r.Supplier).LoadAsync(ct);
        return Result.Success(ResourceMapper.ToDto(entity));
    }
}
```

- [ ] **Step 6: Create `Commands/BlockResourceCommand.cs` and `UnblockResourceCommand.cs`**

`BlockResourceCommand.cs`:

```csharp
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Resources.Commands;

public sealed record BlockResourceCommand(Guid Id) : IRequest<Result>;

public sealed class BlockResourceHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<BlockResourceCommand, Result>
{
    public async Task<Result> Handle(BlockResourceCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.resources.manage"))
            return Result.Failure("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure("Tenant not resolved");

        var entity = await db.Resources.FirstOrDefaultAsync(
            r => r.Id == cmd.Id && r.TenantId == tenantContext.TenantId, ct);
        if (entity is null) return Result.Failure("Resource not found");

        entity.Status = ResourceStatus.Blocked;
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
```

`UnblockResourceCommand.cs`: identical structure but sets `entity.Status = ResourceStatus.Active;` and renames the type to `UnblockResourceCommand` / `UnblockResourceHandler`.

```csharp
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Resources.Commands;

public sealed record UnblockResourceCommand(Guid Id) : IRequest<Result>;

public sealed class UnblockResourceHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<UnblockResourceCommand, Result>
{
    public async Task<Result> Handle(UnblockResourceCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.resources.manage"))
            return Result.Failure("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure("Tenant not resolved");

        var entity = await db.Resources.FirstOrDefaultAsync(
            r => r.Id == cmd.Id && r.TenantId == tenantContext.TenantId, ct);
        if (entity is null) return Result.Failure("Resource not found");

        entity.Status = ResourceStatus.Active;
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
```

- [ ] **Step 7: Create `Queries/ListResourcesQuery.cs`**

```csharp
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Resources.Queries;

public sealed record ListResourcesQuery(string? Type, string? Status, Guid? SupplierId)
    : IRequest<Result<List<ResourceDto>>>;

public sealed class ListResourcesHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<ListResourcesQuery, Result<List<ResourceDto>>>
{
    public async Task<Result<List<ResourceDto>>> Handle(ListResourcesQuery q, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.resources.view"))
            return Result.Failure<List<ResourceDto>>("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure<List<ResourceDto>>("Tenant not resolved");

        var query = db.Resources
            .AsNoTracking()
            .Include(r => r.Supplier)
            .Where(r => r.TenantId == tenantContext.TenantId);

        if (!string.IsNullOrWhiteSpace(q.Type))
            query = query.Where(r => r.Type == q.Type);

        if (!string.IsNullOrWhiteSpace(q.Status)
            && Enum.TryParse<ResourceStatus>(q.Status, ignoreCase: true, out var status))
            query = query.Where(r => r.Status == status);

        if (q.SupplierId.HasValue)
            query = query.Where(r => r.SupplierId == q.SupplierId.Value);

        var rows = await query.OrderBy(r => r.Name).ToListAsync(ct);
        return Result.Success(rows.Select(ResourceMapper.ToDto).ToList());
    }
}
```

- [ ] **Step 8: Create `Queries/GetResourceQuery.cs`**

```csharp
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Resources.Queries;

public sealed record GetResourceQuery(Guid Id) : IRequest<Result<ResourceDto>>;

public sealed class GetResourceHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<GetResourceQuery, Result<ResourceDto>>
{
    public async Task<Result<ResourceDto>> Handle(GetResourceQuery q, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.resources.view"))
            return Result.Failure<ResourceDto>("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure<ResourceDto>("Tenant not resolved");

        var entity = await db.Resources
            .AsNoTracking()
            .Include(r => r.Supplier)
            .FirstOrDefaultAsync(r => r.Id == q.Id && r.TenantId == tenantContext.TenantId, ct);
        if (entity is null) return Result.Failure<ResourceDto>("Resource not found");

        return Result.Success(ResourceMapper.ToDto(entity));
    }
}
```

- [ ] **Step 9: Create `ResourcesController.cs`**

```csharp
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Features.Inventory.Resources.Commands;
using TravelCrm.Api.Features.Inventory.Resources.Queries;

namespace TravelCrm.Api.Features.Inventory.Resources;

[ApiController]
[Authorize]
[Route("api/inventory/resources")]
public sealed class ResourcesController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? type,
        [FromQuery] string? status,
        [FromQuery] Guid? supplierId)
    {
        var r = await mediator.Send(new ListResourcesQuery(type, status, supplierId));
        return r.IsSuccess ? Ok(r.Value) : Forbid();
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var r = await mediator.Send(new GetResourceQuery(id));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Forbid();
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ResourceCreateRequest body)
    {
        var r = await mediator.Send(new CreateResourceCommand(
            body.Kind, body.Type, body.Name, body.SupplierId,
            body.DefaultCapacity, body.AssetCode, body.Metadata));
        return r.IsSuccess
            ? CreatedAtAction(nameof(Get), new { id = r.Value!.Id }, r.Value)
            : BadRequest(new { error = r.Error });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] ResourceUpdateRequest body)
    {
        var r = await mediator.Send(new UpdateResourceCommand(
            id, body.Name, body.SupplierId, body.DefaultCapacity, body.AssetCode, body.Metadata));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : BadRequest(new { error = r.Error });
    }

    [HttpPost("{id:guid}/block")]
    public async Task<IActionResult> Block(Guid id)
    {
        var r = await mediator.Send(new BlockResourceCommand(id));
        if (r.IsSuccess) return Ok();
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Forbid();
    }

    [HttpPost("{id:guid}/unblock")]
    public async Task<IActionResult> Unblock(Guid id)
    {
        var r = await mediator.Send(new UnblockResourceCommand(id));
        if (r.IsSuccess) return Ok();
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Forbid();
    }
}

public sealed record ResourceCreateRequest(
    string Kind, string Type, string Name,
    Guid? SupplierId, int? DefaultCapacity, string? AssetCode, string? Metadata);

public sealed record ResourceUpdateRequest(
    string Name, Guid? SupplierId,
    int? DefaultCapacity, string? AssetCode, string? Metadata);
```

- [ ] **Step 10: Run tests**

Run: `dotnet test TravelCrm.Tests --filter "FullyQualifiedName~ResourceHandlersTests" -v minimal`
Expected: 6/6 pass.

- [ ] **Step 11: Commit**

```bash
git add TravelCrm.Api/Features/Inventory/Resources/ \
        TravelCrm.Tests/Inventory/ResourceHandlersTests.cs
git commit -m "feat(inventory): add Resources CQRS feature + controller + tests"
```

---

## Task 6: AvailabilityCalculator + Comprehensive Tests (CRITICAL)

> **Why this is the critical task:** every future hotel/driver/vehicle module routes hold creation through this calculation. A bug here breaks all of them. Build it as a pure static helper with table-driven tests so the algorithm is fully verified independent of DB plumbing.

**Files:**
- Create: `TravelCrm.Api/Features/Inventory/Calendar/AvailabilityCalculator.cs`
- Create: `TravelCrm.Tests/Inventory/AvailabilityCalculationTests.cs`

- [ ] **Step 1: Write the failing tests in `AvailabilityCalculationTests.cs`**

```csharp
using FluentAssertions;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Features.Inventory.Calendar;

namespace TravelCrm.Tests.Inventory;

public class AvailabilityCalculationTests
{
    private static PoolResource Pool(int defaultCapacity = 10) => new()
    {
        Id = Guid.NewGuid(), TenantId = Guid.NewGuid(),
        Type = "RoomType", Name = "X",
        DefaultCapacity = defaultCapacity, Status = ResourceStatus.Active,
    };

    private static AssetResource Asset() => new()
    {
        Id = Guid.NewGuid(), TenantId = Guid.NewGuid(),
        Type = "Vehicle", Name = "X", Status = ResourceStatus.Active,
    };

    private static DateOnly D(int month, int day) => new(2026, month, day);

    [Fact]
    public void Pool_NoOverridesNoHolds_AllowsUpToDefaultCapacity()
    {
        var r = Pool(10);
        var result = AvailabilityCalculator.Check(
            r, Array.Empty<ResourceCalendar>(), Array.Empty<ResourceHold>(),
            D(5, 1), D(5, 1), null, requestedQuantity: 10);

        result.IsAvailable.Should().BeTrue();
    }

    [Fact]
    public void Pool_ExceedingDefaultCapacity_RejectsWithFirstFailingDate()
    {
        var r = Pool(10);
        var result = AvailabilityCalculator.Check(
            r, Array.Empty<ResourceCalendar>(), Array.Empty<ResourceHold>(),
            D(5, 1), D(5, 1), null, requestedQuantity: 11);

        result.IsAvailable.Should().BeFalse();
        result.FailingDate.Should().Be(D(5, 1));
        result.Reason.Should().Contain("capacity");
    }

    [Fact]
    public void Pool_CalendarOverrideIncreasesCapacity()
    {
        var r = Pool(10);
        var overrides = new[]
        {
            new ResourceCalendar { ResourceId = r.Id, Date = D(5, 1), Slot = null, Capacity = 20 },
        };
        var result = AvailabilityCalculator.Check(
            r, overrides, Array.Empty<ResourceHold>(),
            D(5, 1), D(5, 1), null, requestedQuantity: 15);

        result.IsAvailable.Should().BeTrue();
    }

    [Fact]
    public void Pool_BlockedDateInRange_Rejects()
    {
        var r = Pool(10);
        var overrides = new[]
        {
            new ResourceCalendar { ResourceId = r.Id, Date = D(5, 2), Slot = null, Capacity = 10, IsBlocked = true },
        };
        var result = AvailabilityCalculator.Check(
            r, overrides, Array.Empty<ResourceHold>(),
            D(5, 1), D(5, 3), null, requestedQuantity: 1);

        result.IsAvailable.Should().BeFalse();
        result.FailingDate.Should().Be(D(5, 2));
        result.Reason.Should().Contain("blocked");
    }

    [Fact]
    public void Pool_OverlappingHolds_SubtractFromCapacity()
    {
        var r = Pool(10);
        var holds = new[]
        {
            new ResourceHold { ResourceId = r.Id, StartDate = D(5, 1), EndDate = D(5, 3),
                               Slot = null, Quantity = 7, Status = ResourceHoldStatus.Confirmed },
        };
        var result = AvailabilityCalculator.Check(
            r, Array.Empty<ResourceCalendar>(), holds,
            D(5, 2), D(5, 2), null, requestedQuantity: 4);

        result.IsAvailable.Should().BeFalse();
        result.Reason.Should().Contain("capacity");
    }

    [Fact]
    public void Pool_ReleasedAndExpiredHolds_AreIgnored()
    {
        var r = Pool(10);
        var holds = new[]
        {
            new ResourceHold { ResourceId = r.Id, StartDate = D(5, 1), EndDate = D(5, 1),
                               Quantity = 7, Status = ResourceHoldStatus.Released },
            new ResourceHold { ResourceId = r.Id, StartDate = D(5, 1), EndDate = D(5, 1),
                               Quantity = 5, Status = ResourceHoldStatus.Expired },
        };
        var result = AvailabilityCalculator.Check(
            r, Array.Empty<ResourceCalendar>(), holds,
            D(5, 1), D(5, 1), null, requestedQuantity: 10);

        result.IsAvailable.Should().BeTrue();
    }

    [Fact]
    public void Asset_NoHolds_AllowsOne()
    {
        var r = Asset();
        var result = AvailabilityCalculator.Check(
            r, Array.Empty<ResourceCalendar>(), Array.Empty<ResourceHold>(),
            D(5, 1), D(5, 1), null, requestedQuantity: 1);

        result.IsAvailable.Should().BeTrue();
    }

    [Fact]
    public void Asset_AnyExistingHold_RejectsSecondHold()
    {
        var r = Asset();
        var holds = new[]
        {
            new ResourceHold { ResourceId = r.Id, StartDate = D(5, 1), EndDate = D(5, 1),
                               Quantity = 1, Status = ResourceHoldStatus.Held },
        };
        var result = AvailabilityCalculator.Check(
            r, Array.Empty<ResourceCalendar>(), holds,
            D(5, 1), D(5, 1), null, requestedQuantity: 1);

        result.IsAvailable.Should().BeFalse();
    }

    [Fact]
    public void Slot_MorningHoldsDoNotConflictWithAfternoonRequest()
    {
        var r = Pool(1);
        var holds = new[]
        {
            new ResourceHold { ResourceId = r.Id, StartDate = D(5, 1), EndDate = D(5, 1),
                               Slot = ResourceCalendarSlot.Morning, Quantity = 1, Status = ResourceHoldStatus.Held },
        };
        var result = AvailabilityCalculator.Check(
            r, Array.Empty<ResourceCalendar>(), holds,
            D(5, 1), D(5, 1), ResourceCalendarSlot.Afternoon, requestedQuantity: 1);

        result.IsAvailable.Should().BeTrue();
    }

    [Fact]
    public void Slot_WholeDayHoldBlocksSlotRequest()
    {
        var r = Pool(1);
        var holds = new[]
        {
            new ResourceHold { ResourceId = r.Id, StartDate = D(5, 1), EndDate = D(5, 1),
                               Slot = null, Quantity = 1, Status = ResourceHoldStatus.Held },
        };
        var result = AvailabilityCalculator.Check(
            r, Array.Empty<ResourceCalendar>(), holds,
            D(5, 1), D(5, 1), ResourceCalendarSlot.Morning, requestedQuantity: 1);

        result.IsAvailable.Should().BeFalse();
    }

    [Fact]
    public void Slot_SlotHoldBlocksWholeDayRequest()
    {
        var r = Pool(1);
        var holds = new[]
        {
            new ResourceHold { ResourceId = r.Id, StartDate = D(5, 1), EndDate = D(5, 1),
                               Slot = ResourceCalendarSlot.Morning, Quantity = 1, Status = ResourceHoldStatus.Held },
        };
        var result = AvailabilityCalculator.Check(
            r, Array.Empty<ResourceCalendar>(), holds,
            D(5, 1), D(5, 1), null, requestedQuantity: 1);

        result.IsAvailable.Should().BeFalse();
    }

    [Fact]
    public void BackToBackHolds_DoNotConflict()
    {
        // Hold 1: D(5,1) to D(5,3). Hold 2: D(5,4) to D(5,6). Adjacent, not overlapping.
        var r = Asset();
        var holds = new[]
        {
            new ResourceHold { ResourceId = r.Id, StartDate = D(5, 1), EndDate = D(5, 3),
                               Quantity = 1, Status = ResourceHoldStatus.Confirmed },
        };
        var result = AvailabilityCalculator.Check(
            r, Array.Empty<ResourceCalendar>(), holds,
            D(5, 4), D(5, 6), null, requestedQuantity: 1);

        result.IsAvailable.Should().BeTrue();
    }
}
```

- [ ] **Step 2: Run to confirm failure**

Run: `dotnet test TravelCrm.Tests --filter "FullyQualifiedName~AvailabilityCalculationTests"`
Expected: build error — `AvailabilityCalculator` not defined.

- [ ] **Step 3: Create `AvailabilityCalculator.cs`**

```csharp
using TravelCrm.Api.Domain.Entities.Inventory;

namespace TravelCrm.Api.Features.Inventory.Calendar;

/// <summary>
/// Pure availability algorithm. No I/O. Callers fetch the relevant calendar
/// overrides + active holds and pass them in. Returns first failing date if any.
/// </summary>
public static class AvailabilityCalculator
{
    public static AvailabilityResult Check(
        Resource resource,
        IReadOnlyCollection<ResourceCalendar> calendarOverrides,
        IReadOnlyCollection<ResourceHold> existingHolds,
        DateOnly startDate,
        DateOnly endDate,
        ResourceCalendarSlot? requestedSlot,
        int requestedQuantity)
    {
        if (requestedQuantity < 1)
            return AvailabilityResult.Fail(startDate, "Quantity must be at least 1");

        if (resource is AssetResource && requestedQuantity != 1)
            return AvailabilityResult.Fail(startDate, "Asset resources must use Quantity = 1");

        var poolDefault = (resource as PoolResource)?.DefaultCapacity ?? 1;

        for (var d = startDate; d <= endDate; d = d.AddDays(1))
        {
            // 1. Determine capacity for this (date, slot)
            var calOverride = calendarOverrides.FirstOrDefault(
                c => c.ResourceId == resource.Id && c.Date == d && c.Slot == requestedSlot);

            if (calOverride is { IsBlocked: true })
                return AvailabilityResult.Fail(d, $"Date {d:yyyy-MM-dd} is blocked");

            var capacity = calOverride?.Capacity ?? poolDefault;

            // 2. Sum overlapping active holds with collision-compatible slot
            var occupied = existingHolds
                .Where(h => h.ResourceId == resource.Id
                         && (h.Status == ResourceHoldStatus.Held
                             || h.Status == ResourceHoldStatus.Confirmed)
                         && h.StartDate <= d && h.EndDate >= d
                         && SlotsCollide(h.Slot, requestedSlot))
                .Sum(h => h.Quantity);

            if (occupied + requestedQuantity > capacity)
                return AvailabilityResult.Fail(d,
                    $"Date {d:yyyy-MM-dd} exceeds capacity (have {capacity - occupied}, requesting {requestedQuantity})");
        }

        return AvailabilityResult.Ok();
    }

    /// <summary>
    /// Slot collision rule:
    ///   whole-day (null) collides with everything;
    ///   a specific slot collides with the same slot OR with whole-day.
    /// </summary>
    private static bool SlotsCollide(ResourceCalendarSlot? existing, ResourceCalendarSlot? requested)
        => existing is null || requested is null || existing == requested;
}

public sealed record AvailabilityResult(bool IsAvailable, DateOnly? FailingDate, string? Reason)
{
    public static AvailabilityResult Ok() => new(true, null, null);
    public static AvailabilityResult Fail(DateOnly date, string reason) => new(false, date, reason);
}
```

- [ ] **Step 4: Run tests**

Run: `dotnet test TravelCrm.Tests --filter "FullyQualifiedName~AvailabilityCalculationTests" -v minimal`
Expected: 12/12 pass.

- [ ] **Step 5: Commit**

```bash
git add TravelCrm.Api/Features/Inventory/Calendar/AvailabilityCalculator.cs \
        TravelCrm.Tests/Inventory/AvailabilityCalculationTests.cs
git commit -m "feat(inventory): add AvailabilityCalculator with comprehensive tests"
```

---

## Task 7: Calendar Feature (DTO + Handlers + Tests + Controller)

**Files:**
- Create: `TravelCrm.Api/Features/Inventory/Calendar/AvailabilityDto.cs`
- Create: `TravelCrm.Api/Features/Inventory/Calendar/Commands/SetCapacityCommand.cs`
- Create: `TravelCrm.Api/Features/Inventory/Calendar/Commands/BlockDateCommand.cs`
- Create: `TravelCrm.Api/Features/Inventory/Calendar/Commands/UnblockDateCommand.cs`
- Create: `TravelCrm.Api/Features/Inventory/Calendar/Queries/CheckAvailabilityQuery.cs`
- Create: `TravelCrm.Api/Features/Inventory/Calendar/CalendarController.cs`
- Create: `TravelCrm.Tests/Inventory/CalendarHandlersTests.cs`

- [ ] **Step 1: Write the failing tests in `CalendarHandlersTests.cs`**

```csharp
using FluentAssertions;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Features.Inventory.Calendar.Commands;
using TravelCrm.Api.Features.Inventory.Calendar.Queries;

namespace TravelCrm.Tests.Inventory;

public class CalendarHandlersTests
{
    private static Guid SeedPool(ApplicationDbContext db, Guid tenantId, int capacity = 10)
    {
        var id = Guid.NewGuid();
        db.PoolResources.Add(new PoolResource
        {
            Id = id, TenantId = tenantId, Type = "RoomType", Name = "Deluxe",
            DefaultCapacity = capacity, Status = ResourceStatus.Active,
        });
        db.SaveChanges();
        return id;
    }

    [Fact]
    public async Task SetCapacity_InsertsRow()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var resourceId = SeedPool(db, tenantId);

        var handler = new SetCapacityHandler(db, new FakeTenantContext(tenantId), user);
        var date = new DateOnly(2026, 5, 1);
        var result = await handler.Handle(new SetCapacityCommand(resourceId, date, null, 25, "festival"), default);

        result.IsSuccess.Should().BeTrue();
        var row = db.ResourceCalendar.Single();
        row.Capacity.Should().Be(25);
        row.Notes.Should().Be("festival");
    }

    [Fact]
    public async Task SetCapacity_Upserts_ExistingRow()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var resourceId = SeedPool(db, tenantId);
        var date = new DateOnly(2026, 5, 1);
        db.ResourceCalendar.Add(new ResourceCalendar
        {
            Id = Guid.NewGuid(), TenantId = tenantId,
            ResourceId = resourceId, Date = date, Slot = null, Capacity = 5,
        });
        await db.SaveChangesAsync();

        var handler = new SetCapacityHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new SetCapacityCommand(resourceId, date, null, 50, null), default);

        result.IsSuccess.Should().BeTrue();
        db.ResourceCalendar.Should().ContainSingle();
        db.ResourceCalendar.Single().Capacity.Should().Be(50);
    }

    [Fact]
    public async Task BlockDate_FlagsRowAsBlocked()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var resourceId = SeedPool(db, tenantId);

        var handler = new BlockDateHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(
            new BlockDateCommand(resourceId, new DateOnly(2026, 5, 1), null, "stop sale"), default);

        result.IsSuccess.Should().BeTrue();
        var row = db.ResourceCalendar.Single();
        row.IsBlocked.Should().BeTrue();
        row.Notes.Should().Be("stop sale");
    }

    [Fact]
    public async Task UnblockDate_ClearsBlockedFlag()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var resourceId = SeedPool(db, tenantId);
        var date = new DateOnly(2026, 5, 1);
        db.ResourceCalendar.Add(new ResourceCalendar
        {
            Id = Guid.NewGuid(), TenantId = tenantId,
            ResourceId = resourceId, Date = date, Slot = null, Capacity = 10, IsBlocked = true,
        });
        await db.SaveChangesAsync();

        var handler = new UnblockDateHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new UnblockDateCommand(resourceId, date, null), default);

        result.IsSuccess.Should().BeTrue();
        db.ResourceCalendar.Single().IsBlocked.Should().BeFalse();
    }

    [Fact]
    public async Task CheckAvailability_ReturnsPerDateBuckets()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var resourceId = SeedPool(db, tenantId, 10);

        var handler = new CheckAvailabilityHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(
            new CheckAvailabilityQuery(resourceId, new DateOnly(2026, 5, 1), new DateOnly(2026, 5, 3)), default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Should().HaveCount(3);
        result.Value!.All(a => a.Capacity == 10 && a.Available == 10 && !a.IsBlocked).Should().BeTrue();
    }
}
```

- [ ] **Step 2: Run failing**

Run: `dotnet test TravelCrm.Tests --filter "FullyQualifiedName~CalendarHandlersTests"`
Expected: build error.

- [ ] **Step 3: Create `AvailabilityDto.cs`**

```csharp
using TravelCrm.Api.Domain.Entities.Inventory;

namespace TravelCrm.Api.Features.Inventory.Calendar;

public sealed record AvailabilityDto(
    DateOnly Date,
    ResourceCalendarSlot? Slot,
    int Capacity,
    int Occupied,
    int Available,
    bool IsBlocked,
    string? Notes
);
```

- [ ] **Step 4: Create `Commands/SetCapacityCommand.cs`**

```csharp
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Calendar.Commands;

public sealed record SetCapacityCommand(
    Guid ResourceId,
    DateOnly Date,
    ResourceCalendarSlot? Slot,
    int Capacity,
    string? Notes
) : IRequest<Result>;

public sealed class SetCapacityValidator : AbstractValidator<SetCapacityCommand>
{
    public SetCapacityValidator()
    {
        RuleFor(x => x.ResourceId).NotEmpty();
        RuleFor(x => x.Capacity).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Notes).MaximumLength(500);
    }
}

public sealed class SetCapacityHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<SetCapacityCommand, Result>
{
    public async Task<Result> Handle(SetCapacityCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.calendar.manage"))
            return Result.Failure("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure("Tenant not resolved");

        var resourceExists = await db.Resources.AnyAsync(
            r => r.Id == cmd.ResourceId && r.TenantId == tenantContext.TenantId, ct);
        if (!resourceExists) return Result.Failure("Resource not found");

        var existing = await db.ResourceCalendar.FirstOrDefaultAsync(
            c => c.TenantId == tenantContext.TenantId
              && c.ResourceId == cmd.ResourceId
              && c.Date == cmd.Date
              && c.Slot == cmd.Slot, ct);

        if (existing is null)
        {
            db.ResourceCalendar.Add(new ResourceCalendar
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId!.Value,
                ResourceId = cmd.ResourceId,
                Date = cmd.Date,
                Slot = cmd.Slot,
                Capacity = cmd.Capacity,
                IsBlocked = false,
                Notes = cmd.Notes,
            });
        }
        else
        {
            existing.Capacity = cmd.Capacity;
            existing.Notes = cmd.Notes;
        }

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
```

- [ ] **Step 5: Create `Commands/BlockDateCommand.cs`**

```csharp
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Calendar.Commands;

public sealed record BlockDateCommand(
    Guid ResourceId,
    DateOnly Date,
    ResourceCalendarSlot? Slot,
    string? Notes
) : IRequest<Result>;

public sealed class BlockDateValidator : AbstractValidator<BlockDateCommand>
{
    public BlockDateValidator()
    {
        RuleFor(x => x.ResourceId).NotEmpty();
        RuleFor(x => x.Notes).MaximumLength(500);
    }
}

public sealed class BlockDateHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<BlockDateCommand, Result>
{
    public async Task<Result> Handle(BlockDateCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.calendar.manage"))
            return Result.Failure("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure("Tenant not resolved");

        var resource = await db.Resources.FirstOrDefaultAsync(
            r => r.Id == cmd.ResourceId && r.TenantId == tenantContext.TenantId, ct);
        if (resource is null) return Result.Failure("Resource not found");

        var existing = await db.ResourceCalendar.FirstOrDefaultAsync(
            c => c.TenantId == tenantContext.TenantId
              && c.ResourceId == cmd.ResourceId
              && c.Date == cmd.Date
              && c.Slot == cmd.Slot, ct);

        if (existing is null)
        {
            var defaultCapacity = (resource as PoolResource)?.DefaultCapacity ?? 1;
            db.ResourceCalendar.Add(new ResourceCalendar
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId!.Value,
                ResourceId = cmd.ResourceId,
                Date = cmd.Date,
                Slot = cmd.Slot,
                Capacity = defaultCapacity,
                IsBlocked = true,
                Notes = cmd.Notes,
            });
        }
        else
        {
            existing.IsBlocked = true;
            if (cmd.Notes is not null) existing.Notes = cmd.Notes;
        }

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
```

- [ ] **Step 6: Create `Commands/UnblockDateCommand.cs`**

```csharp
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Calendar.Commands;

public sealed record UnblockDateCommand(
    Guid ResourceId,
    DateOnly Date,
    ResourceCalendarSlot? Slot
) : IRequest<Result>;

public sealed class UnblockDateValidator : AbstractValidator<UnblockDateCommand>
{
    public UnblockDateValidator() => RuleFor(x => x.ResourceId).NotEmpty();
}

public sealed class UnblockDateHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<UnblockDateCommand, Result>
{
    public async Task<Result> Handle(UnblockDateCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.calendar.manage"))
            return Result.Failure("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure("Tenant not resolved");

        var existing = await db.ResourceCalendar.FirstOrDefaultAsync(
            c => c.TenantId == tenantContext.TenantId
              && c.ResourceId == cmd.ResourceId
              && c.Date == cmd.Date
              && c.Slot == cmd.Slot, ct);

        if (existing is null) return Result.Success(); // already unblocked

        existing.IsBlocked = false;
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
```

- [ ] **Step 7: Create `Queries/CheckAvailabilityQuery.cs`**

```csharp
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Calendar.Queries;

public sealed record CheckAvailabilityQuery(Guid ResourceId, DateOnly From, DateOnly To)
    : IRequest<Result<List<AvailabilityDto>>>;

public sealed class CheckAvailabilityHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<CheckAvailabilityQuery, Result<List<AvailabilityDto>>>
{
    public async Task<Result<List<AvailabilityDto>>> Handle(CheckAvailabilityQuery q, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.calendar.view"))
            return Result.Failure<List<AvailabilityDto>>("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure<List<AvailabilityDto>>("Tenant not resolved");

        var resource = await db.Resources
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == q.ResourceId && r.TenantId == tenantContext.TenantId, ct);
        if (resource is null) return Result.Failure<List<AvailabilityDto>>("Resource not found");

        var overrides = await db.ResourceCalendar
            .AsNoTracking()
            .Where(c => c.TenantId == tenantContext.TenantId
                     && c.ResourceId == q.ResourceId
                     && c.Date >= q.From && c.Date <= q.To)
            .ToListAsync(ct);

        var holds = await db.ResourceHolds
            .AsNoTracking()
            .Where(h => h.TenantId == tenantContext.TenantId
                     && h.ResourceId == q.ResourceId
                     && (h.Status == ResourceHoldStatus.Held || h.Status == ResourceHoldStatus.Confirmed)
                     && h.StartDate <= q.To && h.EndDate >= q.From)
            .ToListAsync(ct);

        var defaultCapacity = (resource as PoolResource)?.DefaultCapacity ?? 1;
        var result = new List<AvailabilityDto>();

        for (var d = q.From; d <= q.To; d = d.AddDays(1))
        {
            // Whole-day bucket only for now (slot UI is module-specific)
            var calOverride = overrides.FirstOrDefault(c => c.Date == d && c.Slot is null);
            var capacity = calOverride?.Capacity ?? defaultCapacity;
            var occupied = holds
                .Where(h => h.StartDate <= d && h.EndDate >= d
                         && (h.Slot is null)) // count whole-day holds only for whole-day bucket
                .Sum(h => h.Quantity);

            result.Add(new AvailabilityDto(
                Date: d,
                Slot: null,
                Capacity: capacity,
                Occupied: occupied,
                Available: Math.Max(0, capacity - occupied),
                IsBlocked: calOverride?.IsBlocked ?? false,
                Notes: calOverride?.Notes
            ));
        }

        return Result.Success(result);
    }
}
```

- [ ] **Step 8: Create `CalendarController.cs`**

```csharp
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Features.Inventory.Calendar.Commands;
using TravelCrm.Api.Features.Inventory.Calendar.Queries;

namespace TravelCrm.Api.Features.Inventory.Calendar;

[ApiController]
[Authorize]
[Route("api/inventory/resources/{resourceId:guid}/calendar")]
public sealed class CalendarController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(Guid resourceId, [FromQuery] DateOnly from, [FromQuery] DateOnly to)
    {
        var r = await mediator.Send(new CheckAvailabilityQuery(resourceId, from, to));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Forbid();
    }

    [HttpPost("capacity")]
    public async Task<IActionResult> SetCapacity(Guid resourceId, [FromBody] SetCapacityRequest body)
    {
        var r = await mediator.Send(
            new SetCapacityCommand(resourceId, body.Date, body.Slot, body.Capacity, body.Notes));
        if (r.IsSuccess) return Ok();
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : BadRequest(new { error = r.Error });
    }

    [HttpPost("block")]
    public async Task<IActionResult> Block(Guid resourceId, [FromBody] BlockDateRequest body)
    {
        var r = await mediator.Send(new BlockDateCommand(resourceId, body.Date, body.Slot, body.Notes));
        if (r.IsSuccess) return Ok();
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : BadRequest(new { error = r.Error });
    }

    [HttpPost("unblock")]
    public async Task<IActionResult> Unblock(Guid resourceId, [FromBody] UnblockDateRequest body)
    {
        var r = await mediator.Send(new UnblockDateCommand(resourceId, body.Date, body.Slot));
        return r.IsSuccess ? Ok() : Forbid();
    }
}

public sealed record SetCapacityRequest(DateOnly Date, ResourceCalendarSlot? Slot, int Capacity, string? Notes);
public sealed record BlockDateRequest(DateOnly Date, ResourceCalendarSlot? Slot, string? Notes);
public sealed record UnblockDateRequest(DateOnly Date, ResourceCalendarSlot? Slot);
```

- [ ] **Step 9: Run tests**

Run: `dotnet test TravelCrm.Tests --filter "FullyQualifiedName~CalendarHandlersTests" -v minimal`
Expected: 5/5 pass.

- [ ] **Step 10: Commit**

```bash
git add TravelCrm.Api/Features/Inventory/Calendar/ \
        TravelCrm.Tests/Inventory/CalendarHandlersTests.cs
git commit -m "feat(inventory): add Calendar CQRS feature + controller + tests"
```

---

## Task 8: IResourcePricing Strategy Interface + DI Registration

**Files:**
- Create: `TravelCrm.Api/Features/Inventory/Holds/IResourcePricing.cs`
- Create: `TravelCrm.Api/Features/Inventory/Holds/NullResourcePricing.cs`
- Modify: `TravelCrm.Api/Program.cs` (DI registration)

- [ ] **Step 1: Create `IResourcePricing.cs`**

```csharp
using TravelCrm.Api.Domain.Entities.Inventory;

namespace TravelCrm.Api.Features.Inventory.Holds;

/// <summary>
/// Pricing strategy contract. Each future resource module (Hotel, Vehicle, Driver, ...)
/// implements this with its own typed rate logic and registers it in DI. The hold flow
/// resolves IEnumerable&lt;IResourcePricing&gt; and picks the strategy where
/// <see cref="ResourceType"/> matches the resource's <c>Type</c> field, falling back to
/// <see cref="NullResourcePricing"/> if no specific strategy is registered.
/// </summary>
public interface IResourcePricing
{
    /// <summary>Resource type slug this strategy handles ("Hotel", "Vehicle", ...). "*" is a wildcard fallback.</summary>
    string ResourceType { get; }

    /// <summary>Compute total cost for a hold over a date range. Foundation never invokes this; the future Booking module will.</summary>
    Task<decimal> CalculatePriceAsync(
        Guid resourceId,
        DateOnly start,
        DateOnly end,
        ResourceCalendarSlot? slot,
        int quantity,
        CancellationToken ct);
}
```

- [ ] **Step 2: Create `NullResourcePricing.cs`**

```csharp
using TravelCrm.Api.Domain.Entities.Inventory;

namespace TravelCrm.Api.Features.Inventory.Holds;

/// <summary>Default fallback. Returns 0 for every resource type until a real implementation is registered.</summary>
public sealed class NullResourcePricing : IResourcePricing
{
    public string ResourceType => "*";

    public Task<decimal> CalculatePriceAsync(
        Guid resourceId, DateOnly start, DateOnly end,
        ResourceCalendarSlot? slot, int quantity, CancellationToken ct)
        => Task.FromResult(0m);
}
```

- [ ] **Step 3: Register in `Program.cs`**

In `TravelCrm.Api/Program.cs`, find the section with `builder.Services.AddScoped<...>` registrations (near MediatR setup, where other application services are registered). Add:

```csharp
// Inventory — pricing strategy fallback. Resource-type-specific implementations
// (e.g. HotelSeasonalPricing) are added by future sub-projects.
builder.Services.AddScoped<IResourcePricing, NullResourcePricing>();
```

Don't forget the `using TravelCrm.Api.Features.Inventory.Holds;` at the top of `Program.cs`.

- [ ] **Step 4: Verify build**

Run: `dotnet build TravelCrm.Api`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add TravelCrm.Api/Features/Inventory/Holds/IResourcePricing.cs \
        TravelCrm.Api/Features/Inventory/Holds/NullResourcePricing.cs \
        TravelCrm.Api/Program.cs
git commit -m "feat(inventory): add IResourcePricing strategy interface + NullResourcePricing fallback"
```

---

## Task 9: Hold Create + Confirm Commands + Tests

**Files:**
- Create: `TravelCrm.Api/Features/Inventory/Holds/HoldDto.cs`
- Create: `TravelCrm.Api/Features/Inventory/Holds/Commands/CreateHoldCommand.cs` (with SELECT FOR UPDATE)
- Create: `TravelCrm.Api/Features/Inventory/Holds/Commands/ConfirmHoldCommand.cs`
- Create: `TravelCrm.Tests/Inventory/HoldHandlersTests.cs` (5 tests this task; 5 more in Task 10)

- [ ] **Step 1: Write the failing tests in `HoldHandlersTests.cs`**

```csharp
using FluentAssertions;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Features.Inventory.Holds.Commands;

namespace TravelCrm.Tests.Inventory;

public class HoldHandlersTests
{
    private static Guid SeedPool(ApplicationDbContext db, Guid tenantId, int capacity = 10)
    {
        var id = Guid.NewGuid();
        db.PoolResources.Add(new PoolResource
        {
            Id = id, TenantId = tenantId, Type = "RoomType", Name = "Deluxe",
            DefaultCapacity = capacity, Status = ResourceStatus.Active,
        });
        db.SaveChanges();
        return id;
    }

    [Fact]
    public async Task CreateHold_WithCapacity_PersistsHeldStatus()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var resourceId = SeedPool(db, tenantId);
        var handler = new CreateHoldHandler(db, new FakeTenantContext(tenantId), user);

        var result = await handler.Handle(
            new CreateHoldCommand(resourceId, new DateOnly(2026, 5, 1), new DateOnly(2026, 5, 3), null, 2, null), default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be("Held");
        result.Value!.ExpiresAt.Should().NotBeNull();
        db.ResourceHolds.Should().ContainSingle();
    }

    [Fact]
    public async Task CreateHold_BlockedDate_Rejects()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var resourceId = SeedPool(db, tenantId);
        db.ResourceCalendar.Add(new ResourceCalendar
        {
            Id = Guid.NewGuid(), TenantId = tenantId,
            ResourceId = resourceId, Date = new DateOnly(2026, 5, 2),
            Slot = null, Capacity = 10, IsBlocked = true,
        });
        await db.SaveChangesAsync();

        var handler = new CreateHoldHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(
            new CreateHoldCommand(resourceId, new DateOnly(2026, 5, 1), new DateOnly(2026, 5, 3), null, 1, null), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("blocked");
    }

    [Fact]
    public async Task CreateHold_OnAssetWithQuantityNot1_Rejects()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var resourceId = Guid.NewGuid();
        db.AssetResources.Add(new AssetResource
        {
            Id = resourceId, TenantId = tenantId, Type = "Vehicle", Name = "X", Status = ResourceStatus.Active,
        });
        await db.SaveChangesAsync();

        var handler = new CreateHoldHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(
            new CreateHoldCommand(resourceId, new DateOnly(2026, 5, 1), new DateOnly(2026, 5, 1), null, 2, null), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("Asset");
    }

    [Fact]
    public async Task ConfirmHold_OnHeld_TransitionsToConfirmed()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var resourceId = SeedPool(db, tenantId);
        var holdId = Guid.NewGuid();
        db.ResourceHolds.Add(new ResourceHold
        {
            Id = holdId, TenantId = tenantId, ResourceId = resourceId,
            StartDate = new DateOnly(2026, 5, 1), EndDate = new DateOnly(2026, 5, 1),
            Quantity = 1, Status = ResourceHoldStatus.Held,
            ExpiresAt = DateTime.UtcNow.AddHours(12), HeldByUserId = user.UserId,
        });
        await db.SaveChangesAsync();

        var handler = new ConfirmHoldHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new ConfirmHoldCommand(holdId, "BK-001"), default);

        result.IsSuccess.Should().BeTrue();
        var fresh = db.ResourceHolds.Find(holdId)!;
        fresh.Status.Should().Be(ResourceHoldStatus.Confirmed);
        fresh.ExpiresAt.Should().BeNull();
        fresh.BookingRef.Should().Be("BK-001");
    }

    [Fact]
    public async Task ConfirmHold_AfterExpiry_Returns410Equivalent()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var resourceId = SeedPool(db, tenantId);
        var holdId = Guid.NewGuid();
        db.ResourceHolds.Add(new ResourceHold
        {
            Id = holdId, TenantId = tenantId, ResourceId = resourceId,
            StartDate = new DateOnly(2026, 5, 1), EndDate = new DateOnly(2026, 5, 1),
            Quantity = 1, Status = ResourceHoldStatus.Held,
            ExpiresAt = DateTime.UtcNow.AddHours(-1), HeldByUserId = user.UserId,
        });
        await db.SaveChangesAsync();

        var handler = new ConfirmHoldHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new ConfirmHoldCommand(holdId, null), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("expired");
    }
}
```

- [ ] **Step 2: Run failing**

Run: `dotnet test TravelCrm.Tests --filter "FullyQualifiedName~HoldHandlersTests"`
Expected: build error.

- [ ] **Step 3: Create `HoldDto.cs`**

```csharp
using TravelCrm.Api.Domain.Entities.Inventory;

namespace TravelCrm.Api.Features.Inventory.Holds;

public sealed record HoldDto(
    Guid Id,
    Guid ResourceId,
    string ResourceName,
    DateOnly StartDate,
    DateOnly EndDate,
    ResourceCalendarSlot? Slot,
    int Quantity,
    string Status,
    DateTime? ExpiresAt,
    string? BookingRef,
    Guid HeldByUserId,
    int ExtensionCount,
    string? Notes,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public static class HoldMapper
{
    public static HoldDto ToDto(ResourceHold h, string resourceName) => new(
        h.Id, h.ResourceId, resourceName,
        h.StartDate, h.EndDate, h.Slot, h.Quantity,
        h.Status.ToString(), h.ExpiresAt, h.BookingRef,
        h.HeldByUserId, h.ExtensionCount, h.Notes,
        h.CreatedAt, h.UpdatedAt ?? h.CreatedAt
    );
}
```

- [ ] **Step 4: Create `Commands/CreateHoldCommand.cs`**

> Uses `SELECT … FOR UPDATE` on the Resource row to serialize concurrent holds. The InMemory provider used by unit tests silently ignores the lock — that's acceptable; the algorithm correctness tests cover the logic, and `HoldConcurrencyTests` (Task 12) covers the lock against PostgreSQL.

```csharp
using System.Data;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Features.Inventory.Calendar;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Holds.Commands;

public sealed record CreateHoldCommand(
    Guid ResourceId,
    DateOnly StartDate,
    DateOnly EndDate,
    ResourceCalendarSlot? Slot,
    int Quantity,
    string? Notes
) : IRequest<Result<HoldDto>>;

public sealed class CreateHoldValidator : AbstractValidator<CreateHoldCommand>
{
    public CreateHoldValidator()
    {
        RuleFor(x => x.ResourceId).NotEmpty();
        RuleFor(x => x.Quantity).GreaterThan(0);
        RuleFor(x => x.Notes).MaximumLength(500);
        RuleFor(x => x.EndDate)
            .GreaterThanOrEqualTo(x => x.StartDate)
            .WithMessage("EndDate must be on or after StartDate");
    }
}

public sealed class CreateHoldHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<CreateHoldCommand, Result<HoldDto>>
{
    public async Task<Result<HoldDto>> Handle(CreateHoldCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.holds.manage"))
            return Result.Failure<HoldDto>("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure<HoldDto>("Tenant not resolved");

        await using var tx = await db.Database
            .BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        // Pessimistic lock on the resource row — serialises concurrent holds.
        // No-op on the InMemory test provider; takes effect against PostgreSQL.
        if (db.Database.IsNpgsql())
        {
            await db.Database.ExecuteSqlRawAsync(
                "SELECT 1 FROM resources WHERE id = {0} FOR UPDATE",
                new object[] { cmd.ResourceId }, ct);
        }

        var resource = await db.Resources
            .FirstOrDefaultAsync(r => r.Id == cmd.ResourceId
                                   && r.TenantId == tenantContext.TenantId, ct);
        if (resource is null) return Result.Failure<HoldDto>("Resource not found");
        if (resource.Status != ResourceStatus.Active)
            return Result.Failure<HoldDto>("Resource is not active");

        if (resource is AssetResource && cmd.Quantity != 1)
            return Result.Failure<HoldDto>("Asset resources must use Quantity = 1");

        var overrides = await db.ResourceCalendar
            .Where(c => c.TenantId == tenantContext.TenantId
                     && c.ResourceId == cmd.ResourceId
                     && c.Date >= cmd.StartDate && c.Date <= cmd.EndDate)
            .ToListAsync(ct);

        var holds = await db.ResourceHolds
            .Where(h => h.TenantId == tenantContext.TenantId
                     && h.ResourceId == cmd.ResourceId
                     && (h.Status == ResourceHoldStatus.Held || h.Status == ResourceHoldStatus.Confirmed)
                     && h.StartDate <= cmd.EndDate && h.EndDate >= cmd.StartDate)
            .ToListAsync(ct);

        var availability = AvailabilityCalculator.Check(
            resource, overrides, holds,
            cmd.StartDate, cmd.EndDate, cmd.Slot, cmd.Quantity);

        if (!availability.IsAvailable)
            return Result.Failure<HoldDto>(availability.Reason!);

        var ttl = await GetHoldTtlHoursAsync(tenantContext.TenantId!.Value, ct);
        var hold = new ResourceHold
        {
            Id = Guid.NewGuid(),
            TenantId = tenantContext.TenantId!.Value,
            ResourceId = cmd.ResourceId,
            StartDate = cmd.StartDate,
            EndDate = cmd.EndDate,
            Slot = cmd.Slot,
            Quantity = cmd.Quantity,
            Status = ResourceHoldStatus.Held,
            ExpiresAt = DateTime.UtcNow.AddHours(ttl),
            HeldByUserId = currentUser.UserId,
            Notes = cmd.Notes,
            ExtensionCount = 0,
        };
        db.ResourceHolds.Add(hold);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return Result.Success(HoldMapper.ToDto(hold, resource.Name));
    }

    private async Task<int> GetHoldTtlHoursAsync(Guid tenantId, CancellationToken ct)
    {
        var settings = await db.InventorySettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == tenantId, ct);
        return settings?.HoldTtlHours ?? 24;
    }
}
```

- [ ] **Step 5: Create `Commands/ConfirmHoldCommand.cs`**

```csharp
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Holds.Commands;

public sealed record ConfirmHoldCommand(Guid Id, string? BookingRef) : IRequest<Result<HoldDto>>;

public sealed class ConfirmHoldValidator : AbstractValidator<ConfirmHoldCommand>
{
    public ConfirmHoldValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.BookingRef).MaximumLength(100);
    }
}

public sealed class ConfirmHoldHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<ConfirmHoldCommand, Result<HoldDto>>
{
    public async Task<Result<HoldDto>> Handle(ConfirmHoldCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.holds.manage"))
            return Result.Failure<HoldDto>("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure<HoldDto>("Tenant not resolved");

        var hold = await db.ResourceHolds
            .Include(h => h.Resource)
            .FirstOrDefaultAsync(h => h.Id == cmd.Id && h.TenantId == tenantContext.TenantId, ct);
        if (hold is null) return Result.Failure<HoldDto>("Hold not found");

        if (hold.Status != ResourceHoldStatus.Held)
            return Result.Failure<HoldDto>($"Hold is not in Held state (current: {hold.Status})");

        if (hold.ExpiresAt is not null && hold.ExpiresAt < DateTime.UtcNow)
            return Result.Failure<HoldDto>("Hold has expired");

        hold.Status = ResourceHoldStatus.Confirmed;
        hold.ExpiresAt = null;
        hold.BookingRef = cmd.BookingRef;

        await db.SaveChangesAsync(ct);
        return Result.Success(HoldMapper.ToDto(hold, hold.Resource?.Name ?? ""));
    }
}
```

- [ ] **Step 6: Run tests**

Run: `dotnet test TravelCrm.Tests --filter "FullyQualifiedName~HoldHandlersTests" -v minimal`
Expected: 5/5 pass.

- [ ] **Step 7: Commit**

```bash
git add TravelCrm.Api/Features/Inventory/Holds/HoldDto.cs \
        TravelCrm.Api/Features/Inventory/Holds/Commands/CreateHoldCommand.cs \
        TravelCrm.Api/Features/Inventory/Holds/Commands/ConfirmHoldCommand.cs \
        TravelCrm.Tests/Inventory/HoldHandlersTests.cs
git commit -m "feat(inventory): add CreateHold (with FOR UPDATE) and ConfirmHold commands"
```

---

## Task 10: ReleaseHold + ExtendHold Commands + Hold Queries + Controller

**Files:**
- Create: `TravelCrm.Api/Features/Inventory/Holds/Commands/ReleaseHoldCommand.cs`
- Create: `TravelCrm.Api/Features/Inventory/Holds/Commands/ExtendHoldCommand.cs`
- Create: `TravelCrm.Api/Features/Inventory/Holds/Queries/ListHoldsQuery.cs`
- Create: `TravelCrm.Api/Features/Inventory/Holds/Queries/GetHoldQuery.cs`
- Create: `TravelCrm.Api/Features/Inventory/Holds/HoldsController.cs`
- Modify: `TravelCrm.Tests/Inventory/HoldHandlersTests.cs` (append 5 tests)

- [ ] **Step 1: Append failing tests to `HoldHandlersTests.cs`**

Inside the `HoldHandlersTests` class:

```csharp
[Fact]
public async Task ReleaseHold_OnHeld_TransitionsToReleased()
{
    var (db, _, tenantId) = TestDb.New();
    var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
    var resourceId = SeedPool(db, tenantId);
    var holdId = Guid.NewGuid();
    db.ResourceHolds.Add(new ResourceHold
    {
        Id = holdId, TenantId = tenantId, ResourceId = resourceId,
        StartDate = new DateOnly(2026, 5, 1), EndDate = new DateOnly(2026, 5, 1),
        Quantity = 1, Status = ResourceHoldStatus.Held,
        ExpiresAt = DateTime.UtcNow.AddHours(12), HeldByUserId = user.UserId,
    });
    await db.SaveChangesAsync();

    var handler = new ReleaseHoldHandler(db, new FakeTenantContext(tenantId), user);
    var result = await handler.Handle(new ReleaseHoldCommand(holdId, "customer cancelled"), default);

    result.IsSuccess.Should().BeTrue();
    db.ResourceHolds.Find(holdId)!.Status.Should().Be(ResourceHoldStatus.Released);
}

[Fact]
public async Task ReleaseHold_OnReleased_ReturnsConflict()
{
    var (db, _, tenantId) = TestDb.New();
    var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
    var resourceId = SeedPool(db, tenantId);
    var holdId = Guid.NewGuid();
    db.ResourceHolds.Add(new ResourceHold
    {
        Id = holdId, TenantId = tenantId, ResourceId = resourceId,
        StartDate = new DateOnly(2026, 5, 1), EndDate = new DateOnly(2026, 5, 1),
        Quantity = 1, Status = ResourceHoldStatus.Released, HeldByUserId = user.UserId,
    });
    await db.SaveChangesAsync();

    var handler = new ReleaseHoldHandler(db, new FakeTenantContext(tenantId), user);
    var result = await handler.Handle(new ReleaseHoldCommand(holdId, null), default);

    result.IsSuccess.Should().BeFalse();
    result.Error.Should().Contain("terminal");
}

[Fact]
public async Task ExtendHold_BumpsExpiresAt_AndIncrementsCount()
{
    var (db, _, tenantId) = TestDb.New();
    var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
    var resourceId = SeedPool(db, tenantId);
    var holdId = Guid.NewGuid();
    var originalExpiry = DateTime.UtcNow.AddHours(2);
    db.ResourceHolds.Add(new ResourceHold
    {
        Id = holdId, TenantId = tenantId, ResourceId = resourceId,
        StartDate = new DateOnly(2026, 5, 1), EndDate = new DateOnly(2026, 5, 1),
        Quantity = 1, Status = ResourceHoldStatus.Held,
        ExpiresAt = originalExpiry, ExtensionCount = 0, HeldByUserId = user.UserId,
    });
    await db.SaveChangesAsync();

    var handler = new ExtendHoldHandler(db, new FakeTenantContext(tenantId), user);
    var result = await handler.Handle(new ExtendHoldCommand(holdId), default);

    result.IsSuccess.Should().BeTrue();
    var fresh = db.ResourceHolds.Find(holdId)!;
    fresh.ExtensionCount.Should().Be(1);
    fresh.ExpiresAt.Should().BeAfter(originalExpiry);
}

[Fact]
public async Task ExtendHold_AfterThreeExtensions_Rejects()
{
    var (db, _, tenantId) = TestDb.New();
    var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
    var resourceId = SeedPool(db, tenantId);
    var holdId = Guid.NewGuid();
    db.ResourceHolds.Add(new ResourceHold
    {
        Id = holdId, TenantId = tenantId, ResourceId = resourceId,
        StartDate = new DateOnly(2026, 5, 1), EndDate = new DateOnly(2026, 5, 1),
        Quantity = 1, Status = ResourceHoldStatus.Held,
        ExpiresAt = DateTime.UtcNow.AddHours(2), ExtensionCount = 3, HeldByUserId = user.UserId,
    });
    await db.SaveChangesAsync();

    var handler = new ExtendHoldHandler(db, new FakeTenantContext(tenantId), user);
    var result = await handler.Handle(new ExtendHoldCommand(holdId), default);

    result.IsSuccess.Should().BeFalse();
    result.Error.Should().Contain("limit");
}

[Fact]
public async Task ListHolds_FiltersByStatus()
{
    var (db, _, tenantId) = TestDb.New();
    var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
    var resourceId = SeedPool(db, tenantId);
    db.ResourceHolds.Add(new ResourceHold { Id = Guid.NewGuid(), TenantId = tenantId, ResourceId = resourceId,
        StartDate = new DateOnly(2026, 5, 1), EndDate = new DateOnly(2026, 5, 1),
        Quantity = 1, Status = ResourceHoldStatus.Held, HeldByUserId = user.UserId, ExpiresAt = DateTime.UtcNow.AddHours(1) });
    db.ResourceHolds.Add(new ResourceHold { Id = Guid.NewGuid(), TenantId = tenantId, ResourceId = resourceId,
        StartDate = new DateOnly(2026, 5, 2), EndDate = new DateOnly(2026, 5, 2),
        Quantity = 1, Status = ResourceHoldStatus.Confirmed, HeldByUserId = user.UserId });
    await db.SaveChangesAsync();

    var handler = new ListHoldsHandler(db, new FakeTenantContext(tenantId), user);
    var result = await handler.Handle(new ListHoldsQuery(null, "Confirmed", null, null), default);

    result.IsSuccess.Should().BeTrue();
    result.Value!.Should().HaveCount(1);
    result.Value!.Single().Status.Should().Be("Confirmed");
}
```

- [ ] **Step 2: Create `Commands/ReleaseHoldCommand.cs`**

```csharp
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Holds.Commands;

public sealed record ReleaseHoldCommand(Guid Id, string? Notes) : IRequest<Result>;

public sealed class ReleaseHoldValidator : AbstractValidator<ReleaseHoldCommand>
{
    public ReleaseHoldValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Notes).MaximumLength(500);
    }
}

public sealed class ReleaseHoldHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<ReleaseHoldCommand, Result>
{
    public async Task<Result> Handle(ReleaseHoldCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.holds.manage"))
            return Result.Failure("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure("Tenant not resolved");

        var hold = await db.ResourceHolds.FirstOrDefaultAsync(
            h => h.Id == cmd.Id && h.TenantId == tenantContext.TenantId, ct);
        if (hold is null) return Result.Failure("Hold not found");

        if (hold.Status is ResourceHoldStatus.Released or ResourceHoldStatus.Expired)
            return Result.Failure($"Hold is in terminal state ({hold.Status}) and cannot be released again");

        hold.Status = ResourceHoldStatus.Released;
        hold.ExpiresAt = null;
        if (cmd.Notes is not null) hold.Notes = cmd.Notes;

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
```

- [ ] **Step 3: Create `Commands/ExtendHoldCommand.cs`**

```csharp
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Holds.Commands;

public sealed record ExtendHoldCommand(Guid Id) : IRequest<Result<HoldDto>>;

public sealed class ExtendHoldValidator : AbstractValidator<ExtendHoldCommand>
{
    public ExtendHoldValidator() => RuleFor(x => x.Id).NotEmpty();
}

public sealed class ExtendHoldHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<ExtendHoldCommand, Result<HoldDto>>
{
    private const int MaxExtensions = 3;

    public async Task<Result<HoldDto>> Handle(ExtendHoldCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.holds.manage"))
            return Result.Failure<HoldDto>("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure<HoldDto>("Tenant not resolved");

        var hold = await db.ResourceHolds
            .Include(h => h.Resource)
            .FirstOrDefaultAsync(h => h.Id == cmd.Id && h.TenantId == tenantContext.TenantId, ct);
        if (hold is null) return Result.Failure<HoldDto>("Hold not found");

        if (hold.Status != ResourceHoldStatus.Held)
            return Result.Failure<HoldDto>($"Hold is not in Held state (current: {hold.Status})");

        if (hold.ExtensionCount >= MaxExtensions)
            return Result.Failure<HoldDto>($"Extension limit reached (max {MaxExtensions})");

        var settings = await db.InventorySettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == tenantContext.TenantId, ct);
        var ttlHours = settings?.HoldTtlHours ?? 24;

        hold.ExpiresAt = (hold.ExpiresAt ?? DateTime.UtcNow).AddHours(ttlHours);
        hold.ExtensionCount += 1;

        await db.SaveChangesAsync(ct);
        return Result.Success(HoldMapper.ToDto(hold, hold.Resource?.Name ?? ""));
    }
}
```

- [ ] **Step 4: Create `Queries/ListHoldsQuery.cs`**

```csharp
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Holds.Queries;

public sealed record ListHoldsQuery(
    Guid? ResourceId,
    string? Status,
    DateOnly? From,
    DateOnly? To
) : IRequest<Result<List<HoldDto>>>;

public sealed class ListHoldsHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<ListHoldsQuery, Result<List<HoldDto>>>
{
    public async Task<Result<List<HoldDto>>> Handle(ListHoldsQuery q, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.holds.view"))
            return Result.Failure<List<HoldDto>>("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure<List<HoldDto>>("Tenant not resolved");

        var query = db.ResourceHolds
            .AsNoTracking()
            .Include(h => h.Resource)
            .Where(h => h.TenantId == tenantContext.TenantId);

        if (q.ResourceId.HasValue)
            query = query.Where(h => h.ResourceId == q.ResourceId.Value);

        if (!string.IsNullOrWhiteSpace(q.Status)
            && Enum.TryParse<ResourceHoldStatus>(q.Status, ignoreCase: true, out var status))
            query = query.Where(h => h.Status == status);

        if (q.From.HasValue) query = query.Where(h => h.EndDate >= q.From.Value);
        if (q.To.HasValue) query = query.Where(h => h.StartDate <= q.To.Value);

        var rows = await query.OrderByDescending(h => h.CreatedAt).ToListAsync(ct);
        return Result.Success(rows.Select(h => HoldMapper.ToDto(h, h.Resource?.Name ?? "")).ToList());
    }
}
```

- [ ] **Step 5: Create `Queries/GetHoldQuery.cs`**

```csharp
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Holds.Queries;

public sealed record GetHoldQuery(Guid Id) : IRequest<Result<HoldDto>>;

public sealed class GetHoldHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<GetHoldQuery, Result<HoldDto>>
{
    public async Task<Result<HoldDto>> Handle(GetHoldQuery q, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.holds.view"))
            return Result.Failure<HoldDto>("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure<HoldDto>("Tenant not resolved");

        var hold = await db.ResourceHolds
            .AsNoTracking()
            .Include(h => h.Resource)
            .FirstOrDefaultAsync(h => h.Id == q.Id && h.TenantId == tenantContext.TenantId, ct);
        if (hold is null) return Result.Failure<HoldDto>("Hold not found");

        return Result.Success(HoldMapper.ToDto(hold, hold.Resource?.Name ?? ""));
    }
}
```

- [ ] **Step 6: Create `HoldsController.cs`**

```csharp
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Features.Inventory.Holds.Commands;
using TravelCrm.Api.Features.Inventory.Holds.Queries;

namespace TravelCrm.Api.Features.Inventory.Holds;

[ApiController]
[Authorize]
[Route("api/inventory/holds")]
public sealed class HoldsController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] Guid? resourceId,
        [FromQuery] string? status,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to)
    {
        var r = await mediator.Send(new ListHoldsQuery(resourceId, status, from, to));
        return r.IsSuccess ? Ok(r.Value) : Forbid();
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var r = await mediator.Send(new GetHoldQuery(id));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Forbid();
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateHoldRequest body)
    {
        var r = await mediator.Send(new CreateHoldCommand(
            body.ResourceId, body.StartDate, body.EndDate, body.Slot, body.Quantity, body.Notes));
        return r.IsSuccess
            ? CreatedAtAction(nameof(Get), new { id = r.Value!.Id }, r.Value)
            : BadRequest(new { error = r.Error });
    }

    [HttpPost("{id:guid}/confirm")]
    public async Task<IActionResult> Confirm(Guid id, [FromBody] ConfirmHoldRequest body)
    {
        var r = await mediator.Send(new ConfirmHoldCommand(id, body.BookingRef));
        if (r.IsSuccess) return Ok(r.Value);
        if (r.Error!.Contains("expired", StringComparison.OrdinalIgnoreCase))
            return StatusCode(410, new { error = r.Error });
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Conflict(new { error = r.Error });
    }

    [HttpPost("{id:guid}/release")]
    public async Task<IActionResult> Release(Guid id, [FromBody] ReleaseHoldRequest body)
    {
        var r = await mediator.Send(new ReleaseHoldCommand(id, body?.Notes));
        if (r.IsSuccess) return NoContent();
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Conflict(new { error = r.Error });
    }

    [HttpPost("{id:guid}/extend")]
    public async Task<IActionResult> Extend(Guid id)
    {
        var r = await mediator.Send(new ExtendHoldCommand(id));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Conflict(new { error = r.Error });
    }
}

public sealed record CreateHoldRequest(
    Guid ResourceId, DateOnly StartDate, DateOnly EndDate,
    ResourceCalendarSlot? Slot, int Quantity, string? Notes);
public sealed record ConfirmHoldRequest(string? BookingRef);
public sealed record ReleaseHoldRequest(string? Notes);
```

- [ ] **Step 7: Run tests**

Run: `dotnet test TravelCrm.Tests --filter "FullyQualifiedName~HoldHandlersTests" -v minimal`
Expected: 10/10 pass.

- [ ] **Step 8: Commit**

```bash
git add TravelCrm.Api/Features/Inventory/Holds/Commands/ReleaseHoldCommand.cs \
        TravelCrm.Api/Features/Inventory/Holds/Commands/ExtendHoldCommand.cs \
        TravelCrm.Api/Features/Inventory/Holds/Queries/ \
        TravelCrm.Api/Features/Inventory/Holds/HoldsController.cs \
        TravelCrm.Tests/Inventory/HoldHandlersTests.cs
git commit -m "feat(inventory): add Release/Extend hold commands, queries, and controller"
```

---

## Task 11: HoldExpirySweepJob + Tests + Hangfire Registration

**Files:**
- Create: `TravelCrm.Api/Infrastructure/Jobs/HoldExpirySweepJob.cs`
- Create: `TravelCrm.Tests/Inventory/HoldExpirySweepJobTests.cs`
- Modify: `TravelCrm.Api/Infrastructure/Jobs/RecurringJobRegistrar.cs`
- Modify: `TravelCrm.Api/Program.cs` (DI registration)

- [ ] **Step 1: Write failing tests in `HoldExpirySweepJobTests.cs`**

```csharp
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Jobs;

namespace TravelCrm.Tests.Inventory;

public class HoldExpirySweepJobTests
{
    private static Guid SeedPool(ApplicationDbContext db, Guid tenantId)
    {
        var id = Guid.NewGuid();
        db.PoolResources.Add(new PoolResource
        {
            Id = id, TenantId = tenantId, Type = "RoomType", Name = "X",
            DefaultCapacity = 10, Status = ResourceStatus.Active,
        });
        db.SaveChanges();
        return id;
    }

    [Fact]
    public async Task Sweep_ExpiresHeldRowsWithPastExpiry()
    {
        var (db, _, tenantId) = TestDb.New();
        var resourceId = SeedPool(db, tenantId);
        var stale = Guid.NewGuid();
        db.ResourceHolds.Add(new ResourceHold
        {
            Id = stale, TenantId = tenantId, ResourceId = resourceId,
            StartDate = new DateOnly(2026, 5, 1), EndDate = new DateOnly(2026, 5, 1),
            Quantity = 1, Status = ResourceHoldStatus.Held,
            ExpiresAt = DateTime.UtcNow.AddHours(-1), HeldByUserId = Guid.NewGuid(),
        });
        await db.SaveChangesAsync();

        var job = new HoldExpirySweepJob(db, NullLogger<HoldExpirySweepJob>.Instance);
        await job.ExecuteAsync(default);

        db.ResourceHolds.Find(stale)!.Status.Should().Be(ResourceHoldStatus.Expired);
    }

    [Fact]
    public async Task Sweep_IgnoresConfirmedHolds()
    {
        var (db, _, tenantId) = TestDb.New();
        var resourceId = SeedPool(db, tenantId);
        var confirmed = Guid.NewGuid();
        db.ResourceHolds.Add(new ResourceHold
        {
            Id = confirmed, TenantId = tenantId, ResourceId = resourceId,
            StartDate = new DateOnly(2026, 5, 1), EndDate = new DateOnly(2026, 5, 1),
            Quantity = 1, Status = ResourceHoldStatus.Confirmed,
            ExpiresAt = null, HeldByUserId = Guid.NewGuid(),
        });
        await db.SaveChangesAsync();

        var job = new HoldExpirySweepJob(db, NullLogger<HoldExpirySweepJob>.Instance);
        await job.ExecuteAsync(default);

        db.ResourceHolds.Find(confirmed)!.Status.Should().Be(ResourceHoldStatus.Confirmed);
    }

    [Fact]
    public async Task Sweep_IgnoresFutureExpiry()
    {
        var (db, _, tenantId) = TestDb.New();
        var resourceId = SeedPool(db, tenantId);
        var future = Guid.NewGuid();
        db.ResourceHolds.Add(new ResourceHold
        {
            Id = future, TenantId = tenantId, ResourceId = resourceId,
            StartDate = new DateOnly(2026, 5, 1), EndDate = new DateOnly(2026, 5, 1),
            Quantity = 1, Status = ResourceHoldStatus.Held,
            ExpiresAt = DateTime.UtcNow.AddHours(1), HeldByUserId = Guid.NewGuid(),
        });
        await db.SaveChangesAsync();

        var job = new HoldExpirySweepJob(db, NullLogger<HoldExpirySweepJob>.Instance);
        await job.ExecuteAsync(default);

        db.ResourceHolds.Find(future)!.Status.Should().Be(ResourceHoldStatus.Held);
    }
}
```

- [ ] **Step 2: Run failing**

Run: `dotnet test TravelCrm.Tests --filter "FullyQualifiedName~HoldExpirySweepJobTests"`
Expected: build error.

- [ ] **Step 3: Create `HoldExpirySweepJob.cs`**

```csharp
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Infrastructure.Jobs;

/// <summary>
/// Hangfire recurring job. Marks expired Held rows as Expired so capacity is freed.
/// Runs every 5 minutes via <see cref="RecurringJobRegistrar"/>.
/// </summary>
public sealed class HoldExpirySweepJob(
    ApplicationDbContext db,
    ILogger<HoldExpirySweepJob> logger)
{
    public async Task ExecuteAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var expired = await db.ResourceHolds
            .Where(h => h.Status == ResourceHoldStatus.Held
                     && h.ExpiresAt != null
                     && h.ExpiresAt < now)
            .ToListAsync(ct);

        if (expired.Count == 0)
        {
            logger.LogInformation("HoldExpirySweep: no holds to expire");
            return;
        }

        foreach (var h in expired) h.Status = ResourceHoldStatus.Expired;

        await db.SaveChangesAsync(ct);
        logger.LogInformation("HoldExpirySweep: expired {Count} holds", expired.Count);
    }
}
```

- [ ] **Step 4: Register in DI in `Program.cs`**

In `TravelCrm.Api/Program.cs`, find the existing scoped Hangfire-job registration (e.g. `builder.Services.AddScoped<SampleHeartbeatJob>();` or `builder.Services.AddScoped<TravelCrm.Api.Infrastructure.Jobs.OverdueTasksJob>();`). Add a sibling line:

```csharp
builder.Services.AddScoped<TravelCrm.Api.Infrastructure.Jobs.HoldExpirySweepJob>();
```

- [ ] **Step 5: Add to `RecurringJobRegistrar.cs`**

In `TravelCrm.Api/Infrastructure/Jobs/RecurringJobRegistrar.cs`, find the `RegisterAll(IRecurringJobManager jobs)` method body. Add (after the existing `OverdueTasksJob` registration):

```csharp
jobs.AddOrUpdate<HoldExpirySweepJob>(
    recurringJobId: "hold-expiry-sweep",
    methodCall: j => j.ExecuteAsync(CancellationToken.None),
    cronExpression: Cron.MinuteInterval(5));
```

`Cron` and `IRecurringJobManager` are already imported via the existing `using Hangfire;`.

- [ ] **Step 6: Verify build + run tests**

```bash
dotnet build TravelCrm.Api
dotnet test TravelCrm.Tests --filter "FullyQualifiedName~HoldExpirySweepJobTests" -v minimal
```

Expected: 0 build errors. 3/3 tests pass.

- [ ] **Step 7: Smoke-test the job**

Start the API: `dotnet run --project TravelCrm.Api`. Open `http://localhost:5044/hangfire` (Hangfire dashboard). Confirm `hold-expiry-sweep` appears in **Recurring Jobs** with cron `*/5 * * * *`. Click "Trigger now" — logs should show "HoldExpirySweep: no holds to expire" (or a count if test data exists).

- [ ] **Step 8: Commit**

```bash
git add TravelCrm.Api/Infrastructure/Jobs/HoldExpirySweepJob.cs \
        TravelCrm.Api/Infrastructure/Jobs/RecurringJobRegistrar.cs \
        TravelCrm.Api/Program.cs \
        TravelCrm.Tests/Inventory/HoldExpirySweepJobTests.cs
git commit -m "feat(inventory): add HoldExpirySweepJob (Hangfire 5-min recurring)"
```

---

## Task 12: HoldConcurrencyTests (PostgreSQL-only, optional)

> Tests the `SELECT … FOR UPDATE` pessimistic lock against a real PostgreSQL instance. Requires the `INVENTORY_PG_TEST_CONN` env var pointing to a writeable PG database. Skipped automatically if not set or if running against the InMemory provider.

**Files:**
- Create: `TravelCrm.Tests/Inventory/HoldConcurrencyTests.cs`

- [ ] **Step 1: Create the test file**

```csharp
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Features.Inventory.Holds.Commands;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Tests.Inventory;

public class HoldConcurrencyTests
{
    /// <summary>
    /// Two parallel CreateHold calls on a single-capacity Asset resource:
    /// exactly one must succeed, the other must fail with a capacity error.
    /// Skips when no real PG connection is configured.
    /// </summary>
    [Fact]
    public async Task CreateHold_TwoParallelCalls_OnlyOneSucceeds()
    {
        var connStr = Environment.GetEnvironmentVariable("INVENTORY_PG_TEST_CONN");
        if (string.IsNullOrWhiteSpace(connStr))
        {
            // Test deliberately requires a real PostgreSQL instance.
            // Set INVENTORY_PG_TEST_CONN to enable it locally.
            return;
        }

        // Build two independent DbContext instances pointing at the same PG database
        var optsA = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(connStr).UseSnakeCaseNamingConvention().Options;
        var optsB = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(connStr).UseSnakeCaseNamingConvention().Options;

        var tenantId = Guid.NewGuid();
        var resourceId = Guid.NewGuid();
        var startDate = new DateOnly(2099, 1, 1);  // far-future, low collision risk

        // Seed
        await using (var seed = new ApplicationDbContext(optsA, NullTenantContext.Instance, NullDataProtector.Instance))
        {
            seed.AssetResources.Add(new AssetResource
            {
                Id = resourceId, TenantId = tenantId, Type = "Vehicle", Name = "TestVehicle",
                Status = ResourceStatus.Active,
            });
            await seed.SaveChangesAsync();
        }

        // Two parallel handlers
        async Task<bool> CreateHold(DbContextOptions<ApplicationDbContext> opts)
        {
            await using var db = new ApplicationDbContext(opts, NullTenantContext.Instance, NullDataProtector.Instance);
            var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
            var handler = new CreateHoldHandler(db, new FakeTenantContext(tenantId), user);
            var r = await handler.Handle(
                new CreateHoldCommand(resourceId, startDate, startDate, null, 1, null), default);
            return r.IsSuccess;
        }

        var resultA = CreateHold(optsA);
        var resultB = CreateHold(optsB);
        await Task.WhenAll(resultA, resultB);

        var successes = (resultA.Result ? 1 : 0) + (resultB.Result ? 1 : 0);
        successes.Should().Be(1, "exactly one of the two parallel holds must succeed");

        // Cleanup
        await using (var clean = new ApplicationDbContext(optsA, NullTenantContext.Instance, NullDataProtector.Instance))
        {
            var holds = clean.ResourceHolds.Where(h => h.ResourceId == resourceId).ToList();
            clean.ResourceHolds.RemoveRange(holds);
            var asset = clean.Resources.Find(resourceId);
            if (asset is not null) clean.Resources.Remove(asset);
            await clean.SaveChangesAsync();
        }
    }
}
```

> The test references `NullTenantContext` and `NullDataProtector` placeholders — these are minimal stubs needed for `ApplicationDbContext` construction outside the DI container. Add them to `TestFakes.cs` if they don't already exist (search the file first; `TestDb.New()` already constructs `ApplicationDbContext` somehow — copy that wiring exactly). If the test cannot be wired without significant test infrastructure work, mark this task as `DONE_WITH_CONCERNS` and report — the unit tests in Tasks 6 + 9 already cover algorithm correctness; this is a bonus race-condition guarantee.

- [ ] **Step 2: Run the test (will skip if env var unset)**

Run: `dotnet test TravelCrm.Tests --filter "FullyQualifiedName~HoldConcurrencyTests" -v minimal`
Expected: 1 passing (or 1 skipped if no PG connection).

To run against real PG locally:
```bash
$env:INVENTORY_PG_TEST_CONN = "Host=localhost;Port=5432;Database=travelcrm;Username=postgres;Password=..."
dotnet test TravelCrm.Tests --filter "FullyQualifiedName~HoldConcurrencyTests" -v minimal
```

- [ ] **Step 3: Commit**

```bash
git add TravelCrm.Tests/Inventory/HoldConcurrencyTests.cs
git commit -m "test(inventory): add PostgreSQL-only HoldConcurrencyTests for FOR UPDATE lock"
```

---

## Task 13: Angular Models + Suppliers Service

**Files:**
- Create: `src/app/models/inventory.model.ts`
- Create: `src/app/core/services/suppliers.service.ts`

> Confirm the `API_BASE_URL` import path matches `src/app/core/services/leads.service.ts`. The base URL is the bare host (e.g. `http://localhost:5044`) — service URLs MUST include `/api/` (the leads service has a long-standing bug omitting it; do NOT replicate).

- [ ] **Step 1: Create `inventory.model.ts`**

```typescript
export type SupplierType = 'Hotel' | 'Transport' | 'Activity' | 'Guide' | 'Other';

export interface SupplierDto {
  id: string;
  name: string;
  supplierType: SupplierType;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  contractValidFrom?: string | null;   // ISO date (DateOnly serialised)
  contractValidTo?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierWriteBody {
  name: string;
  supplierType: SupplierType;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  contractValidFrom?: string | null;
  contractValidTo?: string | null;
}

export interface SupplierUpdateBody extends SupplierWriteBody {
  isActive: boolean;
}
```

- [ ] **Step 2: Create `suppliers.service.ts`**

```typescript
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-base-url.token';
import {
  SupplierDto,
  SupplierWriteBody,
  SupplierUpdateBody,
} from '../../models/inventory.model';

export interface ListSuppliersParams {
  supplierType?: string;
}

@Injectable({ providedIn: 'root' })
export class SuppliersService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly url = `${this.base}/api/inventory/suppliers`;

  list(params?: ListSuppliersParams): Observable<SupplierDto[]> {
    const query: Record<string, string> = {};
    if (params?.supplierType) query['supplierType'] = params.supplierType;
    return this.http.get<SupplierDto[]>(this.url, { params: query });
  }

  get(id: string): Observable<SupplierDto> {
    return this.http.get<SupplierDto>(`${this.url}/${id}`);
  }

  create(body: SupplierWriteBody): Observable<SupplierDto> {
    return this.http.post<SupplierDto>(this.url, body);
  }

  update(id: string, body: SupplierUpdateBody): Observable<SupplierDto> {
    return this.http.put<SupplierDto>(`${this.url}/${id}`, body);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
```

- [ ] **Step 3: Build to verify**

Run: `npx ng build --configuration development`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/models/inventory.model.ts src/app/core/services/suppliers.service.ts
git commit -m "feat(inventory): add Angular Supplier models + HTTP service"
```

---

## Task 14: SupplierListComponent

**Files:**
- Create: `src/app/pages/inventory/suppliers/supplier-list/supplier-list.component.ts`

> Mirrors the Companies / TaskList pattern: `crm-page` layout wrapper, `page-header` with title + "New Supplier" button, KPI strip (4 cards), Material table for the list, error banner via `errorMessage` signal.

- [ ] **Step 1: Create the component**

```typescript
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TablerIconsModule } from 'angular-tabler-icons';
import { SuppliersService } from 'src/app/core/services/suppliers.service';
import { SupplierDto, SupplierType } from 'src/app/models/inventory.model';

@Component({
  selector: 'app-supplier-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, RouterModule,
    MatButtonModule, MatCardModule, MatChipsModule,
    MatFormFieldModule, MatIconModule, MatInputModule,
    MatProgressSpinnerModule, MatSelectModule, MatTableModule, MatTooltipModule,
    TablerIconsModule,
  ],
  template: `
    <div class="crm-page">
      <div class="page-header">
        <div class="page-title">
          <h2>Suppliers</h2>
          <span class="subtitle">Hotels, transport vendors, activity operators, guides</span>
        </div>
        <div class="page-actions">
          <button mat-flat-button color="primary" [routerLink]="['/inventory/suppliers/new']">
            <i-tabler name="plus" class="icon-sm mr-1"></i-tabler> New Supplier
          </button>
        </div>
      </div>

      <div class="kpi-grid">
        <mat-card class="kpi-card">
          <mat-card-content>
            <div class="kpi-inner">
              <div class="kpi-icon" style="background:#e8f0fe">
                <i-tabler name="building" style="color:#1a73e8" class="icon-md"></i-tabler>
              </div>
              <div class="kpi-data">
                <span class="kpi-value">{{ countOf('Hotel') }}</span>
                <span class="kpi-label">Hotels</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="kpi-card">
          <mat-card-content>
            <div class="kpi-inner">
              <div class="kpi-icon" style="background:#fff7e6">
                <i-tabler name="car" style="color:#f59e0b" class="icon-md"></i-tabler>
              </div>
              <div class="kpi-data">
                <span class="kpi-value">{{ countOf('Transport') }}</span>
                <span class="kpi-label">Transport</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="kpi-card">
          <mat-card-content>
            <div class="kpi-inner">
              <div class="kpi-icon" style="background:#dcfce7">
                <i-tabler name="ticket" style="color:#16a34a" class="icon-md"></i-tabler>
              </div>
              <div class="kpi-data">
                <span class="kpi-value">{{ countOf('Activity') }}</span>
                <span class="kpi-label">Activities</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="kpi-card">
          <mat-card-content>
            <div class="kpi-inner">
              <div class="kpi-icon" style="background:#ede9fe">
                <i-tabler name="user-circle" style="color:#7c3aed" class="icon-md"></i-tabler>
              </div>
              <div class="kpi-data">
                <span class="kpi-value">{{ countOf('Guide') }}</span>
                <span class="kpi-label">Guides</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      @if (errorMessage()) {
        <div class="error-banner">
          <i-tabler name="alert-circle" class="icon-sm"></i-tabler>
          {{ errorMessage() }}
        </div>
      }

      <mat-card>
        <mat-card-content class="p-0">
          @if (loading()) {
            <div class="spinner-wrap"><mat-spinner diameter="36"></mat-spinner></div>
          } @else if (suppliers().length === 0) {
            <div class="empty">
              <i-tabler name="building-skyscraper" class="icon-lg"></i-tabler>
              <p>No suppliers yet. Add one to get started.</p>
            </div>
          } @else {
            <table mat-table [dataSource]="suppliers()" class="w-100">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Name</th>
                <td mat-cell *matCellDef="let s">
                  <a [routerLink]="['/inventory/suppliers', s.id]" class="supplier-link">{{ s.name }}</a>
                </td>
              </ng-container>
              <ng-container matColumnDef="type">
                <th mat-header-cell *matHeaderCellDef>Type</th>
                <td mat-cell *matCellDef="let s">
                  <mat-chip [class]="'chip-' + s.supplierType.toLowerCase()">{{ s.supplierType }}</mat-chip>
                </td>
              </ng-container>
              <ng-container matColumnDef="contact">
                <th mat-header-cell *matHeaderCellDef>Contact</th>
                <td mat-cell *matCellDef="let s">
                  {{ s.contactName || '—' }}
                  @if (s.contactEmail) { <small class="d-block text-muted">{{ s.contactEmail }}</small> }
                </td>
              </ng-container>
              <ng-container matColumnDef="active">
                <th mat-header-cell *matHeaderCellDef>Active</th>
                <td mat-cell *matCellDef="let s">
                  @if (s.isActive) {
                    <span class="dot dot-active"></span>
                  } @else {
                    <span class="dot dot-inactive"></span>
                  }
                </td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="actions-col"></th>
                <td mat-cell *matCellDef="let s" class="actions-col">
                  <button mat-icon-button [routerLink]="['/inventory/suppliers', s.id]" matTooltip="Edit">
                    <i-tabler name="pencil" class="icon-sm"></i-tabler>
                  </button>
                  <button mat-icon-button (click)="remove(s)" matTooltip="Delete">
                    <i-tabler name="trash" class="icon-sm"></i-tabler>
                  </button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
            </table>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .crm-page { padding: 24px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .page-title h2 { margin: 0; font-size: 22px; font-weight: 600; }
    .page-title .subtitle { color: #6c757d; font-size: 14px; }
    .page-actions { display: flex; gap: 8px; }
    .mr-1 { margin-right: 4px; }

    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .kpi-card mat-card-content { padding: 16px; }
    .kpi-inner { display: flex; align-items: center; gap: 12px; }
    .kpi-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
    .kpi-data { display: flex; flex-direction: column; }
    .kpi-value { font-size: 24px; font-weight: 700; }
    .kpi-label { font-size: 13px; color: #6c757d; }

    .error-banner {
      display: flex; align-items: center; gap: 8px;
      background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;
      padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 14px;
    }
    .spinner-wrap { display: flex; justify-content: center; padding: 48px; }
    .empty { text-align: center; padding: 48px 24px; color: #94a3b8; }
    .empty i-tabler { color: #cbd5e1; margin-bottom: 12px; }
    .empty p { margin: 0; }

    .supplier-link { color: #4f46e5; text-decoration: none; font-weight: 500; }
    .supplier-link:hover { text-decoration: underline; }
    .actions-col { width: 100px; text-align: right; }
    .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; }
    .dot-active { background: #16a34a; }
    .dot-inactive { background: #94a3b8; }

    .chip-hotel     { background: #dbeafe !important; color: #1e40af !important; }
    .chip-transport { background: #fef3c7 !important; color: #92400e !important; }
    .chip-activity  { background: #dcfce7 !important; color: #15803d !important; }
    .chip-guide     { background: #ede9fe !important; color: #6d28d9 !important; }
    .chip-other     { background: #f1f5f9 !important; color: #475569 !important; }

    @media (max-width: 1100px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 600px) { .kpi-grid { grid-template-columns: 1fr; } }
  `],
})
export class SupplierListComponent implements OnInit {
  private api = inject(SuppliersService);
  private router = inject(Router);

  loading = signal(true);
  suppliers = signal<SupplierDto[]>([]);
  errorMessage = signal<string | null>(null);
  displayedColumns = ['name', 'type', 'contact', 'active', 'actions'];

  ngOnInit(): void { this.reload(); }

  countOf(type: SupplierType): number {
    return this.suppliers().filter(s => s.supplierType === type).length;
  }

  reload(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.api.list().subscribe({
      next: (rows) => { this.suppliers.set(rows); this.loading.set(false); },
      error: (err) => { this.handleApiError(err, 'Failed to load suppliers'); this.loading.set(false); },
    });
  }

  remove(s: SupplierDto): void {
    if (!confirm(`Delete supplier "${s.name}"?`)) return;
    this.errorMessage.set(null);
    this.api.delete(s.id).subscribe({
      next: () => this.reload(),
      error: (err) => this.handleApiError(err, 'Failed to delete supplier'),
    });
  }

  private handleApiError(err: any, fallback: string): void {
    const serverMsg = err?.error?.error as string | undefined;
    if (err?.status === 401) {
      this.errorMessage.set('Your session expired. Please log out and sign in again.');
    } else if (serverMsg?.toLowerCase().includes('tenant')) {
      this.errorMessage.set('Suppliers are tenant-scoped. Platform Admin accounts cannot manage them — please sign in as a tenant user.');
    } else if (err?.status === 403) {
      this.errorMessage.set('You don\'t have permission to manage suppliers.');
    } else if (err?.status === 409) {
      this.errorMessage.set(serverMsg ?? 'Supplier is in use by existing resources and cannot be deleted.');
    } else {
      this.errorMessage.set(serverMsg ?? fallback);
    }
  }
}
```

- [ ] **Step 2: Build**

Run: `npx ng build --configuration development`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/inventory/suppliers/supplier-list/
git commit -m "feat(inventory): add SupplierListComponent with KPI cards and table"
```

---

## Task 15: SupplierFormComponent

**Files:**
- Create: `src/app/pages/inventory/suppliers/supplier-form/supplier-form.component.ts`

- [ ] **Step 1: Create the component**

```typescript
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TablerIconsModule } from 'angular-tabler-icons';
import { SuppliersService } from 'src/app/core/services/suppliers.service';
import { SupplierType, SupplierWriteBody, SupplierUpdateBody } from 'src/app/models/inventory.model';

@Component({
  selector: 'app-supplier-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule, RouterModule,
    MatButtonModule, MatCardModule, MatDatepickerModule, MatNativeDateModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule,
    MatSelectModule, MatSlideToggleModule, TablerIconsModule,
  ],
  template: `
    <div class="crm-page">
      <div class="page-header">
        <div class="page-title">
          <h2>{{ isEdit() ? 'Edit Supplier' : 'New Supplier' }}</h2>
          <span class="subtitle">
            {{ isEdit() ? 'Update supplier details and contract dates' : 'Register a new vendor (hotel, transport, activity, guide)' }}
          </span>
        </div>
        <div class="page-actions">
          <button mat-stroked-button (click)="cancel()">
            <i-tabler name="arrow-left" class="icon-sm mr-1"></i-tabler> Back
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="spinner-wrap"><mat-spinner diameter="36"></mat-spinner></div>
      } @else {
        <mat-card class="form-card">
          <mat-card-content>
            <form [formGroup]="form" (ngSubmit)="save()" class="supplier-form">
              <div class="form-row">
                <mat-form-field appearance="outline" class="flex-2">
                  <mat-label>Name</mat-label>
                  <input matInput formControlName="name" maxlength="200" placeholder="e.g. Taj Hotels" />
                  @if (form.controls.name.touched && form.controls.name.invalid) {
                    <mat-error>Name is required</mat-error>
                  }
                </mat-form-field>
                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>Type</mat-label>
                  <mat-select formControlName="supplierType">
                    <mat-option value="Hotel">Hotel</mat-option>
                    <mat-option value="Transport">Transport</mat-option>
                    <mat-option value="Activity">Activity</mat-option>
                    <mat-option value="Guide">Guide</mat-option>
                    <mat-option value="Other">Other</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              <h4 class="section-h">Contact</h4>
              <div class="form-row">
                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>Contact Name</mat-label>
                  <input matInput formControlName="contactName" maxlength="200" />
                </mat-form-field>
                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>Email</mat-label>
                  <input matInput type="email" formControlName="contactEmail" maxlength="200" />
                </mat-form-field>
                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>Phone</mat-label>
                  <input matInput formControlName="contactPhone" maxlength="50" />
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline" class="full">
                <mat-label>Address</mat-label>
                <textarea matInput formControlName="address" rows="3" maxlength="1000"></textarea>
              </mat-form-field>

              <h4 class="section-h">Contract</h4>
              <div class="form-row">
                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>Valid From</mat-label>
                  <input matInput [matDatepicker]="fromPicker" formControlName="contractValidFrom" />
                  <mat-datepicker-toggle matSuffix [for]="fromPicker"></mat-datepicker-toggle>
                  <mat-datepicker #fromPicker></mat-datepicker>
                </mat-form-field>
                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>Valid To</mat-label>
                  <input matInput [matDatepicker]="toPicker" formControlName="contractValidTo" />
                  <mat-datepicker-toggle matSuffix [for]="toPicker"></mat-datepicker-toggle>
                  <mat-datepicker #toPicker></mat-datepicker>
                </mat-form-field>
              </div>

              @if (isEdit()) {
                <div class="active-row">
                  <mat-slide-toggle formControlName="isActive">Active</mat-slide-toggle>
                  <span class="hint">Inactive suppliers are hidden from new resource creation but existing resources keep working.</span>
                </div>
              }

              @if (errorMessage()) {
                <div class="error-banner">
                  <i-tabler name="alert-circle" class="icon-sm"></i-tabler>
                  {{ errorMessage() }}
                </div>
              }

              <div class="form-actions">
                <button mat-button type="button" (click)="cancel()">Cancel</button>
                <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving()">
                  @if (saving()) {
                    <mat-spinner diameter="16" class="btn-spinner"></mat-spinner>
                  } @else {
                    <i-tabler [name]="isEdit() ? 'check' : 'plus'" class="icon-sm mr-1"></i-tabler>
                  }
                  {{ isEdit() ? 'Save Changes' : 'Create Supplier' }}
                </button>
              </div>
            </form>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .crm-page { padding: 24px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .page-title h2 { margin: 0; font-size: 22px; font-weight: 600; }
    .page-title .subtitle { color: #6c757d; font-size: 14px; }
    .page-actions { display: flex; gap: 8px; }
    .mr-1 { margin-right: 4px; }
    .spinner-wrap { display: flex; justify-content: center; padding: 48px; }

    .form-card { max-width: 900px; }
    .form-card mat-card-content { padding: 24px; }
    .supplier-form { display: flex; flex-direction: column; gap: 0; }
    .supplier-form .full { width: 100%; }
    .form-row { display: flex; gap: 16px; }
    .form-row .flex-1 { flex: 1; }
    .form-row .flex-2 { flex: 2; }
    .section-h { margin: 16px 0 12px; font-size: 13px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.4px; }

    .active-row { display: flex; align-items: center; gap: 12px; margin: 8px 0 16px; }
    .active-row .hint { color: #64748b; font-size: 12px; }

    .error-banner {
      display: flex; align-items: center; gap: 8px;
      background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;
      padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 13px;
    }

    .form-actions {
      display: flex; justify-content: flex-end; gap: 8px;
      margin-top: 8px; padding-top: 16px; border-top: 1px solid #f1f5f9;
    }
    .btn-spinner { display: inline-block; margin-right: 8px; }

    @media (max-width: 600px) { .form-row { flex-direction: column; } }
  `],
})
export class SupplierFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(SuppliersService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  loading = signal(true);
  saving = signal(false);
  errorMessage = signal<string | null>(null);
  supplierId = signal<string | null>(null);
  isEdit = signal(false);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    supplierType: ['Hotel' as SupplierType, Validators.required],
    contactName: [null as string | null],
    contactEmail: [null as string | null],
    contactPhone: [null as string | null],
    address: [null as string | null],
    contractValidFrom: [null as Date | null],
    contractValidTo: [null as Date | null],
    isActive: [true],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.supplierId.set(id);
      this.isEdit.set(true);
      this.api.get(id).subscribe({
        next: (s) => {
          this.form.patchValue({
            name: s.name,
            supplierType: s.supplierType,
            contactName: s.contactName ?? null,
            contactEmail: s.contactEmail ?? null,
            contactPhone: s.contactPhone ?? null,
            address: s.address ?? null,
            contractValidFrom: s.contractValidFrom ? new Date(s.contractValidFrom) : null,
            contractValidTo: s.contractValidTo ? new Date(s.contractValidTo) : null,
            isActive: s.isActive,
          });
          this.loading.set(false);
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.error ?? 'Failed to load supplier');
          this.loading.set(false);
        },
      });
    } else {
      this.loading.set(false);
    }
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.errorMessage.set(null);

    const v = this.form.getRawValue();
    const baseBody: SupplierWriteBody = {
      name: v.name,
      supplierType: v.supplierType,
      contactName: v.contactName,
      contactEmail: v.contactEmail,
      contactPhone: v.contactPhone,
      address: v.address,
      contractValidFrom: v.contractValidFrom ? this.toIsoDate(v.contractValidFrom) : null,
      contractValidTo: v.contractValidTo ? this.toIsoDate(v.contractValidTo) : null,
    };

    const op$ = this.isEdit()
      ? this.api.update(this.supplierId()!, { ...baseBody, isActive: v.isActive } as SupplierUpdateBody)
      : this.api.create(baseBody);

    op$.subscribe({
      next: () => this.router.navigate(['/inventory/suppliers']),
      error: (err) => {
        this.errorMessage.set(err?.error?.error ?? 'Save failed');
        this.saving.set(false);
      },
    });
  }

  cancel(): void { this.router.navigate(['/inventory/suppliers']); }

  /** Convert a Date to ISO yyyy-MM-dd (DateOnly serialisation expected by the backend). */
  private toIsoDate(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
```

- [ ] **Step 2: Build**

Run: `npx ng build --configuration development`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/inventory/suppliers/supplier-form/
git commit -m "feat(inventory): add SupplierFormComponent for create + edit"
```

---

## Task 16: Inventory Routes Module

**Files:**
- Create: `src/app/pages/inventory/inventory.routes.ts`
- Modify: `src/app/app.routes.ts` (register `inventory` lazy children)

- [ ] **Step 1: Create `inventory.routes.ts`**

```typescript
import { Routes } from '@angular/router';

export const InventoryRoutes: Routes = [
  {
    path: 'suppliers',
    loadComponent: () =>
      import('./suppliers/supplier-list/supplier-list.component').then((m) => m.SupplierListComponent),
    data: { title: 'Suppliers' },
  },
  {
    path: 'suppliers/new',
    loadComponent: () =>
      import('./suppliers/supplier-form/supplier-form.component').then((m) => m.SupplierFormComponent),
    data: { title: 'New Supplier' },
  },
  {
    path: 'suppliers/:id',
    loadComponent: () =>
      import('./suppliers/supplier-form/supplier-form.component').then((m) => m.SupplierFormComponent),
    data: { title: 'Edit Supplier' },
  },
  { path: '', redirectTo: 'suppliers', pathMatch: 'full' },
];
```

> Note: `suppliers/new` declared **before** `suppliers/:id` so the literal "new" isn't captured as a route param.

- [ ] **Step 2: Register in `app.routes.ts`**

In `src/app/app.routes.ts`, find the existing top-level lazy children inside the `FullComponent` `children: [...]` array (e.g. `path: 'apps'`, `path: 'crm'`, `path: 'settings'`). Add:

```typescript
{
  path: 'inventory',
  loadChildren: () =>
    import('./pages/inventory/inventory.routes').then((m) => m.InventoryRoutes),
},
```

- [ ] **Step 3: Build**

Run: `npx ng build --configuration development`
Expected: succeeds. Visit `http://localhost:4200/inventory/suppliers` once frontend hot-reloads — should render the empty state (no suppliers yet).

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/inventory/inventory.routes.ts \
        src/app/app.routes.ts
git commit -m "feat(inventory): register inventory route group with suppliers children"
```

---

## Task 17: Sidebar + Icon-Strip Wiring

**Files:**
- Modify: `src/app/layouts/full/vertical/sidebar/sidebar-data.ts` (add Inventory navCap + Suppliers entry)
- Modify: `src/app/layouts/full/vertical/sidebar/icon-menu/iconmenu-data.ts` (add id: 11 Inventory icon)
- Modify: `src/app/layouts/full/horizontal/sidebar/sidebar-data.ts` (mirror, if it exists in this layout — check first)

- [ ] **Step 1: Add Inventory section to vertical sidebar**

In `src/app/layouts/full/vertical/sidebar/sidebar-data.ts`, find the `// ─── Travel ───` block (Bookings / Packages / Destinations / Suppliers). Insert a new `// ─── Inventory ───` block just before `// ─── Customers ───`:

```typescript
// ─── Inventory ───────────────────────────────────────────────────────────
{
  navCap: 'Inventory',
},
{
  id: 11,
  displayName: 'Suppliers',
  iconName: 'solar:case-line-duotone',
  route: '/inventory/suppliers',
},
```

> The id `11` is a new icon-strip entry — see Step 2.

- [ ] **Step 2: Add the Inventory icon to the icon strip**

In `src/app/layouts/full/vertical/sidebar/icon-menu/iconmenu-data.ts`, append after the existing `id: 10` entry:

```typescript
{
  id: 11,
  title: 'Inventory',
  iconName: 'solar:case-line-duotone',
},
```

The strip must end with `];` — preserve the closing bracket.

- [ ] **Step 3: Mirror in horizontal sidebar (if applicable)**

Run: `ls src/app/layouts/full/horizontal/sidebar/sidebar-data.ts`. If the file exists, find the equivalent Travel section and add the same Inventory entry mirrored. If the file doesn't exist, skip this step.

- [ ] **Step 4: Build + smoke-test**

```bash
npx ng build --configuration development
```

Then in the browser, hover the icon strip — the new "Inventory" icon should appear at position 11. Clicking it opens the sidebar with "Suppliers" as a child entry that navigates to `/inventory/suppliers`.

- [ ] **Step 5: Commit**

```bash
git add src/app/layouts/full/vertical/sidebar/sidebar-data.ts \
        src/app/layouts/full/vertical/sidebar/icon-menu/iconmenu-data.ts
# include horizontal sidebar only if you modified it
git commit -m "feat(inventory): wire Inventory section + icon-strip entry in sidebar"
```

---

## Task 18: Apps Mega-Menu Entry (tenant-only)

**Files:**
- Modify: `src/app/layouts/full/vertical/header/header.component.ts` (add Suppliers to `apps[]`)
- Modify: `src/app/layouts/full/horizontal/header/header.component.ts` (same)

> The mega-menu has a `visibleApps()` computed that filters `tenantOnly: true` entries when the current user is a Platform Admin. Just append a new entry; the filter handles the rest.

- [ ] **Step 1: Modify vertical header `apps[]`**

In `src/app/layouts/full/vertical/header/header.component.ts`, find the `apps: apps[] = [` array (begins around line 195 with the Task Management entry that was added earlier). Append a new entry — `tenantOnly: true` because Platform Admins can't manage tenant inventory:

```typescript
{
  id: 11,
  icon: 'solar:case-line-duotone',
  color: 'success',
  title: 'Suppliers',
  subtitle: 'Hotels, vehicles, guides',
  link: '/inventory/suppliers',
  tenantOnly: true,
},
```

- [ ] **Step 2: Mirror in horizontal header**

In `src/app/layouts/full/horizontal/header/header.component.ts`, find the same `apps[]` array and append the same entry.

- [ ] **Step 3: Build**

Run: `npx ng build --configuration development`
Expected: succeeds.

- [ ] **Step 4: Smoke-test in browser**

Refresh, then click the apps icon in the top header (the 9-dot grid). Tenant users should see the new "Suppliers" tile linking to `/inventory/suppliers`. Sign in as Platform Admin — the tile is filtered out.

- [ ] **Step 5: Commit**

```bash
git add src/app/layouts/full/vertical/header/header.component.ts \
        src/app/layouts/full/horizontal/header/header.component.ts
git commit -m "feat(inventory): add Suppliers entry to apps mega-menu (tenant-only)"
```

---

## Final Verification Checklist

After all 18 tasks land, run:

- [ ] **All backend tests pass**

Run: `dotnet test TravelCrm.Tests -v minimal`
Expected: 78 (existing) + ~40 (new inventory) = ~118 tests, all passing.

- [ ] **Backend builds clean**

Run: `dotnet build TravelCrm.Api`
Expected: 0 errors, 2 pre-existing CS9113 warnings (unrelated).

- [ ] **Angular builds clean**

Run: `npx ng build --configuration production`
Expected: succeeds.

- [ ] **Hangfire dashboard shows the recurring job**

Open `http://localhost:5044/hangfire` → Recurring Jobs → `hold-expiry-sweep` should be listed with cron `*/5 * * * *`.

- [ ] **End-to-end smoke**

1. Sign in as a tenant `admin` user (e.g. `admin@demo.com`).
2. Open `/inventory/suppliers` — empty state renders.
3. Create a supplier (Type: Hotel, Name: "Test Hotel"). Verify it appears in the list with the right chip color.
4. Edit the supplier, toggle Active off, save. Verify the dot turns grey.
5. Try to delete a supplier that has a resource attached — expect a friendly "in use" error.
6. Hit `POST /api/inventory/resources` (via Postman or curl) with a supplier_id from step 3 + a Pool resource — verify it persists.
7. Hit `POST /api/inventory/holds` to create a hold — verify HoldStatus = "Held" with `expiresAt` 24h out.
8. Wait or manually trigger `hold-expiry-sweep` from the Hangfire dashboard — verify Held holds with past `expires_at` flip to Expired.

---

## Permissions Reminder

The 8 new `inventory.*` slugs are seeded into `PermissionCatalog` and assigned to `admin` / `manager` / `readonly` roles in Task 3. If existing JWTs were issued before this seed runs, users must **sign out and sign back in** to pick up the new permission claims. Otherwise every API call will return 403.

---

## Out of Scope (Reminder)

These are deliberately deferred to later sub-projects:
- **Pricing** — `IResourcePricing` interface ships with `NullResourcePricing` only; future Hotel / Vehicle modules implement specific strategies.
- **Multi-source allotments** — Hotel sub-project will add an `Allotment` entity.
- **Hourly / time-window scheduling** — Day + Morning/Afternoon/Evening only.
- **Resources / Calendar / Holds admin UI** — Backend-only at foundation; consuming sub-projects ship typed UI.
- **Multi-currency, multi-branch, AI pricing, WhatsApp, real-time supplier sync, dynamic pricing engine** — Each its own future enhancement.
