# Inventory Foundation — Design Spec

**Date:** 2026-04-27
**Project:** TravelCRMPlus
**Scope:** Sub-project 1 of 8 in the Inventory Management roadmap. Covers the generic resource + supplier + calendar + hold engine that downstream sub-projects (Hotel, Vehicle, Driver, Guide, Activity) build on.

---

## Overview

A central **bookable-resource engine** for tenants. Hotels, room types, vehicles, drivers, guides, and activity slots will all be modelled as `Resource`s with a shared availability calendar and a two-stage hold (soft-reservation → confirmation) lifecycle. This sub-project ships only the generic foundation — no resource-type-specific UI, no pricing implementations, no booking-flow integration. Future sub-projects extend it.

### What this sub-project delivers
- Backend: 5 entities (`Supplier`, `Resource` with TPH `PoolResource` / `AssetResource`, `ResourceCalendar`, `ResourceHold`); CQRS handlers for full Supplier/Resource/Calendar/Hold management; `IResourcePricing` strategy interface; Hangfire `HoldExpirySweepJob`.
- Frontend: minimal — Suppliers CRUD page only. Resources/Calendar/Holds UI is owned by future resource-type sub-projects.
- Permissions: 8 new slugs seeded into the permission catalog and assigned to default roles.

### What this sub-project does NOT deliver
- Pricing (interface defined; no implementations)
- Multi-source allotments (deferred to Hotel sub-project)
- Hourly / time-window scheduling (day + slot only)
- Resources / Calendar / Holds UI (each consuming sub-project ships its own)
- Real-time push, multi-currency, multi-branch, AI features

---

## Section 1 — Data Model

All entities live in `TravelCrm.Api/Domain/Entities/Inventory/`.

### `Supplier`

| Column | Type | Notes |
|---|---|---|
| `Id` | `Guid` | PK |
| `TenantId` | `Guid` | Required (BaseEntity) |
| `Name` | `string` (200) | e.g. "Taj Hotels" |
| `SupplierType` | `SupplierType` enum (int) | `Hotel = 0`, `Transport = 1`, `Activity = 2`, `Guide = 3`, `Other = 4` |
| `ContactName` | `string?` (200) | |
| `ContactEmail` | `string?` (200) | |
| `ContactPhone` | `string?` (50) | |
| `Address` | `string?` (1000) | |
| `ContractValidFrom` | `DateOnly?` | |
| `ContractValidTo` | `DateOnly?` | |
| `IsActive` | `bool` | Default `true`; soft-disable instead of delete |
| (BaseEntity audit fields) | | `CreatedAt`, `UpdatedAt`, `CreatedBy`, `UpdatedBy` |

Table: `suppliers`. Unique index on `(TenantId, Name)`.

### `Resource` — abstract, TPH discrimination

| Column | Type | Notes |
|---|---|---|
| `Id` | `Guid` | PK |
| `TenantId` | `Guid` | Required |
| `Kind` | `ResourceKind` enum (int) | `Pool = 0`, `Asset = 1` (TPH discriminator) |
| `Type` | `string` (50) | Free-form slug — `Hotel`, `RoomType`, `Vehicle`, `Driver`, `Guide`, `ActivitySlot`. Sub-modules add their own values. |
| `Name` | `string` (200) | Required |
| `SupplierId` | `Guid?` | FK → `Supplier`, nullable. Null = tenant-owned. `OnDelete(DeleteBehavior.SetNull)`. |
| `Status` | `ResourceStatus` enum (int) | `Active = 0`, `Inactive = 1`, `Maintenance = 2`, `Blocked = 3` |
| `Metadata` | `jsonb` | Module-specific fields (room amenities, vehicle reg, license number) — typed via DTOs at the consuming module layer; foundation treats it as opaque |
| (BaseEntity audit fields) | | |

Table: `resources` (single table for both PoolResource and AssetResource via TPH on `Kind`).

Indexes:
- `(TenantId, Type, Status)` — primary list-by-type query
- `(TenantId, SupplierId)` — supplier drill-down

### `PoolResource` extends `Resource`

| Extra column | Type | Notes |
|---|---|---|
| `DefaultCapacity` | `int` | Required. Used as the available capacity for any date that has no `ResourceCalendar` row. e.g. 10 Deluxe rooms by default; 30 morning-slot tickets. |

### `AssetResource` extends `Resource`

| Extra column | Type | Notes |
|---|---|---|
| `AssetCode` | `string?` (100) | Vehicle registration, employee code, etc. — for human reference. NOT unique-constrained globally; tenants may reuse. |

In the `resources` table, `default_capacity` and `asset_code` are both nullable; EF populates exactly one per row based on `Kind`.

### `ResourceCalendar` — sparse capacity / block overrides

| Column | Type | Notes |
|---|---|---|
| `Id` | `Guid` | PK |
| `TenantId` | `Guid` | Required |
| `ResourceId` | `Guid` | FK → `Resource`, `OnDelete(DeleteBehavior.Cascade)` |
| `Date` | `DateOnly` | |
| `Slot` | `ResourceCalendarSlot?` enum (int?) | `null` = whole day, `Morning = 0`, `Afternoon = 1`, `Evening = 2` |
| `Capacity` | `int` | For pool: overrides `DefaultCapacity` for this date+slot. For asset: 0 or 1 (0 = effectively blocked; redundant with `IsBlocked` but allowed). |
| `IsBlocked` | `bool` | "Stop sale" / "On leave" / "In maintenance" — explicit block regardless of capacity. Default `false`. |
| `Notes` | `string?` (500) | |
| `RowVersion` | `uint` (PG `xmin`) | EF concurrency token |
| (BaseEntity audit fields) | | |

Table: `resource_calendar`. Unique index on `(TenantId, ResourceId, Date, Slot)` — prevents duplicate buckets.

**Sparse storage:** Foundation only inserts a row when capacity differs from `DefaultCapacity` or the bucket is explicitly blocked. A 200-room hotel with 365 days of default availability creates **zero** rows here.

### `ResourceHold` — soft + firm reservations

| Column | Type | Notes |
|---|---|---|
| `Id` | `Guid` | PK |
| `TenantId` | `Guid` | Required |
| `ResourceId` | `Guid` | FK → `Resource`, `OnDelete(DeleteBehavior.Restrict)` (preserve hold history if resource is hard-deleted) |
| `StartDate` | `DateOnly` | Inclusive |
| `EndDate` | `DateOnly` | Inclusive (single-day hold has `Start == End`) |
| `Slot` | `ResourceCalendarSlot?` enum | Same enum as Calendar |
| `Quantity` | `int` | Default 1. For pool: number of units (e.g. "hold 2 Deluxe rooms for 3 nights" = `Quantity=2`). For asset: must be 1. |
| `Status` | `ResourceHoldStatus` enum (int) | `Held = 0`, `Confirmed = 1`, `Released = 2`, `Expired = 3` |
| `ExpiresAt` | `DateTime?` | UTC. Non-null only when `Status = Held`. |
| `BookingRef` | `string?` (100) | Set by the future Booking module when the hold is attached to a booking. |
| `HeldByUserId` | `Guid` | Required. The user who created the hold. |
| `Notes` | `string?` (500) | |
| `ExtensionCount` | `int` | Default 0. Caps at 3 (see Hold lifecycle below). |
| (BaseEntity audit fields) | | |

Table: `resource_holds`. Indexes:
- `(TenantId, ResourceId, StartDate, EndDate)` — overlap query for availability calculation
- `(Status, ExpiresAt)` — sweeper job filter

---

## Section 2 — Architecture & Layering

### Folder layout

```
TravelCrm.Api/
  Domain/Entities/Inventory/
    Supplier.cs
    SupplierType.cs                 (enum)
    Resource.cs                     (abstract)
    ResourceKind.cs                 (enum)
    ResourceStatus.cs               (enum)
    PoolResource.cs                 (: Resource)
    AssetResource.cs                (: Resource)
    ResourceCalendar.cs
    ResourceCalendarSlot.cs         (enum)
    ResourceHold.cs
    ResourceHoldStatus.cs           (enum)

  Features/Inventory/
    Suppliers/
      SupplierDto.cs                (record + mapper)
      Commands/{Create,Update,Delete}SupplierCommand.cs
      Queries/{List,Get}SupplierQuery.cs
      SuppliersController.cs        ([Route("api/inventory/suppliers")])

    Resources/
      ResourceDto.cs
      Commands/{Create,Update,Block,Unblock}ResourceCommand.cs
      Queries/{List,Get}ResourceQuery.cs
      ResourcesController.cs        ([Route("api/inventory/resources")])

    Calendar/
      AvailabilityDto.cs            (record per (date, slot) with available + total + blocked)
      Commands/{SetCapacity,BlockDate,UnblockDate}CalendarCommand.cs
      Queries/CheckAvailabilityQuery.cs
      CalendarController.cs         ([Route("api/inventory/resources/{resourceId:guid}/calendar")])

    Holds/
      HoldDto.cs
      Commands/{CreateHold,ConfirmHold,ReleaseHold,ExtendHold}Command.cs
      Queries/{ListHolds,GetHold}Query.cs
      HoldsController.cs            ([Route("api/inventory/holds")])
      IResourcePricing.cs           (strategy interface)
      NullResourcePricing.cs        (default impl returning 0)

  Infrastructure/Jobs/
    HoldExpirySweepJob.cs           (Hangfire recurring; 5-minute interval)

  Infrastructure/Persistence/
    ApplicationDbContext.cs         (modify — add 5 DbSets + TPH config + indexes)
    Migrations/<ts>_AddInventoryFoundation.cs

src/app/                                                 (Angular frontend)
  models/
    supplier.model.ts                                    (TS interfaces)
  core/services/
    suppliers.service.ts                                 (HTTP service)
  pages/inventory/
    suppliers/
      supplier-list/supplier-list.component.ts
      supplier-form/supplier-form.component.ts
    inventory.routes.ts                                  (lazy children: suppliers/*)
  app.routes.ts                                          (modify — register inventory route group)
  layouts/full/vertical/sidebar/sidebar-data.ts          (modify — add Inventory section + Suppliers entry)

TravelCrm.Tests/Inventory/
  SupplierHandlersTests.cs
  ResourceHandlersTests.cs
  CalendarHandlersTests.cs
  HoldHandlersTests.cs
  AvailabilityCalculationTests.cs                        (table-driven, critical)
  HoldExpirySweepJobTests.cs
  HoldConcurrencyTests.cs                                (PostgreSQL-only; skip on InMemory)
```

### Layering rules

```
┌──────────────────────────────────────────────────────┐
│  Future modules (Hotel, Driver, Vehicle, Guide, …)   │
│  — own typed pricing, own DTOs, own UI               │
│  — depend on Inventory (one-way)                     │
└──────────────────────┬───────────────────────────────┘
                       │ depends on ↓
┌──────────────────────┴───────────────────────────────┐
│  Inventory Foundation                                │
│  — Supplier, Resource, Calendar, Hold                │
│  — generic; knows nothing about hotels/drivers       │
│  — exposes IResourcePricing strategy + holds API     │
└──────────────────────────────────────────────────────┘
```

**Hard rule:** `TravelCrm.Api/Features/Inventory/**` may NOT reference any other `Features/*` folder. Sub-modules depend on Inventory; Inventory does not depend on them. Enforced by code review; can be enforced by an architecture test later.

### `IResourcePricing` strategy interface

```csharp
namespace TravelCrm.Api.Features.Inventory.Holds;

public interface IResourcePricing
{
    /// <summary>Resource type slug this strategy handles ("Hotel", "Vehicle", ...).</summary>
    string ResourceType { get; }

    /// <summary>Compute total cost for a hold on a given date range.</summary>
    Task<decimal> CalculatePriceAsync(
        Guid resourceId,
        DateOnly start,
        DateOnly end,
        ResourceCalendarSlot? slot,
        int quantity,
        CancellationToken ct);
}

public sealed class NullResourcePricing : IResourcePricing
{
    public string ResourceType => "*";
    public Task<decimal> CalculatePriceAsync(
        Guid _, DateOnly __, DateOnly ___,
        ResourceCalendarSlot? ____, int _____, CancellationToken ______)
        => Task.FromResult(0m);
}
```

DI: foundation registers `NullResourcePricing` as the fallback. Future modules add their own implementations:

```csharp
services.AddScoped<IResourcePricing, HotelSeasonalPricing>();
services.AddScoped<IResourcePricing, VehiclePerKmPricing>();
```

The hold flow resolves `IEnumerable<IResourcePricing>` and picks the strategy where `ResourceType == resource.Type`, falling back to `NullResourcePricing` if none matches.

### Discriminator strategy: TPH

Single `resources` table, EF discriminator on `kind`. `default_capacity` nullable (Pool only); `asset_code` nullable (Asset only). Rejected TPT because the foundation queries always filter `(TenantId, Type, Status)` first — TPH avoids a join on every list call.

---

## Section 3 — Hold Lifecycle & Concurrency

### State machine

```
                     ┌──────────────┐
   POST /holds ─────▶│    Held      │──── ConfirmHold ───▶┌──────────────┐
                     │ expiresAt=T  │                     │  Confirmed   │
                     └──────┬───────┘                     │ expiresAt=∅  │
                            │                             └──────┬───────┘
                            │ ReleaseHold                        │
                            │ or Hangfire                        │ ReleaseHold
                            │ sweep when                         │ (cancel)
                            │ now > T                            │
                            ▼                                    ▼
                     ┌──────────────┐                     ┌──────────────┐
                     │   Expired    │                     │   Released   │
                     │  (terminal)  │                     │  (terminal)  │
                     └──────────────┘                     └──────────────┘
```

Transitions:
- **Held → Confirmed:** allowed if `Status == Held` AND `now < ExpiresAt`. Sets `ExpiresAt = null`, sets `BookingRef` (if provided).
- **Held / Confirmed → Released:** explicit cancellation. `Notes` may record reason.
- **Held → Expired:** sweeper job only. Never via API.
- **Held → Held (Extend):** `ExpiresAt` += `HoldTtlHours`; `ExtensionCount += 1`. Rejected if `ExtensionCount >= 3`.
- Terminal states (`Released`, `Expired`) cannot transition further. Any operation on them returns 409 Conflict.

### Hold TTL configuration

A new column `tenant_settings.hold_ttl_hours int not null default 24`. The `tenant_settings` table is created by this migration if not already present (currently it does not exist). Read on every `CreateHold`. Future sub-projects add their own columns to this table.

### Availability calculation algorithm

```
For each date D in [StartDate..EndDate] (inclusive):
  cal = ResourceCalendar.SingleOrDefault(r=resource, d=D, s=requestedSlot)
  capacity =
    cal?.Capacity
    ?? (resource is PoolResource p ? p.DefaultCapacity : 1)   // asset = 1
  if cal?.IsBlocked == true:
    REJECT  → "Date D is blocked"

  // Slot collision rule: whole-day (null) collides with everything;
  // a specific slot collides with the same slot OR with whole-day.
  occupied = SUM(Quantity) FROM ResourceHolds WHERE
    ResourceId = resource AND
    (existing.Slot IS NULL OR requestedSlot IS NULL OR existing.Slot = requestedSlot) AND
    Status IN (Held, Confirmed) AND
    StartDate <= D AND EndDate >= D

  if occupied + requestedQuantity > capacity:
    REJECT → "Date D exceeds capacity (have N, requesting M)"
COMMIT hold
```

The handler returns the *first* failing date in the error message so the UI can highlight it.

**Slot matching rule:** A hold with `Slot = null` (whole-day) collides with holds at any slot on the same date. A hold with `Slot = Morning` only collides with `Slot = Morning` and whole-day holds — `Afternoon` and `Evening` holds do not interact.

### Concurrency — `SELECT … FOR UPDATE` on the Resource row

Inside `CreateHoldHandler`:

```csharp
await using var tx = await db.Database
    .BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

await db.Database.ExecuteSqlRawAsync(
    "SELECT 1 FROM resources WHERE id = {0} FOR UPDATE",
    new object[] { resourceId }, ct);

// availability check + insert hold inside the locked region
// ...

await tx.CommitAsync(ct);
```

Result: holds against a single resource serialise; holds against different resources run in parallel. A 200-room hotel with 50 distinct room types gets 50-way concurrency. Single hot resources serialise — correct trade-off.

PostgreSQL only. The InMemory provider used by unit tests does not honour `FOR UPDATE`; the integration test `HoldConcurrencyTests` runs against a real PG instance and is skipped when the configured provider is InMemory.

### `HoldExpirySweepJob` (Hangfire recurring)

```csharp
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

        foreach (var h in expired)
        {
            h.Status = ResourceHoldStatus.Expired;
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation(
            "HoldExpirySweep: expired {Count} holds", expired.Count);
    }
}
```

Registered in `RecurringJobRegistrar.RegisterAll`:

```csharp
jobs.AddOrUpdate<HoldExpirySweepJob>(
    "hold-expiry-sweep",
    j => j.ExecuteAsync(CancellationToken.None),
    Cron.MinuteInterval(5));
```

### Edge cases handled

| Case | Behaviour |
|---|---|
| Hold spans a blocked date in the middle | Rejected; full range must be unblocked. |
| Resource set to `Status = Inactive` while Confirmed holds exist | Existing Confirmed holds remain valid; new holds rejected with "Resource not active". |
| Tenant changes `HoldTtlHours` mid-flight | Affects new holds only; existing `ExpiresAt` values frozen. |
| `Quantity > capacity` on creation | Rejected immediately with first-failing-date in message. |
| `Quantity` set on an Asset resource | Rejected at validation: "Asset resources must use Quantity = 1". |
| `ExtendHold` on terminal status | 409 Conflict. |
| `ExtendHold` after 3 extensions | 409 Conflict with "extension limit reached". |
| `ConfirmHold` after `ExpiresAt` passed but before sweeper runs | 410 Gone with "hold expired". |

---

## Section 4 — Public API Contract

All routes require authentication. Permission checks are in handlers.

### Suppliers — `/api/inventory/suppliers`

| Method | Route | Permission | Status codes |
|---|---|---|---|
| GET | `/` | `inventory.suppliers.view` | 200 |
| GET | `/{id:guid}` | `inventory.suppliers.view` | 200 / 404 |
| POST | `/` | `inventory.suppliers.manage` | 201 / 400 |
| PUT | `/{id:guid}` | `inventory.suppliers.manage` | 200 / 404 / 400 |
| DELETE | `/{id:guid}` | `inventory.suppliers.manage` | 204 / 404 / 409 (in-use by resources) |

### Resources — `/api/inventory/resources`

| Method | Route | Permission | Status codes |
|---|---|---|---|
| GET | `/?type=&status=&supplierId=` | `inventory.resources.view` | 200 |
| GET | `/{id:guid}` | `inventory.resources.view` | 200 / 404 |
| POST | `/` | `inventory.resources.manage` | 201 / 400 |
| PUT | `/{id:guid}` | `inventory.resources.manage` | 200 / 404 / 400 |
| POST | `/{id:guid}/block` | `inventory.resources.manage` | 200 / 404 |
| POST | `/{id:guid}/unblock` | `inventory.resources.manage` | 200 / 404 |

### Calendar — `/api/inventory/resources/{resourceId:guid}/calendar`

| Method | Route | Permission | Status codes |
|---|---|---|---|
| GET | `/?from=&to=` | `inventory.calendar.view` | 200 — returns `AvailabilityDto[]` (one per date+slot in range) |
| POST | `/capacity` | `inventory.calendar.manage` | 200 — set/upsert `Capacity` for `(date, slot)` |
| POST | `/block` | `inventory.calendar.manage` | 200 — set `IsBlocked = true` for `(date, slot)` |
| POST | `/unblock` | `inventory.calendar.manage` | 200 — set `IsBlocked = false` (or delete row if matches default) |

### Holds — `/api/inventory/holds`

| Method | Route | Permission | Status codes |
|---|---|---|---|
| POST | `/` | `inventory.holds.manage` | 201 / 400 (capacity/blocked/asset-quantity) / 404 (resource) |
| POST | `/{id:guid}/confirm` | `inventory.holds.manage` | 200 / 409 / 410 |
| POST | `/{id:guid}/release` | `inventory.holds.manage` | 204 / 409 |
| POST | `/{id:guid}/extend` | `inventory.holds.manage` | 200 / 409 |
| GET | `/?resourceId=&status=&from=&to=` | `inventory.holds.view` | 200 |
| GET | `/{id:guid}` | `inventory.holds.view` | 200 / 404 |

### Key DTOs

```csharp
// Availability response
public sealed record AvailabilityDto(
    DateOnly Date,
    ResourceCalendarSlot? Slot,
    int Capacity,
    int Occupied,
    int Available,        // Capacity - Occupied (clamped to 0)
    bool IsBlocked,
    string? Notes
);

// Hold creation request
public sealed record CreateHoldRequest(
    Guid ResourceId,
    DateOnly StartDate,
    DateOnly EndDate,
    ResourceCalendarSlot? Slot,
    int Quantity,
    string? Notes
);

// Hold response
public sealed record HoldDto(
    Guid Id,
    Guid ResourceId,
    string ResourceName,
    DateOnly StartDate,
    DateOnly EndDate,
    ResourceCalendarSlot? Slot,
    int Quantity,
    string Status,        // "Held" | "Confirmed" | "Released" | "Expired"
    DateTime? ExpiresAt,
    string? BookingRef,
    Guid HeldByUserId,
    int ExtensionCount,
    string? Notes,
    DateTime CreatedAt,
    DateTime UpdatedAt
);
```

---

## Section 5 — Permissions

Added to `TravelCrm.Api/Common/PermissionCatalog.All()` (sort orders 800–807):

```csharp
items.Add(New("inventory", "suppliers", "view",   "View Suppliers", 800));
items.Add(New("inventory", "suppliers", "manage", "Manage Suppliers", 801));
items.Add(New("inventory", "resources", "view",   "View Resources", 802));
items.Add(New("inventory", "resources", "manage", "Manage Resources", 803));
items.Add(New("inventory", "calendar",  "view",   "View Calendar", 804));
items.Add(New("inventory", "calendar",  "manage", "Manage Calendar", 805));
items.Add(New("inventory", "holds",     "view",   "View Holds", 806));
items.Add(New("inventory", "holds",     "manage", "Create/Confirm/Release Holds", 807));
```

Role assignments in `RolePermissionSeeder.PermissionsFor`:

| Role | New slugs |
|---|---|
| `superadmin` | (already wildcard via `MatchAll`) |
| `admin` | all 8 |
| `manager` | `*.view` (4) + `resources.manage`, `calendar.manage`, `holds.manage` (3) — i.e. everything except `suppliers.manage` |
| `readonly` | all 4 `.view` slugs |

---

## Section 6 — Frontend Scope

| Page | Route | Notes |
|---|---|---|
| **Suppliers list** | `/inventory/suppliers` | Standard CRUD list; Tabler icons; `crm-page` layout (matches Companies / Tasks). |
| **Supplier form** | `/inventory/suppliers/new`, `/inventory/suppliers/:id` | Reactive form; type dropdown, contact fields, contract dates, IsActive toggle. |

No other UI in this sub-project. Resources / Calendar / Holds remain backend-only — each future sub-project (Hotel, Vehicle, Driver, Guide, Activity) ships its own typed UI on top of the foundation API.

Sidebar update (`sidebar-data.ts`): a new **"Inventory"** `navCap` section header inserted **between Travel and Customers** (id: 11 — new icon strip entry needed). Single child entry: `Suppliers` linked to `/inventory/suppliers`.

App-launcher mega-menu update: a new tenant-only entry `Suppliers` (icon `solar:case-line-duotone`) added to both `vertical/header.component.ts` and `horizontal/header.component.ts` `apps[]` arrays, marked `tenantOnly: true`.

---

## Section 7 — Testing Strategy

xUnit + FluentAssertions + hand-rolled fakes + in-memory EF — matching the Tasks pattern. Total: ~40 new tests.

| File | Test count | Coverage |
|---|---|---|
| `SupplierHandlersTests.cs` | ~5 | CRUD happy paths, tenant isolation, name uniqueness, in-use guard on delete |
| `ResourceHandlersTests.cs` | ~6 | Pool vs Asset creation, block/unblock, status transitions, supplier FK resolution |
| `CalendarHandlersTests.cs` | ~5 | SetCapacity insert + upsert (unique on (resource,date,slot)), block, unblock, cross-tenant isolation |
| `HoldHandlersTests.cs` | ~10 | Create / Confirm / Release / Extend; terminal-state guards; expired-hold rejection; extension cap; asset-quantity guard |
| **`AvailabilityCalculationTests.cs`** | ~12 | **Critical.** Table-driven: pool with no override (uses `DefaultCapacity`); pool with capacity override; pool with multiple overlapping holds; asset with single hold; blocked date in middle of range; slot mismatch (Morning vs Afternoon); whole-day vs slot-day collision rule; quantity exceeds capacity; back-to-back holds with no overlap; same-day Start/End |
| `HoldExpirySweepJobTests.cs` | ~3 | Sweeps held + past-expiry; ignores Confirmed; ignores future-expiry |
| **`HoldConcurrencyTests.cs`** | ~1 | **PostgreSQL-only integration test.** Two parallel `CreateHold` calls on a single-capacity resource; assert exactly one succeeds. Skipped when `db.Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory"`. |

The `AvailabilityCalculationTests` file is the single most important deliverable in this sub-project — every future hotel/driver/vehicle module will route bookings through this calculation, and any regression breaks all of them.

---

## Section 8 — Migration & Configuration

Single EF migration `AddInventoryFoundation`:

- Creates 5 tables: `suppliers`, `resources` (TPH), `resource_calendar`, `resource_holds`, `tenant_settings` (only the `hold_ttl_hours` column for now).
- Creates indexes listed in Section 1.
- Creates the `kind` discriminator column on `resources` with a check constraint.

Snake_case via `.UseSnakeCaseNamingConvention()` (project default).

No data seeding — empty tables ship; tenants populate via the API as they onboard.

`PermissionCatalog.All()` and `RolePermissionSeeder.PermissionsFor(...)` extended as described in Section 5. Existing tenants pick up the new permission rows on the next API startup (idempotent seed).

---

## Out of Scope (Deferred)

- **Pricing** — `IResourcePricing` interface + `NullResourcePricing` only. Each future sub-project adds its own implementations.
- **Multi-source allotments** — Hotel sub-project will add an `Allotment` entity (resource + supplier + quota tracking).
- **Hourly / time-window scheduling** — Day + Morning/Afternoon/Evening only. Future migration may add `start_minute` / `end_minute` to `ResourceCalendar` and `ResourceHold`.
- **Resources / Calendar / Holds admin UI** — Backend-only at foundation layer. Each consuming sub-project ships typed UI.
- **Audit log of hold transitions** — `BaseEntity.UpdatedAt` is enough for v1. Full transition audit if/when compliance requires it.
- **Real-time push** — No SignalR / WebSocket. Future modules can poll or subscribe to a domain-event bus when one exists.
- **Multi-currency, multi-branch, AI pricing, WhatsApp, real-time supplier sync, dynamic pricing engine** — Each may become its own future enhancement; explicitly out of every sub-project in the original 8-part decomposition.

---

## Decision Recap

| Decision | Choice | Source |
|---|---|---|
| Inventory model | Two-tier: `PoolResource` + `AssetResource` | Q1 |
| Calendar granularity | Day + optional Morning/Afternoon/Evening slot | Q2 |
| Hold lifecycle | Two-stage: `Held` (auto-expire) → `Confirmed` | Q3 |
| Pricing | Foundation has no pricing; `IResourcePricing` strategy interface only | Q4 |
| Supplier on Resource | Optional FK (null = tenant-owned) | Q5 |
| Concurrency | Pessimistic `SELECT … FOR UPDATE` lock on Resource row | Default |
| TTL | 24h default, per-tenant override, 3 extensions max | Default |
| Sweeper interval | Hangfire recurring, 5 minutes | Default |
| EF inheritance | TPH (single `resources` table) | Default |
