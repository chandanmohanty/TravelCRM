# Phase 1 — Deals & Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship multi-pipeline sales-pipeline core for TravelCRMPlus — Deal entity, configurable pipelines, drag-drop kanban, list view, SidePanel detail, lead-to-deal conversion.

**Architecture:** ASP.NET Core 8 + MediatR + EF Core 8 (PostgreSQL) backend; Angular 21 frontend with signals + standalone components. Phase 0 infrastructure (FeatureGate, *hasFeature, SidePanel, EnvelopeInterceptor) is reused throughout.

**Tech Stack:** C# 12, .NET 8, EF Core, Hangfire (existing — no new jobs in P1), FluentValidation, Angular 21, Angular CDK DragDrop, Angular Material, RxJS, PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-05-13-phase-1-deals-pipeline-design.md`

---

## File Structure

### Backend — new files
```
TravelCrm.Api/
├── Domain/Entities/Crm/
│   ├── Pipeline.cs                       (Pipeline entity)
│   ├── PipelineStage.cs                  (PipelineStage entity + PipelineStageKind enum)
│   ├── Deal.cs                           (Deal entity + DealStatus enum)
│   └── DealActivity.cs                   (DealActivity entity + DealActivityKind enum)
├── Infrastructure/Persistence/
│   └── PipelineSeeder.cs                 (seed default pipeline + Lead.Converted backfill)
├── Migrations/
│   └── {stamp}_AddDealsAndPipelines.cs   (EF-generated schema)
├── Features/Crm/Pipelines/
│   ├── Dtos.cs                           (PipelineDto, PipelineStageDto)
│   ├── PipelinesController.cs
│   ├── Queries/ListPipelinesQuery.cs     (+ GetPipelineQuery)
│   └── Commands/
│       ├── CreatePipelineCommand.cs
│       ├── UpdatePipelineCommand.cs
│       ├── DeletePipelineCommand.cs
│       └── StageCommands.cs              (Add/Update/Delete/Reorder stage in one file)
└── Features/Crm/Deals/
    ├── Dtos.cs                           (DealDto, DealActivityDto, KanbanColumnDto)
    ├── DealActivityLogger.cs             (centralised activity-row writer)
    ├── DealsController.cs
    ├── Queries/
    │   ├── ListDealsQuery.cs
    │   ├── GetDealQuery.cs
    │   └── GetKanbanQuery.cs
    └── Commands/
        ├── CreateDealCommand.cs
        ├── UpdateDealCommand.cs
        ├── MoveDealStageCommand.cs
        ├── ReassignDealCommand.cs
        ├── AddDealNoteCommand.cs
        └── DeleteDealCommand.cs
```

### Backend — modified files
```
TravelCrm.Api/
├── Common/PermissionCatalog.cs                  (add 4 slugs)
├── Infrastructure/Persistence/
│   ├── ApplicationDbContext.cs                  (4 DbSets + entity config)
│   ├── SeedData.cs                              (call PipelineSeeder)
│   └── RolePermissionSeeder.cs                  (grant new slugs)
├── Domain/Entities/Lead.cs                      ([Obsolete] on Converted enum)
└── Features/Leads/
    ├── LeadsController.cs                       (remove Convert endpoint, hasDeals param)
    ├── DTOs/LeadDto.cs                          (add dealCount)
    ├── Queries/ListLeadsQuery.cs                (hasDeals filter + dealCount populate)
    └── Commands/DeleteLeadCommand.cs            (guard: active deals)
```

### Backend — deleted files
```
TravelCrm.Api/Features/Leads/Commands/ConvertLeadCommand.cs
```

### Frontend — new files
```
src/app/
├── core/services/
│   ├── deals.service.ts
│   └── pipelines.service.ts
└── pages/crm/
    ├── deals/
    │   ├── deal-list/deal-list.component.ts
    │   ├── deals-kanban/deals-kanban.component.ts
    │   ├── deal-form/deal-form.component.ts
    │   └── deal-detail/deal-detail.component.ts
    └── pipelines/
        ├── pipeline-list/pipeline-list.component.ts
        └── pipeline-edit/pipeline-edit.component.ts
```

### Frontend — modified files
```
src/app/
├── core/models/crm.models.ts                              (add Deal/Pipeline types; retire OpportunityStage)
├── pages/crm/crm.routes.ts                                (add deals + pipelines routes + redirect)
└── pages/crm/leads/
    ├── lead-list/lead-list.component.ts                   (Convert → Create Deal, hasDeals filter, dealCount badge)
    └── lead-form/lead-form.component.ts                   (Deals section in edit mode)
```

### Frontend — deleted files
```
src/app/pages/crm/pipeline/                               (stub replaced)
```

---

## ▶ EXECUTION PROGRESS

> **Last updated:** 2026-05-14 · **HEAD:** `09a3907` · pushed to `origin/master`
>
> **Tasks 1–5 COMPLETE** (subagent-driven, both review stages passed + fixes applied):
>
> | Task | Commits | Notes |
> |---|---|---|
> | 1 Domain entities | `ec5e502`, `f84121a` | + audit-field fix on Pipeline/PipelineStage |
> | 2 EF config + migration | `a76043c`, `ac0a483` | migration `20260512194802_AddDealsAndPipelines`; Tags converter extracted to shared `_pipeListConverter`/`_pipeListComparer` |
> | 3 Permissions | `315298e`, `5bd37f6` | Admin=all4, Manager=view+manage, ReadOnly=view |
> | 4 PipelineSeeder | `a946856`, `75ae3f1` | `LeadStatus.Converted = 5` (1-based enum); uses ILogger |
> | 5 Pipelines DTOs + queries | `546fce2`, `09a3907` | + migration `20260515193647_DealPipelineIndex` ((TenantId,PipelineId,IsDeleted)) |
>
> **RESUME AT TASK 6.** Working notes for the next session:
> - Branch: `master`, no worktree. Pre-existing unstaged `src/assets/scss/_container.scss` is unrelated — never stage it.
> - DB connection (user-secrets): `Host=localhost;Port=5432;Database=travelcrm;Username=postgres;Password=Cl0ud@2026$`. psql at `C:\Program Files\PostgreSQL\18\bin\psql.exe`.
> - Always `Get-Process -Name "TravelCrm.Api" | Stop-Process -Force` before `dotnet build` (dev server locks the .exe).
> - 5 pre-existing build warnings are EXPECTED & acceptable: 3× CS0618 in `ConvertLeadCommand.cs`/`DeleteLeadCommand.cs` (Task 17 removes/rewrites them), 2× CS9113 in `RefreshCommandHandler.cs`/`ForgotPasswordCommand.cs` (unrelated).
> - `crm.deals.*` + `crm.pipelines.manage` permission slugs are seeded. `crm.deals.view` gates queries, `crm.deals.manage` gates writes, `crm.deals.delete` gates delete, `crm.pipelines.manage` gates pipeline/stage admin.
> - `EFCore.NamingConventions` auto snake_cases all tables/columns — never add manual `[Table]`/`[Column]`.
> - Codebase conventions confirmed by Task 5: `Result<T>` in `TravelCrm.Api.Common`; `ICurrentUser.HasPermission(string)`; `ITenantContext.IsResolved`/`.TenantId`; tenant scoping is explicit per-handler (no global filters).

---

## Task Index

1. ~~Domain entities + enums~~ ✅
2. ~~EF configuration + migration~~ ✅
3. ~~PermissionCatalog + RolePermissionSeeder updates~~ ✅
4. ~~PipelineSeeder + Lead.Converted backfill, wired into SeedData~~ ✅
5. ~~Pipelines DTOs + List/Get queries~~ ✅
6. Pipelines commands (Create/Update/Delete)  ← **RESUME HERE**
7. Stage commands (Add/Update/Delete/Reorder)
8. PipelinesController
9. Deal DTOs + DealActivityLogger
10. Deals queries (List/Get/Kanban)
11. CreateDealCommand
12. UpdateDealCommand
13. MoveDealStageCommand
14. ReassignDealCommand + AddDealNoteCommand
15. DeleteDealCommand
16. DealsController
17. Lead housekeeping (remove Convert, hasDeals, dealCount, delete guard)
18. Frontend: crm.models.ts types
19. Frontend: PipelinesService
20. Frontend: DealsService
21. Frontend: Pipelines list + edit components
22. Frontend: Deal form (dual-mode)
23. Frontend: Deal list with KPIs
24. Frontend: Deal detail SidePanel
25. Frontend: Deals kanban with CDK drag-drop
26. Frontend: routes, sidebar nav, old `/crm/pipeline` redirect
27. Frontend: Lead list + form updates
28. Wrap — smoke test, docs regen, graphify update

Tasks 1–17 = backend (~16 SP). Tasks 18–28 = frontend (~13 SP). Total ~29 SP.

---

## Task 1: Domain entities + enums

**Files:**
- Create: `TravelCrm.Api/Domain/Entities/Crm/Pipeline.cs`
- Create: `TravelCrm.Api/Domain/Entities/Crm/PipelineStage.cs`
- Create: `TravelCrm.Api/Domain/Entities/Crm/Deal.cs`
- Create: `TravelCrm.Api/Domain/Entities/Crm/DealActivity.cs`

- [ ] **Step 1: Create `Pipeline.cs`**

```csharp
namespace TravelCrm.Api.Domain.Entities.Crm;

/// <summary>
/// Tenant-scoped pipeline (e.g. "Sales", "Repeat Customer", "Group Bookings").
/// Holds a configurable ordered list of <see cref="PipelineStage"/> rows.
/// </summary>
public sealed class Pipeline : IAuditableEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public bool IsDefault { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public List<PipelineStage> Stages { get; set; } = new();
}
```

- [ ] **Step 2: Create `PipelineStage.cs`**

```csharp
namespace TravelCrm.Api.Domain.Entities.Crm;

/// <summary>
/// Semantic role of a stage. Tenants choose the display name; reports use
/// <see cref="PipelineStageKind"/> to compute win-rate independent of naming.
/// </summary>
public enum PipelineStageKind
{
    Open = 0,
    Won  = 1,
    Lost = 2,
}

public sealed class PipelineStage : IAuditableEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid PipelineId { get; set; }
    public string Name { get; set; } = default!;
    public int SortOrder { get; set; }
    /// <summary>0–100. Applied to new deals; can be overridden per deal.</summary>
    public int DefaultProbability { get; set; }
    public PipelineStageKind Kind { get; set; } = PipelineStageKind.Open;
    public string ColorHex { get; set; } = "#94a3b8";
    public bool IsActive { get; set; } = true;
}
```

- [ ] **Step 3: Create `Deal.cs`**

```csharp
namespace TravelCrm.Api.Domain.Entities.Crm;

/// <summary>Computed cache derived from <see cref="PipelineStage.Kind"/>.</summary>
public enum DealStatus
{
    Open = 0,
    Won  = 1,
    Lost = 2,
}

public sealed class Deal : IAuditableEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Title { get; set; } = default!;
    public Guid PipelineId { get; set; }
    public Guid StageId { get; set; }
    /// <summary>Nullable drill-back to the originating Lead.</summary>
    public Guid? LeadId { get; set; }

    // ── Lead snapshot — denormalised at create-time ──────────────────────────
    public string ContactName { get; set; } = default!;
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public string? CompanyName { get; set; }

    // ── Commercial ────────────────────────────────────────────────────────────
    public decimal? Value { get; set; }
    public string Currency { get; set; } = "USD";
    public int Probability { get; set; }    // 0–100
    public DateOnly? ExpectedCloseDate { get; set; }
    public DateOnly? ActualCloseDate { get; set; }

    public Guid OwnerUserId { get; set; }

    public List<string> Tags { get; set; } = new();
    public string? Notes { get; set; }
    /// <summary>Reserved — no Phase 1 UI.</summary>
    public string? CustomFields { get; set; }

    public DealStatus Status { get; set; } = DealStatus.Open;

    /// <summary>EF optimistic-concurrency token. Kanban drag-drop reads + sends this.</summary>
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();

    public bool IsDeleted { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Guid?    CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public Guid?    UpdatedBy { get; set; }
}
```

- [ ] **Step 4: Create `DealActivity.cs`**

```csharp
namespace TravelCrm.Api.Domain.Entities.Crm;

public enum DealActivityKind
{
    Created       = 0,
    StageChanged  = 1,
    OwnerChanged  = 2,
    ValueChanged  = 3,
    Closed        = 4,
    Reopened      = 5,
    Note          = 6,
}

/// <summary>
/// Append-only per-deal activity feed. NOT marked IAuditableEntity —
/// this IS the user-visible audit feed; the platform AuditSaveChangesInterceptor
/// still captures Deal row changes for the admin audit log.
/// </summary>
public sealed class DealActivity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid DealId { get; set; }
    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
    public Guid? ActorUserId { get; set; }
    public string? ActorName { get; set; }
    public DealActivityKind Kind { get; set; }
    public string? FromValue { get; set; }
    public string? ToValue { get; set; }
    public string? Note { get; set; }
}
```

- [ ] **Step 5: Verify build**

```bash
cd TravelCrm.Api && dotnet build --nologo -v q
```

Expected: `0 Warning(s) · 0 Error(s)`.

- [ ] **Step 6: Commit**

```bash
git add TravelCrm.Api/Domain/Entities/Crm/
git commit -m "feat(phase-1): domain entities — Pipeline, PipelineStage, Deal, DealActivity"
```

---

## Task 2: EF configuration + migration

**Files:**
- Modify: `TravelCrm.Api/Infrastructure/Persistence/ApplicationDbContext.cs`
- Create: `TravelCrm.Api/Migrations/{stamp}_AddDealsAndPipelines.cs` (auto-generated)

- [ ] **Step 1: Add using + DbSets**

In `ApplicationDbContext.cs`, after `using TravelCrm.Api.Domain.Entities.Subscriptions;`, add:

```csharp
using TravelCrm.Api.Domain.Entities.Crm;
```

After the existing Inventory DbSets block, append:

```csharp
    // ── CRM Pipeline (Phase 1) ────────────────────────────────────────────────
    public DbSet<Pipeline> Pipelines => Set<Pipeline>();
    public DbSet<PipelineStage> PipelineStages => Set<PipelineStage>();
    public DbSet<Deal> Deals => Set<Deal>();
    public DbSet<DealActivity> DealActivities => Set<DealActivity>();
```

- [ ] **Step 2: Add entity configurations**

At the end of `OnModelCreating`, just before the closing brace, append:

```csharp
        // ── CRM Pipeline (Phase 1) ────────────────────────────────────────────

        builder.Entity<Pipeline>(b =>
        {
            b.HasKey(p => p.Id);
            b.Property(p => p.Name).HasMaxLength(100).IsRequired();
            b.Property(p => p.Description).HasMaxLength(500);
            b.HasIndex(p => new { p.TenantId, p.Name }).IsUnique();
            b.HasIndex(p => new { p.TenantId, p.SortOrder });
            b.HasMany(p => p.Stages)
                .WithOne()
                .HasForeignKey(s => s.PipelineId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<PipelineStage>(b =>
        {
            b.HasKey(s => s.Id);
            b.Property(s => s.Name).HasMaxLength(100).IsRequired();
            b.Property(s => s.Kind).HasConversion<int>();
            b.Property(s => s.ColorHex).HasMaxLength(7);
            b.HasIndex(s => new { s.PipelineId, s.Name }).IsUnique();
            b.HasIndex(s => new { s.TenantId, s.PipelineId, s.SortOrder });
        });

        builder.Entity<Deal>(b =>
        {
            b.HasKey(d => d.Id);
            b.Property(d => d.Title).HasMaxLength(200).IsRequired();
            b.Property(d => d.ContactName).HasMaxLength(200).IsRequired();
            b.Property(d => d.ContactEmail).HasMaxLength(256);
            b.Property(d => d.ContactPhone).HasMaxLength(50);
            b.Property(d => d.CompanyName).HasMaxLength(200);
            b.Property(d => d.Currency).HasMaxLength(5).IsRequired();
            b.Property(d => d.Value).HasColumnType("numeric(18,2)");
            b.Property(d => d.Notes).HasMaxLength(4000);
            b.Property(d => d.CustomFields).HasColumnType("jsonb");
            b.Property(d => d.Status).HasConversion<int>();
            b.Property(d => d.RowVersion).IsRowVersion();

            // Tags persistence mirrors Lead.Tags
            b.Property(d => d.Tags)
                .HasConversion(
                    v => string.Join('|', v),
                    v => v.Split('|', StringSplitOptions.RemoveEmptyEntries).ToList(),
                    new Microsoft.EntityFrameworkCore.ChangeTracking.ValueComparer<List<string>>(
                        (a, b2) => a!.SequenceEqual(b2!),
                        v => v.Aggregate(0, (h, s) => HashCode.Combine(h, s.GetHashCode())),
                        v => v.ToList()))
                .HasMaxLength(1000);

            b.HasOne<Pipeline>().WithMany().HasForeignKey(d => d.PipelineId)
                .OnDelete(DeleteBehavior.Restrict);
            b.HasOne<PipelineStage>().WithMany().HasForeignKey(d => d.StageId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(d => new { d.TenantId, d.OwnerUserId });
            b.HasIndex(d => new { d.TenantId, d.StageId, d.CreatedAt });
            b.HasIndex(d => new { d.TenantId, d.Status });
            b.HasIndex(d => new { d.TenantId, d.LeadId })
                .HasFilter("lead_id IS NOT NULL");
            b.HasIndex(d => new { d.TenantId, d.IsDeleted });
        });

        builder.Entity<DealActivity>(b =>
        {
            b.HasKey(a => a.Id);
            b.Property(a => a.Kind).HasConversion<int>();
            b.Property(a => a.ActorName).HasMaxLength(200);
            b.Property(a => a.FromValue).HasMaxLength(500);
            b.Property(a => a.ToValue).HasMaxLength(500);
            b.Property(a => a.Note).HasMaxLength(2000);
            b.HasOne<Deal>().WithMany().HasForeignKey(a => a.DealId)
                .OnDelete(DeleteBehavior.Cascade);
            b.HasIndex(a => new { a.TenantId, a.DealId, a.OccurredAt });
        });
```

- [ ] **Step 3: Generate migration**

Stop any running API instance:

```powershell
Get-Process -Name "TravelCrm.Api" -ErrorAction SilentlyContinue | Stop-Process -Force
```

Then:

```bash
cd TravelCrm.Api && dotnet build --nologo -v q && dotnet ef migrations add AddDealsAndPipelines --no-build
```

Expected: `Done.` plus new files under `Migrations/`.

- [ ] **Step 4: Inspect migration**

Open the new `Migrations/{stamp}_AddDealsAndPipelines.cs`. Verify:
- Four `CreateTable` calls: `pipelines`, `pipeline_stages`, `deals`, `deal_activities`
- `deals.row_version` mapped (Npgsql may surface as `xmin` system column — either is OK)
- Indexes match spec section 5.4 (FK indexes, unique tenant+name, partial lead_id)

If a column type is wrong, fix the entity config and `dotnet ef migrations remove` then re-add.

- [ ] **Step 5: Apply migration**

```bash
dotnet ef database update --no-build
```

Expected: `Applying migration ... Done.`

- [ ] **Step 6: Verify schema in PostgreSQL**

```powershell
$env:PGPASSWORD = 'Cl0ud@2026$'
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' --% -h localhost -U postgres -d travelcrm -c "\dt pipelines" -c "\dt deals" -c "\d deals"
```

Expected: all tables listed with correct columns and constraints.

- [ ] **Step 7: Commit**

```bash
git add TravelCrm.Api/Infrastructure/Persistence/ApplicationDbContext.cs TravelCrm.Api/Migrations/
git commit -m "feat(phase-1): EF config + migration for deals, pipelines, stages, activities"
```

---

## Task 3: PermissionCatalog + RolePermissionSeeder updates

**Files:**
- Modify: `TravelCrm.Api/Common/PermissionCatalog.cs`
- Modify: `TravelCrm.Api/Infrastructure/Persistence/RolePermissionSeeder.cs`

- [ ] **Step 1: Add 4 new permission slugs**

In `PermissionCatalog.cs`, find the `crm.leads.*` block and add directly below it:

```csharp
        new() { Slug = "crm.deals.view",       Name = "View deals",       Module = "crm", Submodule = "deals",     Action = "view",   Description = "List, view, and see the kanban of deals." },
        new() { Slug = "crm.deals.manage",     Name = "Manage deals",     Module = "crm", Submodule = "deals",     Action = "manage", Description = "Create, edit, move stages, reassign, and add notes." },
        new() { Slug = "crm.deals.delete",     Name = "Delete deals",     Module = "crm", Submodule = "deals",     Action = "delete", Description = "Delete open deals (closed deals are immutable)." },
        new() { Slug = "crm.pipelines.manage", Name = "Manage pipelines", Module = "crm", Submodule = "pipelines", Action = "manage", Description = "Create, edit, reorder and delete pipelines and stages." },
```

Set `SortOrder` continuing the existing CRM block numbering.

- [ ] **Step 2: Grant in `RolePermissionSeeder`**

Open `RolePermissionSeeder.cs`. The Admin role typically receives all catalog entries via a loop — confirm and no change needed.

For Sales Rep (or equivalent), find where `crm.leads.view` / `crm.leads.manage` are granted explicitly. Add the same pattern:

```csharp
            "crm.deals.view",
            "crm.deals.manage",
```

For Read-only role, add `"crm.deals.view"` to its list.

If only Admin exists in the seeder today, leave non-Admin grants for a follow-up — Phase 1 must run with Admin minimum.

- [ ] **Step 3: Build**

```bash
cd TravelCrm.Api && dotnet build --nologo -v q
```

Expected: `0 Error(s)`.

- [ ] **Step 4: Run API once to trigger seed**

```bash
dotnet run --no-build --urls http://localhost:5044
```

Wait ~12 seconds, then `Ctrl+C`.

- [ ] **Step 5: Verify**

```powershell
$env:PGPASSWORD = 'Cl0ud@2026$'
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' --% -h localhost -U postgres -d travelcrm -c "SELECT slug FROM permissions WHERE module='crm' AND submodule IN ('deals','pipelines') ORDER BY slug;"
```

Expected 4 rows: `crm.deals.delete`, `crm.deals.manage`, `crm.deals.view`, `crm.pipelines.manage`.

- [ ] **Step 6: Commit**

```bash
git add TravelCrm.Api/Common/PermissionCatalog.cs TravelCrm.Api/Infrastructure/Persistence/RolePermissionSeeder.cs
git commit -m "feat(phase-1): add crm.deals.{view,manage,delete} + crm.pipelines.manage permissions"
```

---

## Task 4: PipelineSeeder + Lead.Converted backfill

**Files:**
- Create: `TravelCrm.Api/Infrastructure/Persistence/PipelineSeeder.cs`
- Modify: `TravelCrm.Api/Infrastructure/Persistence/SeedData.cs`
- Modify: `TravelCrm.Api/Domain/Entities/Lead.cs` (mark `Converted` `[Obsolete]`)

- [ ] **Step 1: Mark `LeadStatus.Converted` obsolete**

Find the `LeadStatus` enum (likely in `TravelCrm.Api/Domain/Entities/Lead.cs` or `Crm/LeadStatus.cs`). Update:

```csharp
public enum LeadStatus
{
    New = 1,
    Contacted = 2,
    Qualified = 3,
    Unqualified = 4,
    [Obsolete("Retired in Phase 1. Use a Deal to express conversion. Existing rows backfilled to Qualified.")]
    Converted = 5,
}
```

NOTE: the actual enum is **1-based** (`New = 1` … `Converted = 5`). Read the
real `Lead.cs` first and preserve whatever numeric values exist — only add the
`[Obsolete]` attribute. Do not remove the enum value — historical migrations
reference it.

- [ ] **Step 2: Create `PipelineSeeder.cs`**

```csharp
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Domain.Entities.Crm;

namespace TravelCrm.Api.Infrastructure.Persistence;

/// <summary>
/// Phase 1 seeder. Idempotent. Runs after PlanSeeder in SeedData.SeedAsync.
/// Responsibilities:
///   1. Every tenant without any Pipeline gets a default "Sales" + 6 stages.
///   2. Legacy LeadStatus.Converted rows are demoted to Qualified (one-shot).
/// </summary>
public static class PipelineSeeder
{
    private sealed record StageDef(string Name, int SortOrder, int Probability, PipelineStageKind Kind, string Color);

    private static readonly StageDef[] DefaultStages =
    {
        new("Prospect",      10,  10, PipelineStageKind.Open, "#94a3b8"),
        new("Qualification", 20,  25, PipelineStageKind.Open, "#3b82f6"),
        new("Proposal",      30,  50, PipelineStageKind.Open, "#f59e0b"),
        new("Negotiation",   40,  75, PipelineStageKind.Open, "#8b5cf6"),
        new("Closed Won",    50, 100, PipelineStageKind.Won,  "#16a34a"),
        new("Closed Lost",   60,   0, PipelineStageKind.Lost, "#dc2626"),
    };

    public static async Task SeedAsync(ApplicationDbContext db, CancellationToken ct = default)
    {
        // 1. Default pipeline per tenant
        var tenantIds = await db.Tenants.Select(t => t.Id).ToListAsync(ct);
        foreach (var tid in tenantIds)
        {
            var hasAny = await db.Pipelines.AnyAsync(p => p.TenantId == tid, ct);
            if (hasAny) continue;

            db.Pipelines.Add(new Pipeline
            {
                Id          = Guid.NewGuid(),
                TenantId    = tid,
                Name        = "Sales",
                Description = "Default sales pipeline. Edit stages in CRM → Pipelines.",
                IsDefault   = true,
                IsActive    = true,
                SortOrder   = 10,
                CreatedAt   = DateTime.UtcNow,
                Stages      = DefaultStages.Select(sd => new PipelineStage
                {
                    Id                 = Guid.NewGuid(),
                    TenantId           = tid,
                    Name               = sd.Name,
                    SortOrder          = sd.SortOrder,
                    DefaultProbability = sd.Probability,
                    Kind               = sd.Kind,
                    ColorHex           = sd.Color,
                    IsActive           = true,
                }).ToList(),
            });
        }
        await db.SaveChangesAsync(ct);

        // 2. Backfill legacy Lead.Status = Converted → Qualified
#pragma warning disable CS0618
        var converted = await db.Leads
            .Where(l => l.Status == LeadStatus.Converted)
            .ExecuteUpdateAsync(s => s.SetProperty(l => l.Status, LeadStatus.Qualified), ct);
#pragma warning restore CS0618

        if (converted > 0)
            Console.WriteLine($"[PipelineSeeder] Demoted {converted} legacy Converted leads to Qualified.");
    }
}
```

- [ ] **Step 3: Wire into `SeedData.SeedAsync`**

In `SeedData.cs`, after the line `await PlanSeeder.SeedAsync(db);` at the end of the method, append:

```csharp
        // ── Default pipelines + Lead.Converted backfill (Phase 1) ─────────────
        await PipelineSeeder.SeedAsync(db);
```

- [ ] **Step 4: Build + run**

```bash
cd TravelCrm.Api && dotnet build --nologo -v q
dotnet run --no-build --urls http://localhost:5044
```

Wait ~15 seconds then `Ctrl+C`.

- [ ] **Step 5: Verify**

```powershell
$env:PGPASSWORD = 'Cl0ud@2026$'
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' --% -h localhost -U postgres -d travelcrm -c "SELECT p.name, COUNT(s.id) AS stages FROM pipelines p LEFT JOIN pipeline_stages s ON s.pipeline_id = p.id GROUP BY p.id, p.name;" -c "SELECT status, COUNT(*) FROM leads GROUP BY status;"
```

Expected: one Pipeline named `Sales` with 6 stages per tenant; no leads with `status = 4`.

- [ ] **Step 6: Commit**

```bash
git add TravelCrm.Api/Infrastructure/Persistence/PipelineSeeder.cs TravelCrm.Api/Infrastructure/Persistence/SeedData.cs TravelCrm.Api/Domain/Entities/Lead.cs
git commit -m "feat(phase-1): PipelineSeeder + Lead.Converted backfill (idempotent)"
```

---

## Task 5: Pipelines DTOs + List/Get queries

**Files:**
- Create: `TravelCrm.Api/Features/Crm/Pipelines/Dtos.cs`
- Create: `TravelCrm.Api/Features/Crm/Pipelines/Queries/ListPipelinesQuery.cs`
- Create: `TravelCrm.Api/Features/Crm/Pipelines/Queries/GetPipelineQuery.cs`

- [ ] **Step 1: Create `Dtos.cs`**

```csharp
namespace TravelCrm.Api.Features.Crm.Pipelines;

public sealed record PipelineDto(
    Guid Id,
    string Name,
    string? Description,
    bool IsDefault,
    bool IsActive,
    int SortOrder,
    int DealCount,
    IReadOnlyList<PipelineStageDto> Stages);

public sealed record PipelineStageDto(
    Guid Id,
    Guid PipelineId,
    string Name,
    int SortOrder,
    int DefaultProbability,
    string Kind,        // "Open" | "Won" | "Lost"
    string ColorHex,
    bool IsActive,
    int DealCount);
```

- [ ] **Step 2: Create `ListPipelinesQuery.cs`**

```csharp
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.Pipelines.Queries;

public sealed record ListPipelinesQuery(bool IncludeInactive = false)
    : IRequest<Result<List<PipelineDto>>>;

public sealed class ListPipelinesHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<ListPipelinesQuery, Result<List<PipelineDto>>>
{
    public async Task<Result<List<PipelineDto>>> Handle(ListPipelinesQuery q, CancellationToken ct)
    {
        if (!user.HasPermission("crm.deals.view"))
            return Result.Failure<List<PipelineDto>>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<List<PipelineDto>>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;

        var pipelines = await db.Pipelines
            .Where(p => p.TenantId == tid && (q.IncludeInactive || p.IsActive))
            .OrderBy(p => p.SortOrder).ThenBy(p => p.Name)
            .Include(p => p.Stages)
            .AsNoTracking()
            .ToListAsync(ct);

        // Deal-count per pipeline + per stage (one round-trip each)
        var pipelineCounts = await db.Deals
            .Where(d => d.TenantId == tid && !d.IsDeleted)
            .GroupBy(d => d.PipelineId)
            .Select(g => new { PipelineId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.PipelineId, x => x.Count, ct);

        var stageCounts = await db.Deals
            .Where(d => d.TenantId == tid && !d.IsDeleted)
            .GroupBy(d => d.StageId)
            .Select(g => new { StageId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.StageId, x => x.Count, ct);

        var dtos = pipelines.Select(p => new PipelineDto(
            p.Id, p.Name, p.Description, p.IsDefault, p.IsActive, p.SortOrder,
            pipelineCounts.GetValueOrDefault(p.Id, 0),
            p.Stages.OrderBy(s => s.SortOrder).Select(s => new PipelineStageDto(
                s.Id, s.PipelineId, s.Name, s.SortOrder, s.DefaultProbability,
                s.Kind.ToString(), s.ColorHex, s.IsActive,
                stageCounts.GetValueOrDefault(s.Id, 0)
            )).ToList()
        )).ToList();

        return Result.Success(dtos);
    }
}
```

- [ ] **Step 3: Create `GetPipelineQuery.cs`**

```csharp
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.Pipelines.Queries;

public sealed record GetPipelineQuery(Guid Id) : IRequest<Result<PipelineDto>>;

public sealed class GetPipelineHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<GetPipelineQuery, Result<PipelineDto>>
{
    public async Task<Result<PipelineDto>> Handle(GetPipelineQuery q, CancellationToken ct)
    {
        if (!user.HasPermission("crm.deals.view"))
            return Result.Failure<PipelineDto>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<PipelineDto>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;

        var p = await db.Pipelines
            .Where(x => x.Id == q.Id && x.TenantId == tid)
            .Include(x => x.Stages)
            .AsNoTracking()
            .FirstOrDefaultAsync(ct);
        if (p is null) return Result.Failure<PipelineDto>("Pipeline not found");

        var pipelineCount = await db.Deals.CountAsync(
            d => d.TenantId == tid && d.PipelineId == p.Id && !d.IsDeleted, ct);

        var stageCounts = await db.Deals
            .Where(d => d.TenantId == tid && d.PipelineId == p.Id && !d.IsDeleted)
            .GroupBy(d => d.StageId)
            .Select(g => new { StageId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.StageId, x => x.Count, ct);

        var dto = new PipelineDto(
            p.Id, p.Name, p.Description, p.IsDefault, p.IsActive, p.SortOrder,
            pipelineCount,
            p.Stages.OrderBy(s => s.SortOrder).Select(s => new PipelineStageDto(
                s.Id, s.PipelineId, s.Name, s.SortOrder, s.DefaultProbability,
                s.Kind.ToString(), s.ColorHex, s.IsActive,
                stageCounts.GetValueOrDefault(s.Id, 0)
            )).ToList()
        );
        return Result.Success(dto);
    }
}
```

- [ ] **Step 4: Build**

```bash
cd TravelCrm.Api && dotnet build --nologo -v q
```

Expected: `0 Error(s)`.

- [ ] **Step 5: Commit**

```bash
git add TravelCrm.Api/Features/Crm/Pipelines/
git commit -m "feat(phase-1): pipelines DTOs + List/Get queries"
```

---

## Task 6: Pipelines commands (Create / Update / Delete)

**Files:**
- Create: `TravelCrm.Api/Features/Crm/Pipelines/Commands/CreatePipelineCommand.cs`
- Create: `TravelCrm.Api/Features/Crm/Pipelines/Commands/UpdatePipelineCommand.cs`
- Create: `TravelCrm.Api/Features/Crm/Pipelines/Commands/DeletePipelineCommand.cs`

- [ ] **Step 1: Create `CreatePipelineCommand.cs`**

```csharp
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Crm;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.Pipelines.Commands;

public sealed record CreatePipelineCommand(
    string Name,
    string? Description,
    bool IsDefault,
    IReadOnlyList<InitialStage>? InitialStages
) : IRequest<Result<PipelineDto>>;

public sealed record InitialStage(
    string Name, int Probability, string Kind, string ColorHex);

public sealed class CreatePipelineValidator : AbstractValidator<CreatePipelineCommand>
{
    public CreatePipelineValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Description).MaximumLength(500);
        RuleForEach(x => x.InitialStages!).ChildRules(s =>
        {
            s.RuleFor(i => i.Name).NotEmpty().MaximumLength(100);
            s.RuleFor(i => i.Probability).InclusiveBetween(0, 100);
            s.RuleFor(i => i.Kind).Must(k => k is "Open" or "Won" or "Lost");
            s.RuleFor(i => i.ColorHex).Matches("^#[0-9A-Fa-f]{6}$");
        }).When(x => x.InitialStages is { Count: > 0 });
    }
}

public sealed class CreatePipelineHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<CreatePipelineCommand, Result<PipelineDto>>
{
    public async Task<Result<PipelineDto>> Handle(CreatePipelineCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.pipelines.manage"))
            return Result.Failure<PipelineDto>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<PipelineDto>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;

        var dup = await db.Pipelines.AnyAsync(
            p => p.TenantId == tid && p.Name == cmd.Name, ct);
        if (dup) return Result.Failure<PipelineDto>("A pipeline with this name already exists");

        // If this is marked default, unset any existing default
        if (cmd.IsDefault)
        {
            await db.Pipelines
                .Where(p => p.TenantId == tid && p.IsDefault)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.IsDefault, false), ct);
        }

        var nextSort = (await db.Pipelines.Where(p => p.TenantId == tid)
            .MaxAsync(p => (int?)p.SortOrder, ct) ?? 0) + 10;

        var pipeline = new Pipeline
        {
            Id          = Guid.NewGuid(),
            TenantId    = tid,
            Name        = cmd.Name,
            Description = cmd.Description,
            IsDefault   = cmd.IsDefault,
            IsActive    = true,
            SortOrder   = nextSort,
            CreatedAt   = DateTime.UtcNow,
        };

        // Default 6 stages if none supplied
        var stages = (cmd.InitialStages is { Count: > 0 }
            ? cmd.InitialStages.Select((s, i) => (s.Name, sort: (i + 1) * 10, s.Probability, s.Kind, s.ColorHex))
            : new (string Name, int sort, int Probability, string Kind, string ColorHex)[]
              {
                  ("Prospect",      10,  10, "Open", "#94a3b8"),
                  ("Qualification", 20,  25, "Open", "#3b82f6"),
                  ("Proposal",      30,  50, "Open", "#f59e0b"),
                  ("Negotiation",   40,  75, "Open", "#8b5cf6"),
                  ("Closed Won",    50, 100, "Won",  "#16a34a"),
                  ("Closed Lost",   60,   0, "Lost", "#dc2626"),
              }).ToList();

        pipeline.Stages = stages.Select(s => new PipelineStage
        {
            Id                 = Guid.NewGuid(),
            TenantId           = tid,
            Name               = s.Name,
            SortOrder          = s.sort,
            DefaultProbability = s.Probability,
            Kind               = Enum.Parse<PipelineStageKind>(s.Kind),
            ColorHex           = s.ColorHex,
            IsActive           = true,
        }).ToList();

        db.Pipelines.Add(pipeline);
        await db.SaveChangesAsync(ct);

        return Result.Success(new PipelineDto(
            pipeline.Id, pipeline.Name, pipeline.Description, pipeline.IsDefault, pipeline.IsActive, pipeline.SortOrder,
            0,
            pipeline.Stages.OrderBy(s => s.SortOrder).Select(s => new PipelineStageDto(
                s.Id, s.PipelineId, s.Name, s.SortOrder, s.DefaultProbability,
                s.Kind.ToString(), s.ColorHex, s.IsActive, 0
            )).ToList()
        ));
    }
}
```

- [ ] **Step 2: Create `UpdatePipelineCommand.cs`**

```csharp
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.Pipelines.Commands;

public sealed record UpdatePipelineCommand(
    Guid Id,
    string Name,
    string? Description,
    bool IsActive,
    bool IsDefault
) : IRequest<Result<Guid>>;

public sealed class UpdatePipelineValidator : AbstractValidator<UpdatePipelineCommand>
{
    public UpdatePipelineValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Description).MaximumLength(500);
    }
}

public sealed class UpdatePipelineHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<UpdatePipelineCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(UpdatePipelineCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.pipelines.manage"))
            return Result.Failure<Guid>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<Guid>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;
        var p = await db.Pipelines.FirstOrDefaultAsync(
            x => x.Id == cmd.Id && x.TenantId == tid, ct);
        if (p is null) return Result.Failure<Guid>("Pipeline not found");

        // Name uniqueness within tenant
        var dup = await db.Pipelines.AnyAsync(
            x => x.TenantId == tid && x.Id != cmd.Id && x.Name == cmd.Name, ct);
        if (dup) return Result.Failure<Guid>("Another pipeline already uses this name");

        // Toggling default — unset other default
        if (cmd.IsDefault && !p.IsDefault)
        {
            await db.Pipelines
                .Where(x => x.TenantId == tid && x.Id != cmd.Id && x.IsDefault)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.IsDefault, false), ct);
        }

        p.Name        = cmd.Name;
        p.Description = cmd.Description;
        p.IsActive    = cmd.IsActive;
        p.IsDefault   = cmd.IsDefault;
        p.UpdatedAt   = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        return Result.Success(p.Id);
    }
}
```

- [ ] **Step 3: Create `DeletePipelineCommand.cs`**

```csharp
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.Pipelines.Commands;

public sealed record DeletePipelineCommand(Guid Id) : IRequest<Result<bool>>;

public sealed class DeletePipelineHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<DeletePipelineCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(DeletePipelineCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.pipelines.manage"))
            return Result.Failure<bool>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<bool>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;
        var p = await db.Pipelines.FirstOrDefaultAsync(
            x => x.Id == cmd.Id && x.TenantId == tid, ct);
        if (p is null) return Result.Failure<bool>("Pipeline not found");

        var dealCount = await db.Deals.CountAsync(
            d => d.TenantId == tid && d.PipelineId == p.Id && !d.IsDeleted, ct);
        if (dealCount > 0)
            return Result.Failure<bool>($"Pipeline has {dealCount} deal(s) — move or close them first");

        if (p.IsDefault)
            return Result.Failure<bool>("Cannot delete the default pipeline. Mark another pipeline as default first.");

        db.Pipelines.Remove(p);
        await db.SaveChangesAsync(ct);
        return Result.Success(true);
    }
}
```

- [ ] **Step 4: Build**

```bash
cd TravelCrm.Api && dotnet build --nologo -v q
```

Expected: `0 Error(s)`.

- [ ] **Step 5: Commit**

```bash
git add TravelCrm.Api/Features/Crm/Pipelines/Commands/
git commit -m "feat(phase-1): pipeline Create/Update/Delete commands"
```

---

## Task 7: Stage commands (Add / Update / Delete / Reorder)

**Files:**
- Create: `TravelCrm.Api/Features/Crm/Pipelines/Commands/StageCommands.cs`

- [ ] **Step 1: Create `StageCommands.cs`**

All four stage commands in one file — they share boilerplate.

```csharp
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Crm;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.Pipelines.Commands;

// ── AddStage ────────────────────────────────────────────────────────────────

public sealed record AddStageCommand(
    Guid PipelineId,
    string Name,
    int Probability,
    string Kind,
    string ColorHex,
    int? SortOrder
) : IRequest<Result<PipelineStageDto>>;

public sealed class AddStageValidator : AbstractValidator<AddStageCommand>
{
    public AddStageValidator()
    {
        RuleFor(x => x.PipelineId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Probability).InclusiveBetween(0, 100);
        RuleFor(x => x.Kind).Must(k => k is "Open" or "Won" or "Lost");
        RuleFor(x => x.ColorHex).Matches("^#[0-9A-Fa-f]{6}$");
    }
}

public sealed class AddStageHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<AddStageCommand, Result<PipelineStageDto>>
{
    public async Task<Result<PipelineStageDto>> Handle(AddStageCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.pipelines.manage"))
            return Result.Failure<PipelineStageDto>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<PipelineStageDto>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;
        var pipeline = await db.Pipelines.FirstOrDefaultAsync(
            p => p.Id == cmd.PipelineId && p.TenantId == tid, ct);
        if (pipeline is null) return Result.Failure<PipelineStageDto>("Pipeline not found");

        var dup = await db.PipelineStages.AnyAsync(
            s => s.PipelineId == cmd.PipelineId && s.Name == cmd.Name, ct);
        if (dup) return Result.Failure<PipelineStageDto>("A stage with this name already exists on the pipeline");

        var sortOrder = cmd.SortOrder ?? (
            (await db.PipelineStages.Where(s => s.PipelineId == cmd.PipelineId)
                .MaxAsync(s => (int?)s.SortOrder, ct) ?? 0) + 10);

        var stage = new PipelineStage
        {
            Id                 = Guid.NewGuid(),
            TenantId           = tid,
            PipelineId         = cmd.PipelineId,
            Name               = cmd.Name,
            SortOrder          = sortOrder,
            DefaultProbability = cmd.Probability,
            Kind               = Enum.Parse<PipelineStageKind>(cmd.Kind),
            ColorHex           = cmd.ColorHex,
            IsActive           = true,
        };
        db.PipelineStages.Add(stage);
        await db.SaveChangesAsync(ct);

        return Result.Success(new PipelineStageDto(
            stage.Id, stage.PipelineId, stage.Name, stage.SortOrder, stage.DefaultProbability,
            stage.Kind.ToString(), stage.ColorHex, stage.IsActive, 0));
    }
}

// ── UpdateStage ─────────────────────────────────────────────────────────────

public sealed record UpdateStageCommand(
    Guid PipelineId,
    Guid StageId,
    string Name,
    int Probability,
    string Kind,
    string ColorHex,
    bool IsActive
) : IRequest<Result<Guid>>;

public sealed class UpdateStageValidator : AbstractValidator<UpdateStageCommand>
{
    public UpdateStageValidator()
    {
        RuleFor(x => x.PipelineId).NotEmpty();
        RuleFor(x => x.StageId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Probability).InclusiveBetween(0, 100);
        RuleFor(x => x.Kind).Must(k => k is "Open" or "Won" or "Lost");
        RuleFor(x => x.ColorHex).Matches("^#[0-9A-Fa-f]{6}$");
    }
}

public sealed class UpdateStageHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<UpdateStageCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(UpdateStageCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.pipelines.manage"))
            return Result.Failure<Guid>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<Guid>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;
        var stage = await db.PipelineStages.FirstOrDefaultAsync(
            s => s.Id == cmd.StageId && s.PipelineId == cmd.PipelineId && s.TenantId == tid, ct);
        if (stage is null) return Result.Failure<Guid>("Stage not found");

        var dup = await db.PipelineStages.AnyAsync(
            s => s.PipelineId == cmd.PipelineId && s.Id != cmd.StageId && s.Name == cmd.Name, ct);
        if (dup) return Result.Failure<Guid>("Another stage on this pipeline already uses this name");

        stage.Name               = cmd.Name;
        stage.DefaultProbability = cmd.Probability;
        stage.Kind               = Enum.Parse<PipelineStageKind>(cmd.Kind);
        stage.ColorHex           = cmd.ColorHex;
        stage.IsActive           = cmd.IsActive;

        await db.SaveChangesAsync(ct);
        return Result.Success(stage.Id);
    }
}

// ── DeleteStage ─────────────────────────────────────────────────────────────

public sealed record DeleteStageCommand(Guid PipelineId, Guid StageId) : IRequest<Result<bool>>;

public sealed class DeleteStageHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<DeleteStageCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(DeleteStageCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.pipelines.manage"))
            return Result.Failure<bool>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<bool>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;
        var stage = await db.PipelineStages.FirstOrDefaultAsync(
            s => s.Id == cmd.StageId && s.PipelineId == cmd.PipelineId && s.TenantId == tid, ct);
        if (stage is null) return Result.Failure<bool>("Stage not found");

        var dealCount = await db.Deals.CountAsync(
            d => d.TenantId == tid && d.StageId == cmd.StageId && !d.IsDeleted, ct);
        if (dealCount > 0)
            return Result.Failure<bool>($"Stage has {dealCount} deal(s) — move them first");

        db.PipelineStages.Remove(stage);
        await db.SaveChangesAsync(ct);
        return Result.Success(true);
    }
}

// ── ReorderStages ───────────────────────────────────────────────────────────

public sealed record ReorderStagesCommand(
    Guid PipelineId,
    IReadOnlyList<Guid> StageIds
) : IRequest<Result<bool>>;

public sealed class ReorderStagesValidator : AbstractValidator<ReorderStagesCommand>
{
    public ReorderStagesValidator()
    {
        RuleFor(x => x.PipelineId).NotEmpty();
        RuleFor(x => x.StageIds).NotEmpty();
    }
}

public sealed class ReorderStagesHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<ReorderStagesCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(ReorderStagesCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.pipelines.manage"))
            return Result.Failure<bool>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<bool>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;
        var stages = await db.PipelineStages
            .Where(s => s.PipelineId == cmd.PipelineId && s.TenantId == tid)
            .ToListAsync(ct);

        if (stages.Count != cmd.StageIds.Count ||
            stages.Any(s => !cmd.StageIds.Contains(s.Id)))
            return Result.Failure<bool>("Stage ID list doesn't match the pipeline's stages");

        var lookup = stages.ToDictionary(s => s.Id);
        for (int i = 0; i < cmd.StageIds.Count; i++)
            lookup[cmd.StageIds[i]].SortOrder = (i + 1) * 10;

        await db.SaveChangesAsync(ct);
        return Result.Success(true);
    }
}
```

- [ ] **Step 2: Build**

```bash
cd TravelCrm.Api && dotnet build --nologo -v q
```

Expected: `0 Error(s)`.

- [ ] **Step 3: Commit**

```bash
git add TravelCrm.Api/Features/Crm/Pipelines/Commands/StageCommands.cs
git commit -m "feat(phase-1): stage Add/Update/Delete/Reorder commands"
```

---

## Task 8: PipelinesController

**Files:**
- Create: `TravelCrm.Api/Features/Crm/Pipelines/PipelinesController.cs`

- [ ] **Step 1: Create controller**

```csharp
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Crm.Pipelines.Commands;
using TravelCrm.Api.Features.Crm.Pipelines.Queries;
using TravelCrm.Api.Infrastructure.Subscriptions;

namespace TravelCrm.Api.Features.Crm.Pipelines;

[ApiController]
[Authorize]
[RequiresFeature(FeatureCatalog.Deals)]
[Route("api/crm/pipelines")]
public sealed class PipelinesController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] bool includeInactive = false, CancellationToken ct = default)
    {
        var r = await mediator.Send(new ListPipelinesQuery(includeInactive), ct);
        return r.IsSuccess ? Ok(r.Value) : Forbid();
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var r = await mediator.Send(new GetPipelineQuery(id), ct);
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Forbid();
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePipelineCommand body, CancellationToken ct)
    {
        var r = await mediator.Send(body, ct);
        return r.IsSuccess
            ? CreatedAtAction(nameof(Get), new { id = r.Value!.Id }, r.Value)
            : BadRequest(new { error = r.Error });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePipelineRequest body, CancellationToken ct)
    {
        var r = await mediator.Send(new UpdatePipelineCommand(
            id, body.Name, body.Description, body.IsActive, body.IsDefault), ct);
        return r.IsSuccess
            ? Ok(new { id = r.Value })
            : (r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
                ? NotFound(new { error = r.Error }) : BadRequest(new { error = r.Error }));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var r = await mediator.Send(new DeletePipelineCommand(id), ct);
        if (r.IsSuccess) return NoContent();
        if (r.Error!.Contains("deal(s)", StringComparison.OrdinalIgnoreCase))
            return Conflict(new { error = r.Error });
        if (r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase))
            return NotFound(new { error = r.Error });
        return BadRequest(new { error = r.Error });
    }

    // ── Stages ──────────────────────────────────────────────────────────────

    [HttpPost("{pipelineId:guid}/stages")]
    public async Task<IActionResult> AddStage(Guid pipelineId, [FromBody] AddStageRequest body, CancellationToken ct)
    {
        var r = await mediator.Send(new AddStageCommand(
            pipelineId, body.Name, body.Probability, body.Kind, body.ColorHex, body.SortOrder), ct);
        return r.IsSuccess ? Ok(r.Value) : BadRequest(new { error = r.Error });
    }

    [HttpPut("{pipelineId:guid}/stages/{stageId:guid}")]
    public async Task<IActionResult> UpdateStage(Guid pipelineId, Guid stageId, [FromBody] UpdateStageRequest body, CancellationToken ct)
    {
        var r = await mediator.Send(new UpdateStageCommand(
            pipelineId, stageId, body.Name, body.Probability, body.Kind, body.ColorHex, body.IsActive), ct);
        return r.IsSuccess
            ? Ok(new { id = r.Value })
            : (r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
                ? NotFound(new { error = r.Error }) : BadRequest(new { error = r.Error }));
    }

    [HttpDelete("{pipelineId:guid}/stages/{stageId:guid}")]
    public async Task<IActionResult> DeleteStage(Guid pipelineId, Guid stageId, CancellationToken ct)
    {
        var r = await mediator.Send(new DeleteStageCommand(pipelineId, stageId), ct);
        if (r.IsSuccess) return NoContent();
        if (r.Error!.Contains("deal(s)", StringComparison.OrdinalIgnoreCase))
            return Conflict(new { error = r.Error });
        if (r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase))
            return NotFound(new { error = r.Error });
        return BadRequest(new { error = r.Error });
    }

    [HttpPut("{pipelineId:guid}/stages/reorder")]
    public async Task<IActionResult> ReorderStages(Guid pipelineId, [FromBody] ReorderStagesRequest body, CancellationToken ct)
    {
        var r = await mediator.Send(new ReorderStagesCommand(pipelineId, body.StageIds), ct);
        return r.IsSuccess
            ? NoContent()
            : BadRequest(new { error = r.Error });
    }
}

public sealed record UpdatePipelineRequest(string Name, string? Description, bool IsActive, bool IsDefault);
public sealed record AddStageRequest(string Name, int Probability, string Kind, string ColorHex, int? SortOrder);
public sealed record UpdateStageRequest(string Name, int Probability, string Kind, string ColorHex, bool IsActive);
public sealed record ReorderStagesRequest(IReadOnlyList<Guid> StageIds);
```

- [ ] **Step 2: Build + run + smoke test**

```bash
cd TravelCrm.Api && dotnet build --nologo -v q
dotnet run --no-build --urls http://localhost:5044
```

In another terminal — get a token then call the endpoint:

```bash
TOKEN=$(curl -sS -X POST http://localhost:5044/api/auth/login \
  -H 'Content-Type: application/json' \
  -H 'X-Tenant-Id: 00000000-0000-0000-0000-000000000001' \
  -d '{"email":"admin@travelcrm.io","password":"Admin@12345"}' \
  | sed 's/.*"accessToken":"\([^"]*\)".*/\1/')

curl -sS http://localhost:5044/api/crm/pipelines \
  -H "Authorization: Bearer $TOKEN" \
  -H 'X-Tenant-Id: 00000000-0000-0000-0000-000000000001' | head -c 800
```

Expected: JSON envelope with a pipeline named "Sales" and 6 stages.

`Ctrl+C` the API.

- [ ] **Step 3: Commit**

```bash
git add TravelCrm.Api/Features/Crm/Pipelines/PipelinesController.cs
git commit -m "feat(phase-1): PipelinesController — 9 endpoints, FeatureGate, permissions"
```

---

## Task 9: Deal DTOs + DealActivityLogger

**Files:**
- Create: `TravelCrm.Api/Features/Crm/Deals/Dtos.cs`
- Create: `TravelCrm.Api/Features/Crm/Deals/DealActivityLogger.cs`

- [ ] **Step 1: Create `Dtos.cs`**

```csharp
namespace TravelCrm.Api.Features.Crm.Deals;

public sealed record DealDto(
    Guid Id,
    string Title,
    Guid PipelineId,
    string PipelineName,
    Guid StageId,
    string StageName,
    string StageKind,
    string StageColor,
    Guid? LeadId,
    string ContactName,
    string? ContactEmail,
    string? ContactPhone,
    string? CompanyName,
    decimal? Value,
    string Currency,
    int Probability,
    DateOnly? ExpectedCloseDate,
    DateOnly? ActualCloseDate,
    Guid OwnerUserId,
    string? OwnerName,
    IReadOnlyList<string> Tags,
    string? Notes,
    string Status,
    string RowVersion,       // base64-encoded byte[] for client passthrough
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    IReadOnlyList<DealActivityDto>? RecentActivity);

public sealed record DealActivityDto(
    Guid Id,
    DateTime OccurredAt,
    Guid? ActorUserId,
    string? ActorName,
    string Kind,
    string? FromValue,
    string? ToValue,
    string? Note);

public sealed record KanbanColumnDto(
    Guid StageId,
    string StageName,
    string StageKind,
    string StageColor,
    int SortOrder,
    int Probability,
    IReadOnlyList<DealDto> Deals,
    int TotalCount,
    decimal? TotalValue,        // sum of deal values regardless of currency — UI handles mixed
    IReadOnlyDictionary<string, decimal> TotalValueByCurrency);

public sealed record KanbanDto(
    Guid PipelineId,
    string PipelineName,
    IReadOnlyList<KanbanColumnDto> Columns);
```

- [ ] **Step 2: Create `DealActivityLogger.cs`**

Single helper used by every command to write activity rows consistently.

```csharp
using TravelCrm.Api.Domain.Entities.Crm;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.Deals;

/// <summary>
/// Centralised writer for DealActivity rows. Every handler that mutates a Deal
/// calls one of the static helpers below so the activity feed stays consistent.
/// </summary>
public static class DealActivityLogger
{
    public static DealActivity Created(Guid tenantId, Guid dealId, ICurrentUser user) => new()
    {
        TenantId    = tenantId,
        DealId      = dealId,
        OccurredAt  = DateTime.UtcNow,
        ActorUserId = user.UserId,
        ActorName   = user.DisplayName,
        Kind        = DealActivityKind.Created,
    };

    public static DealActivity StageChanged(Guid tenantId, Guid dealId, ICurrentUser user,
        string fromStage, string toStage, string? note = null) => new()
    {
        TenantId    = tenantId,
        DealId      = dealId,
        OccurredAt  = DateTime.UtcNow,
        ActorUserId = user.UserId,
        ActorName   = user.DisplayName,
        Kind        = DealActivityKind.StageChanged,
        FromValue   = fromStage,
        ToValue     = toStage,
        Note        = note,
    };

    public static DealActivity OwnerChanged(Guid tenantId, Guid dealId, ICurrentUser user,
        string fromOwner, string toOwner, string? note = null) => new()
    {
        TenantId    = tenantId,
        DealId      = dealId,
        OccurredAt  = DateTime.UtcNow,
        ActorUserId = user.UserId,
        ActorName   = user.DisplayName,
        Kind        = DealActivityKind.OwnerChanged,
        FromValue   = fromOwner,
        ToValue     = toOwner,
        Note        = note,
    };

    public static DealActivity ValueChanged(Guid tenantId, Guid dealId, ICurrentUser user,
        string fromValue, string toValue) => new()
    {
        TenantId    = tenantId,
        DealId      = dealId,
        OccurredAt  = DateTime.UtcNow,
        ActorUserId = user.UserId,
        ActorName   = user.DisplayName,
        Kind        = DealActivityKind.ValueChanged,
        FromValue   = fromValue,
        ToValue     = toValue,
    };

    public static DealActivity Closed(Guid tenantId, Guid dealId, ICurrentUser user,
        string finalStageName, string? note = null) => new()
    {
        TenantId    = tenantId,
        DealId      = dealId,
        OccurredAt  = DateTime.UtcNow,
        ActorUserId = user.UserId,
        ActorName   = user.DisplayName,
        Kind        = DealActivityKind.Closed,
        ToValue     = finalStageName,
        Note        = note,
    };

    public static DealActivity Reopened(Guid tenantId, Guid dealId, ICurrentUser user,
        string newStageName) => new()
    {
        TenantId    = tenantId,
        DealId      = dealId,
        OccurredAt  = DateTime.UtcNow,
        ActorUserId = user.UserId,
        ActorName   = user.DisplayName,
        Kind        = DealActivityKind.Reopened,
        ToValue     = newStageName,
    };

    public static DealActivity Note(Guid tenantId, Guid dealId, ICurrentUser user, string note) => new()
    {
        TenantId    = tenantId,
        DealId      = dealId,
        OccurredAt  = DateTime.UtcNow,
        ActorUserId = user.UserId,
        ActorName   = user.DisplayName,
        Kind        = DealActivityKind.Note,
        Note        = note,
    };
}
```

**Note on `ICurrentUser.DisplayName`**: if that property doesn't exist yet, fall back to `user.Email ?? user.UserId.ToString()`. Check the interface — most CurrentUser abstractions expose at least `UserId` and `Email`.

- [ ] **Step 3: Build**

```bash
cd TravelCrm.Api && dotnet build --nologo -v q
```

Expected: `0 Error(s)`. If `DisplayName` is missing, change the helper to use `user.Email` (or whichever string is present on `ICurrentUser`).

- [ ] **Step 4: Commit**

```bash
git add TravelCrm.Api/Features/Crm/Deals/Dtos.cs TravelCrm.Api/Features/Crm/Deals/DealActivityLogger.cs
git commit -m "feat(phase-1): Deal DTOs + DealActivityLogger helper"
```

---

## Task 10: Deals queries (List / Get / Kanban)

**Files:**
- Create: `TravelCrm.Api/Features/Crm/Deals/Queries/ListDealsQuery.cs`
- Create: `TravelCrm.Api/Features/Crm/Deals/Queries/GetDealQuery.cs`
- Create: `TravelCrm.Api/Features/Crm/Deals/Queries/GetKanbanQuery.cs`

- [ ] **Step 1: Create `ListDealsQuery.cs`**

```csharp
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Crm;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.Deals.Queries;

public sealed record ListDealsQuery(
    Guid? PipelineId = null,
    Guid? StageId = null,
    Guid? OwnerUserId = null,
    string? Status = null,    // "Open" | "Won" | "Lost"
    bool? HasLead = null,
    string? Search = null,
    int Page = 1,
    int PageSize = 50
) : IRequest<Result<PagedDeals>>;

public sealed record PagedDeals(IReadOnlyList<DealDto> Items, int Total);

public sealed class ListDealsHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<ListDealsQuery, Result<PagedDeals>>
{
    public async Task<Result<PagedDeals>> Handle(ListDealsQuery q, CancellationToken ct)
    {
        if (!user.HasPermission("crm.deals.view"))
            return Result.Failure<PagedDeals>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<PagedDeals>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;

        var query = db.Deals.AsNoTracking()
            .Where(d => d.TenantId == tid && !d.IsDeleted);

        if (q.PipelineId.HasValue)   query = query.Where(d => d.PipelineId == q.PipelineId.Value);
        if (q.StageId.HasValue)      query = query.Where(d => d.StageId    == q.StageId.Value);
        if (q.OwnerUserId.HasValue)  query = query.Where(d => d.OwnerUserId == q.OwnerUserId.Value);
        if (!string.IsNullOrEmpty(q.Status) && Enum.TryParse<DealStatus>(q.Status, out var st))
            query = query.Where(d => d.Status == st);
        if (q.HasLead == true)  query = query.Where(d => d.LeadId != null);
        if (q.HasLead == false) query = query.Where(d => d.LeadId == null);
        if (!string.IsNullOrEmpty(q.Search))
        {
            var s = q.Search.ToLower();
            query = query.Where(d =>
                d.Title.ToLower().Contains(s) ||
                d.ContactName.ToLower().Contains(s) ||
                (d.CompanyName ?? "").ToLower().Contains(s));
        }

        var total = await query.CountAsync(ct);

        var page = Math.Max(1, q.Page);
        var size = Math.Clamp(q.PageSize, 1, 200);

        var rows = await (from d in query
                          join p in db.Pipelines on d.PipelineId equals p.Id
                          join s in db.PipelineStages on d.StageId equals s.Id
                          orderby d.CreatedAt descending
                          select new { d, pName = p.Name, sName = s.Name, sKind = s.Kind, sColor = s.ColorHex })
                         .Skip((page - 1) * size)
                         .Take(size)
                         .ToListAsync(ct);

        // Owner names — single lookup
        var ownerIds = rows.Select(r => r.d.OwnerUserId).Distinct().ToList();
        var owners = await db.Users
            .Where(u => ownerIds.Contains(u.Id))
            .Select(u => new { u.Id, Name = (u.FirstName + " " + u.LastName).Trim() })
            .ToDictionaryAsync(x => x.Id, x => x.Name, ct);

        var items = rows.Select(r => new DealDto(
            r.d.Id, r.d.Title, r.d.PipelineId, r.pName, r.d.StageId, r.sName,
            r.sKind.ToString(), r.sColor,
            r.d.LeadId, r.d.ContactName, r.d.ContactEmail, r.d.ContactPhone, r.d.CompanyName,
            r.d.Value, r.d.Currency, r.d.Probability,
            r.d.ExpectedCloseDate, r.d.ActualCloseDate,
            r.d.OwnerUserId, owners.GetValueOrDefault(r.d.OwnerUserId),
            r.d.Tags, r.d.Notes, r.d.Status.ToString(),
            Convert.ToBase64String(r.d.RowVersion),
            r.d.CreatedAt, r.d.UpdatedAt,
            RecentActivity: null
        )).ToList();

        return Result.Success(new PagedDeals(items, total));
    }
}
```

- [ ] **Step 2: Create `GetDealQuery.cs`**

```csharp
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.Deals.Queries;

public sealed record GetDealQuery(Guid Id, int RecentActivityLimit = 50) : IRequest<Result<DealDto>>;

public sealed class GetDealHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<GetDealQuery, Result<DealDto>>
{
    public async Task<Result<DealDto>> Handle(GetDealQuery q, CancellationToken ct)
    {
        if (!user.HasPermission("crm.deals.view"))
            return Result.Failure<DealDto>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<DealDto>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;

        var row = await (from d in db.Deals
                         where d.Id == q.Id && d.TenantId == tid && !d.IsDeleted
                         join p in db.Pipelines on d.PipelineId equals p.Id
                         join s in db.PipelineStages on d.StageId equals s.Id
                         select new { d, pName = p.Name, sName = s.Name, sKind = s.Kind, sColor = s.ColorHex })
                        .AsNoTracking()
                        .FirstOrDefaultAsync(ct);
        if (row is null) return Result.Failure<DealDto>("Deal not found");

        var owner = await db.Users
            .Where(u => u.Id == row.d.OwnerUserId)
            .Select(u => (u.FirstName + " " + u.LastName).Trim())
            .FirstOrDefaultAsync(ct);

        var activity = await db.DealActivities
            .Where(a => a.DealId == row.d.Id && a.TenantId == tid)
            .OrderByDescending(a => a.OccurredAt)
            .Take(q.RecentActivityLimit)
            .Select(a => new DealActivityDto(
                a.Id, a.OccurredAt, a.ActorUserId, a.ActorName,
                a.Kind.ToString(), a.FromValue, a.ToValue, a.Note))
            .AsNoTracking()
            .ToListAsync(ct);

        return Result.Success(new DealDto(
            row.d.Id, row.d.Title, row.d.PipelineId, row.pName, row.d.StageId, row.sName,
            row.sKind.ToString(), row.sColor,
            row.d.LeadId, row.d.ContactName, row.d.ContactEmail, row.d.ContactPhone, row.d.CompanyName,
            row.d.Value, row.d.Currency, row.d.Probability,
            row.d.ExpectedCloseDate, row.d.ActualCloseDate,
            row.d.OwnerUserId, owner,
            row.d.Tags, row.d.Notes, row.d.Status.ToString(),
            Convert.ToBase64String(row.d.RowVersion),
            row.d.CreatedAt, row.d.UpdatedAt,
            activity
        ));
    }
}
```

- [ ] **Step 3: Create `GetKanbanQuery.cs`**

```csharp
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.Deals.Queries;

public sealed record GetKanbanQuery(Guid? PipelineId = null) : IRequest<Result<KanbanDto>>;

public sealed class GetKanbanHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<GetKanbanQuery, Result<KanbanDto>>
{
    public async Task<Result<KanbanDto>> Handle(GetKanbanQuery q, CancellationToken ct)
    {
        if (!user.HasPermission("crm.deals.view"))
            return Result.Failure<KanbanDto>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<KanbanDto>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;

        // Pick pipeline: requested → tenant default → first active by sort
        var pipeline = q.PipelineId is Guid pid
            ? await db.Pipelines.FirstOrDefaultAsync(p => p.Id == pid && p.TenantId == tid, ct)
            : await db.Pipelines
                .Where(p => p.TenantId == tid && p.IsActive)
                .OrderByDescending(p => p.IsDefault).ThenBy(p => p.SortOrder)
                .FirstOrDefaultAsync(ct);
        if (pipeline is null) return Result.Failure<KanbanDto>("No pipeline found");

        var stages = await db.PipelineStages
            .Where(s => s.PipelineId == pipeline.Id && s.IsActive)
            .OrderBy(s => s.SortOrder)
            .AsNoTracking()
            .ToListAsync(ct);

        // Pull all deals for those stages in one query
        var stageIds = stages.Select(s => s.Id).ToList();
        var deals = await (from d in db.Deals
                           where d.TenantId == tid && !d.IsDeleted && stageIds.Contains(d.StageId)
                           orderby d.CreatedAt descending
                           select d)
                          .AsNoTracking()
                          .ToListAsync(ct);

        var ownerIds = deals.Select(d => d.OwnerUserId).Distinct().ToList();
        var owners = await db.Users
            .Where(u => ownerIds.Contains(u.Id))
            .Select(u => new { u.Id, Name = (u.FirstName + " " + u.LastName).Trim() })
            .ToDictionaryAsync(x => x.Id, x => x.Name, ct);

        var columns = stages.Select(s =>
        {
            var stageDeals = deals.Where(d => d.StageId == s.Id).ToList();
            var totalByCurrency = stageDeals
                .Where(d => d.Value.HasValue)
                .GroupBy(d => d.Currency)
                .ToDictionary(g => g.Key, g => g.Sum(d => d.Value!.Value));

            var dealDtos = stageDeals.Select(d => new DealDto(
                d.Id, d.Title, d.PipelineId, pipeline.Name, d.StageId, s.Name,
                s.Kind.ToString(), s.ColorHex,
                d.LeadId, d.ContactName, d.ContactEmail, d.ContactPhone, d.CompanyName,
                d.Value, d.Currency, d.Probability,
                d.ExpectedCloseDate, d.ActualCloseDate,
                d.OwnerUserId, owners.GetValueOrDefault(d.OwnerUserId),
                d.Tags, d.Notes, d.Status.ToString(),
                Convert.ToBase64String(d.RowVersion),
                d.CreatedAt, d.UpdatedAt,
                RecentActivity: null
            )).ToList();

            return new KanbanColumnDto(
                s.Id, s.Name, s.Kind.ToString(), s.ColorHex, s.SortOrder, s.DefaultProbability,
                dealDtos, dealDtos.Count,
                stageDeals.Where(d => d.Value.HasValue).Sum(d => d.Value!.Value),
                totalByCurrency);
        }).ToList();

        return Result.Success(new KanbanDto(pipeline.Id, pipeline.Name, columns));
    }
}
```

- [ ] **Step 4: Build**

```bash
cd TravelCrm.Api && dotnet build --nologo -v q
```

Expected: `0 Error(s)`.

- [ ] **Step 5: Commit**

```bash
git add TravelCrm.Api/Features/Crm/Deals/Queries/
git commit -m "feat(phase-1): deals queries — List/Get/Kanban"
```

---

## Task 11: CreateDealCommand

**Files:**
- Create: `TravelCrm.Api/Features/Crm/Deals/Commands/CreateDealCommand.cs`

- [ ] **Step 1: Create the command**

```csharp
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Domain.Entities.Crm;
using TravelCrm.Api.Features.Crm.Deals.Queries;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.Deals.Commands;

public sealed record CreateDealCommand(
    Guid? LeadId,
    string Title,
    string ContactName,
    string? ContactEmail,
    string? ContactPhone,
    string? CompanyName,
    Guid? PipelineId,
    Guid? StageId,
    decimal? Value,
    string? Currency,
    int? Probability,
    DateOnly? ExpectedCloseDate,
    Guid? OwnerUserId,
    IReadOnlyList<string>? Tags,
    string? Notes
) : IRequest<Result<DealDto>>;

public sealed class CreateDealValidator : AbstractValidator<CreateDealCommand>
{
    public CreateDealValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.ContactName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.ContactEmail).MaximumLength(256).EmailAddress()
            .When(x => !string.IsNullOrEmpty(x.ContactEmail));
        RuleFor(x => x.ContactPhone).MaximumLength(50);
        RuleFor(x => x.CompanyName).MaximumLength(200);
        RuleFor(x => x.Currency).MaximumLength(5);
        RuleFor(x => x.Value).GreaterThanOrEqualTo(0).When(x => x.Value.HasValue);
        RuleFor(x => x.Probability).InclusiveBetween(0, 100).When(x => x.Probability.HasValue);
        RuleFor(x => x.Notes).MaximumLength(4000);
    }
}

public sealed class CreateDealHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<CreateDealCommand, Result<DealDto>>
{
    public async Task<Result<DealDto>> Handle(CreateDealCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.deals.manage"))
            return Result.Failure<DealDto>("Forbidden");
        if (!tenant.IsResolved || !user.IsAuthenticated)
            return Result.Failure<DealDto>("Tenant or user not resolved");

        var tid = tenant.TenantId!.Value;

        // Resolve pipeline (default if omitted)
        var pipeline = cmd.PipelineId is Guid pid
            ? await db.Pipelines.FirstOrDefaultAsync(p => p.Id == pid && p.TenantId == tid, ct)
            : await db.Pipelines
                .Where(p => p.TenantId == tid && p.IsActive)
                .OrderByDescending(p => p.IsDefault).ThenBy(p => p.SortOrder)
                .FirstOrDefaultAsync(ct);
        if (pipeline is null) return Result.Failure<DealDto>("Pipeline not found");

        // Resolve stage (first Open by SortOrder if omitted; fall back to first active)
        PipelineStage? stage = null;
        if (cmd.StageId is Guid sid)
        {
            stage = await db.PipelineStages.FirstOrDefaultAsync(
                s => s.Id == sid && s.PipelineId == pipeline.Id && s.TenantId == tid, ct);
            if (stage is null) return Result.Failure<DealDto>("Stage not found in pipeline");
        }
        else
        {
            stage = await db.PipelineStages
                .Where(s => s.PipelineId == pipeline.Id && s.IsActive && s.Kind == PipelineStageKind.Open)
                .OrderBy(s => s.SortOrder).FirstOrDefaultAsync(ct);
            stage ??= await db.PipelineStages
                .Where(s => s.PipelineId == pipeline.Id && s.IsActive)
                .OrderBy(s => s.SortOrder).FirstOrDefaultAsync(ct);
            if (stage is null) return Result.Failure<DealDto>("Pipeline has no active stages");
        }

        // Lead snapshot — if leadId provided, overlay user-supplied fields on lead snapshot
        Lead? lead = null;
        if (cmd.LeadId is Guid lid)
        {
            lead = await db.Leads.FirstOrDefaultAsync(l => l.Id == lid && l.TenantId == tid, ct);
            if (lead is null) return Result.Failure<DealDto>("Lead not found");
        }

        var tenantRow = await db.Tenants.FirstOrDefaultAsync(t => t.Id == tid, ct);
        var defaultCurrency = tenantRow?.DefaultCurrencyCode ?? "USD";

        var deal = new Deal
        {
            Id          = Guid.NewGuid(),
            TenantId    = tid,
            Title       = cmd.Title,
            PipelineId  = pipeline.Id,
            StageId     = stage.Id,
            LeadId      = cmd.LeadId,
            ContactName = string.IsNullOrWhiteSpace(cmd.ContactName)
                ? (lead is not null ? $"{lead.FirstName} {lead.LastName}".Trim() : "")
                : cmd.ContactName,
            ContactEmail = cmd.ContactEmail ?? lead?.Email,
            ContactPhone = cmd.ContactPhone ?? lead?.Phone,
            CompanyName  = cmd.CompanyName  ?? lead?.Company,
            Value        = cmd.Value,
            Currency     = string.IsNullOrEmpty(cmd.Currency) ? defaultCurrency : cmd.Currency!,
            Probability  = cmd.Probability ?? stage.DefaultProbability,
            ExpectedCloseDate = cmd.ExpectedCloseDate,
            OwnerUserId  = cmd.OwnerUserId ?? user.UserId,
            Tags         = cmd.Tags?.ToList() ?? new(),
            Notes        = cmd.Notes,
            Status       = stage.Kind switch
            {
                PipelineStageKind.Won  => DealStatus.Won,
                PipelineStageKind.Lost => DealStatus.Lost,
                _                      => DealStatus.Open,
            },
            ActualCloseDate = stage.Kind == PipelineStageKind.Open
                ? null
                : DateOnly.FromDateTime(DateTime.UtcNow),
            CreatedAt = DateTime.UtcNow,
            CreatedBy = user.UserId,
        };

        db.Deals.Add(deal);
        db.DealActivities.Add(DealActivityLogger.Created(tid, deal.Id, user));

        await db.SaveChangesAsync(ct);

        // Return via GetDealQuery for consistency
        var owner = await db.Users
            .Where(u => u.Id == deal.OwnerUserId)
            .Select(u => (u.FirstName + " " + u.LastName).Trim())
            .FirstOrDefaultAsync(ct);

        return Result.Success(new DealDto(
            deal.Id, deal.Title, deal.PipelineId, pipeline.Name, deal.StageId, stage.Name,
            stage.Kind.ToString(), stage.ColorHex,
            deal.LeadId, deal.ContactName, deal.ContactEmail, deal.ContactPhone, deal.CompanyName,
            deal.Value, deal.Currency, deal.Probability,
            deal.ExpectedCloseDate, deal.ActualCloseDate,
            deal.OwnerUserId, owner,
            deal.Tags, deal.Notes, deal.Status.ToString(),
            Convert.ToBase64String(deal.RowVersion),
            deal.CreatedAt, deal.UpdatedAt,
            RecentActivity: null
        ));
    }
}
```

- [ ] **Step 2: Build**

```bash
cd TravelCrm.Api && dotnet build --nologo -v q
```

Expected: `0 Error(s)`.

- [ ] **Step 3: Commit**

```bash
git add TravelCrm.Api/Features/Crm/Deals/Commands/CreateDealCommand.cs
git commit -m "feat(phase-1): CreateDealCommand with lead snapshot + auto-stage/owner defaults"
```

---

## Task 12: UpdateDealCommand

**Files:**
- Create: `TravelCrm.Api/Features/Crm/Deals/Commands/UpdateDealCommand.cs`

- [ ] **Step 1: Create the command**

```csharp
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Crm.Deals.Queries;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.Deals.Commands;

public sealed record UpdateDealCommand(
    Guid Id,
    string RowVersion,            // base64 of byte[]
    string Title,
    decimal? Value,
    string Currency,
    int Probability,
    DateOnly? ExpectedCloseDate,
    IReadOnlyList<string>? Tags,
    string? Notes
) : IRequest<Result<DealDto>>;

public sealed class UpdateDealValidator : AbstractValidator<UpdateDealCommand>
{
    public UpdateDealValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.RowVersion).NotEmpty();
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Currency).NotEmpty().MaximumLength(5);
        RuleFor(x => x.Value).GreaterThanOrEqualTo(0).When(x => x.Value.HasValue);
        RuleFor(x => x.Probability).InclusiveBetween(0, 100);
        RuleFor(x => x.Notes).MaximumLength(4000);
    }
}

public sealed class UpdateDealHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<UpdateDealCommand, Result<DealDto>>
{
    public async Task<Result<DealDto>> Handle(UpdateDealCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.deals.manage"))
            return Result.Failure<DealDto>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<DealDto>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;
        var deal = await db.Deals.FirstOrDefaultAsync(
            d => d.Id == cmd.Id && d.TenantId == tid && !d.IsDeleted, ct);
        if (deal is null) return Result.Failure<DealDto>("Deal not found");

        // Concurrency check — client must send the RowVersion it last read
        var clientRv = Convert.FromBase64String(cmd.RowVersion);
        if (!clientRv.SequenceEqual(deal.RowVersion))
            return Result.Failure<DealDto>("concurrency_conflict");

        // Detect value change for activity log
        var valueChanged = deal.Value != cmd.Value || deal.Currency != cmd.Currency;
        var fromValueStr = deal.Value is null ? "—" : $"{deal.Value} {deal.Currency}";
        var toValueStr   = cmd.Value  is null ? "—" : $"{cmd.Value} {cmd.Currency}";

        deal.Title             = cmd.Title;
        deal.Value             = cmd.Value;
        deal.Currency          = cmd.Currency;
        deal.Probability       = cmd.Probability;
        deal.ExpectedCloseDate = cmd.ExpectedCloseDate;
        deal.Tags              = cmd.Tags?.ToList() ?? new();
        deal.Notes             = cmd.Notes;
        deal.UpdatedAt         = DateTime.UtcNow;
        deal.UpdatedBy         = user.UserId;

        if (valueChanged)
            db.DealActivities.Add(DealActivityLogger.ValueChanged(tid, deal.Id, user, fromValueStr, toValueStr));

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<DealDto>("concurrency_conflict");
        }

        return await new GetDealHandler(db, tenant, user)
            .Handle(new GetDealQuery(deal.Id), ct);
    }
}
```

- [ ] **Step 2: Build**

```bash
cd TravelCrm.Api && dotnet build --nologo -v q
```

Expected: `0 Error(s)`.

- [ ] **Step 3: Commit**

```bash
git add TravelCrm.Api/Features/Crm/Deals/Commands/UpdateDealCommand.cs
git commit -m "feat(phase-1): UpdateDealCommand with RowVersion concurrency + ValueChanged activity"
```

---

## Task 13: MoveDealStageCommand

**Files:**
- Create: `TravelCrm.Api/Features/Crm/Deals/Commands/MoveDealStageCommand.cs`

- [ ] **Step 1: Create the command**

```csharp
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Crm;
using TravelCrm.Api.Features.Crm.Deals.Queries;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.Deals.Commands;

public sealed record MoveDealStageCommand(
    Guid Id,
    string RowVersion,
    Guid StageId,
    string? Note
) : IRequest<Result<DealDto>>;

public sealed class MoveDealStageValidator : AbstractValidator<MoveDealStageCommand>
{
    public MoveDealStageValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.StageId).NotEmpty();
        RuleFor(x => x.RowVersion).NotEmpty();
        RuleFor(x => x.Note).MaximumLength(500);
    }
}

public sealed class MoveDealStageHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<MoveDealStageCommand, Result<DealDto>>
{
    public async Task<Result<DealDto>> Handle(MoveDealStageCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.deals.manage"))
            return Result.Failure<DealDto>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<DealDto>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;
        var deal = await db.Deals.FirstOrDefaultAsync(
            d => d.Id == cmd.Id && d.TenantId == tid && !d.IsDeleted, ct);
        if (deal is null) return Result.Failure<DealDto>("Deal not found");

        var clientRv = Convert.FromBase64String(cmd.RowVersion);
        if (!clientRv.SequenceEqual(deal.RowVersion))
            return Result.Failure<DealDto>("concurrency_conflict");

        var newStage = await db.PipelineStages.FirstOrDefaultAsync(
            s => s.Id == cmd.StageId && s.TenantId == tid, ct);
        if (newStage is null) return Result.Failure<DealDto>("Stage not found");
        if (newStage.PipelineId != deal.PipelineId)
            return Result.Failure<DealDto>("Stage does not belong to this deal's pipeline");

        if (newStage.Id == deal.StageId)
            return Result.Failure<DealDto>("Deal is already on that stage");

        var oldStage = await db.PipelineStages.FirstAsync(s => s.Id == deal.StageId, ct);

        var wasClosed = deal.Status != DealStatus.Open;
        var willClose = newStage.Kind != PipelineStageKind.Open;

        deal.StageId   = newStage.Id;
        deal.Status    = newStage.Kind switch
        {
            PipelineStageKind.Won  => DealStatus.Won,
            PipelineStageKind.Lost => DealStatus.Lost,
            _                      => DealStatus.Open,
        };
        // ActualCloseDate handling
        if (willClose && deal.ActualCloseDate is null)
            deal.ActualCloseDate = DateOnly.FromDateTime(DateTime.UtcNow);
        else if (!willClose)
            deal.ActualCloseDate = null;

        // Probability NOT auto-overwritten — keeps any manual override intact

        deal.UpdatedAt = DateTime.UtcNow;
        deal.UpdatedBy = user.UserId;

        db.DealActivities.Add(DealActivityLogger.StageChanged(
            tid, deal.Id, user, oldStage.Name, newStage.Name, cmd.Note));

        if (!wasClosed && willClose)
            db.DealActivities.Add(DealActivityLogger.Closed(tid, deal.Id, user, newStage.Name, cmd.Note));
        else if (wasClosed && !willClose)
            db.DealActivities.Add(DealActivityLogger.Reopened(tid, deal.Id, user, newStage.Name));

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<DealDto>("concurrency_conflict");
        }

        return await new GetDealHandler(db, tenant, user)
            .Handle(new GetDealQuery(deal.Id), ct);
    }
}
```

- [ ] **Step 2: Build**

```bash
cd TravelCrm.Api && dotnet build --nologo -v q
```

Expected: `0 Error(s)`.

- [ ] **Step 3: Commit**

```bash
git add TravelCrm.Api/Features/Crm/Deals/Commands/MoveDealStageCommand.cs
git commit -m "feat(phase-1): MoveDealStageCommand — pipeline check, status+close-date sync, activity log"
```

---

## Task 14: ReassignDealCommand + AddDealNoteCommand

**Files:**
- Create: `TravelCrm.Api/Features/Crm/Deals/Commands/ReassignDealCommand.cs`
- Create: `TravelCrm.Api/Features/Crm/Deals/Commands/AddDealNoteCommand.cs`

- [ ] **Step 1: Create `ReassignDealCommand.cs`**

```csharp
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Crm.Deals.Queries;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.Deals.Commands;

public sealed record ReassignDealCommand(
    Guid Id,
    string RowVersion,
    Guid OwnerUserId,
    string? Note
) : IRequest<Result<DealDto>>;

public sealed class ReassignDealValidator : AbstractValidator<ReassignDealCommand>
{
    public ReassignDealValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.OwnerUserId).NotEmpty();
        RuleFor(x => x.RowVersion).NotEmpty();
        RuleFor(x => x.Note).MaximumLength(500);
    }
}

public sealed class ReassignDealHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<ReassignDealCommand, Result<DealDto>>
{
    public async Task<Result<DealDto>> Handle(ReassignDealCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.deals.manage"))
            return Result.Failure<DealDto>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<DealDto>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;
        var deal = await db.Deals.FirstOrDefaultAsync(
            d => d.Id == cmd.Id && d.TenantId == tid && !d.IsDeleted, ct);
        if (deal is null) return Result.Failure<DealDto>("Deal not found");

        var clientRv = Convert.FromBase64String(cmd.RowVersion);
        if (!clientRv.SequenceEqual(deal.RowVersion))
            return Result.Failure<DealDto>("concurrency_conflict");

        // Owner must be a user in this tenant
        var newOwner = await db.Users.FirstOrDefaultAsync(
            u => u.Id == cmd.OwnerUserId && u.TenantId == tid && !u.IsDeleted, ct);
        if (newOwner is null) return Result.Failure<DealDto>("Owner not found in this tenant");

        if (newOwner.Id == deal.OwnerUserId)
            return Result.Failure<DealDto>("Deal is already assigned to that user");

        var oldOwner = await db.Users.Where(u => u.Id == deal.OwnerUserId)
            .Select(u => (u.FirstName + " " + u.LastName).Trim())
            .FirstOrDefaultAsync(ct) ?? "—";
        var newOwnerName = $"{newOwner.FirstName} {newOwner.LastName}".Trim();

        deal.OwnerUserId = newOwner.Id;
        deal.UpdatedAt   = DateTime.UtcNow;
        deal.UpdatedBy   = user.UserId;

        db.DealActivities.Add(DealActivityLogger.OwnerChanged(
            tid, deal.Id, user, oldOwner, newOwnerName, cmd.Note));

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<DealDto>("concurrency_conflict");
        }

        return await new GetDealHandler(db, tenant, user)
            .Handle(new GetDealQuery(deal.Id), ct);
    }
}
```

- [ ] **Step 2: Create `AddDealNoteCommand.cs`**

```csharp
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Crm.Deals.Queries;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.Deals.Commands;

public sealed record AddDealNoteCommand(Guid Id, string Note) : IRequest<Result<DealActivityDto>>;

public sealed class AddDealNoteValidator : AbstractValidator<AddDealNoteCommand>
{
    public AddDealNoteValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Note).NotEmpty().MaximumLength(2000);
    }
}

public sealed class AddDealNoteHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<AddDealNoteCommand, Result<DealActivityDto>>
{
    public async Task<Result<DealActivityDto>> Handle(AddDealNoteCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.deals.manage"))
            return Result.Failure<DealActivityDto>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<DealActivityDto>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;
        var dealExists = await db.Deals.AnyAsync(
            d => d.Id == cmd.Id && d.TenantId == tid && !d.IsDeleted, ct);
        if (!dealExists) return Result.Failure<DealActivityDto>("Deal not found");

        var activity = DealActivityLogger.Note(tid, cmd.Id, user, cmd.Note);
        db.DealActivities.Add(activity);
        await db.SaveChangesAsync(ct);

        return Result.Success(new DealActivityDto(
            activity.Id, activity.OccurredAt, activity.ActorUserId, activity.ActorName,
            activity.Kind.ToString(), activity.FromValue, activity.ToValue, activity.Note));
    }
}
```

- [ ] **Step 3: Build + commit**

```bash
cd TravelCrm.Api && dotnet build --nologo -v q
git add TravelCrm.Api/Features/Crm/Deals/Commands/Reassign* TravelCrm.Api/Features/Crm/Deals/Commands/AddDealNote*
git commit -m "feat(phase-1): ReassignDealCommand + AddDealNoteCommand"
```

---

## Task 15: DeleteDealCommand

**Files:**
- Create: `TravelCrm.Api/Features/Crm/Deals/Commands/DeleteDealCommand.cs`

- [ ] **Step 1: Create**

```csharp
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Crm;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.Deals.Commands;

public sealed record DeleteDealCommand(Guid Id) : IRequest<Result<bool>>;

public sealed class DeleteDealHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<DeleteDealCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(DeleteDealCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.deals.delete"))
            return Result.Failure<bool>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<bool>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;
        var deal = await db.Deals.FirstOrDefaultAsync(
            d => d.Id == cmd.Id && d.TenantId == tid && !d.IsDeleted, ct);
        if (deal is null) return Result.Failure<bool>("Deal not found");

        if (deal.Status != DealStatus.Open)
            return Result.Failure<bool>("Closed (won/lost) deals are immutable — they cannot be deleted");

        deal.IsDeleted = true;
        deal.UpdatedAt = DateTime.UtcNow;
        deal.UpdatedBy = user.UserId;

        await db.SaveChangesAsync(ct);
        return Result.Success(true);
    }
}
```

- [ ] **Step 2: Build + commit**

```bash
cd TravelCrm.Api && dotnet build --nologo -v q
git add TravelCrm.Api/Features/Crm/Deals/Commands/DeleteDealCommand.cs
git commit -m "feat(phase-1): DeleteDealCommand (soft delete, Open-only)"
```

---

## Task 16: DealsController

**Files:**
- Create: `TravelCrm.Api/Features/Crm/Deals/DealsController.cs`

- [ ] **Step 1: Create controller**

```csharp
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Crm.Deals.Commands;
using TravelCrm.Api.Features.Crm.Deals.Queries;
using TravelCrm.Api.Infrastructure.Subscriptions;

namespace TravelCrm.Api.Features.Crm.Deals;

[ApiController]
[Authorize]
[RequiresFeature(FeatureCatalog.Deals)]
[Route("api/crm/deals")]
public sealed class DealsController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] Guid? pipelineId,
        [FromQuery] Guid? stageId,
        [FromQuery] Guid? ownerUserId,
        [FromQuery] string? status,
        [FromQuery] bool? hasLead,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var r = await mediator.Send(
            new ListDealsQuery(pipelineId, stageId, ownerUserId, status, hasLead, search, page, pageSize), ct);
        return r.IsSuccess ? Ok(r.Value) : Forbid();
    }

    [HttpGet("kanban")]
    public async Task<IActionResult> Kanban(
        [FromQuery] Guid? pipelineId,
        CancellationToken ct)
    {
        var r = await mediator.Send(new GetKanbanQuery(pipelineId), ct);
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Forbid();
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var r = await mediator.Send(new GetDealQuery(id), ct);
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Forbid();
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateDealCommand body, CancellationToken ct)
    {
        var r = await mediator.Send(body, ct);
        return r.IsSuccess
            ? CreatedAtAction(nameof(Get), new { id = r.Value!.Id }, r.Value)
            : BadRequest(new { error = r.Error });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] DealUpdateRequest body, CancellationToken ct)
    {
        var r = await mediator.Send(new UpdateDealCommand(
            id, body.RowVersion, body.Title, body.Value, body.Currency,
            body.Probability, body.ExpectedCloseDate, body.Tags, body.Notes), ct);
        return MapDealResult(r);
    }

    [HttpPost("{id:guid}/move")]
    public async Task<IActionResult> Move(Guid id, [FromBody] DealMoveRequest body, CancellationToken ct)
    {
        var r = await mediator.Send(new MoveDealStageCommand(id, body.RowVersion, body.StageId, body.Note), ct);
        return MapDealResult(r);
    }

    [HttpPost("{id:guid}/reassign")]
    public async Task<IActionResult> Reassign(Guid id, [FromBody] DealReassignRequest body, CancellationToken ct)
    {
        var r = await mediator.Send(new ReassignDealCommand(id, body.RowVersion, body.OwnerUserId, body.Note), ct);
        return MapDealResult(r);
    }

    [HttpPost("{id:guid}/notes")]
    public async Task<IActionResult> AddNote(Guid id, [FromBody] DealNoteRequest body, CancellationToken ct)
    {
        var r = await mediator.Send(new AddDealNoteCommand(id, body.Note), ct);
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : BadRequest(new { error = r.Error });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var r = await mediator.Send(new DeleteDealCommand(id), ct);
        if (r.IsSuccess) return NoContent();
        if (r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase))
            return NotFound(new { error = r.Error });
        if (r.Error!.Contains("immutable", StringComparison.OrdinalIgnoreCase))
            return Conflict(new { error = r.Error });
        return BadRequest(new { error = r.Error });
    }

    private IActionResult MapDealResult(Result<DealDto> r)
    {
        if (r.IsSuccess) return Ok(r.Value);
        if (r.Error == "concurrency_conflict")
            return Conflict(new { error = "concurrency_conflict",
                message = "This deal was just updated by someone else. Refresh and retry." });
        if (r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase))
            return NotFound(new { error = r.Error });
        return BadRequest(new { error = r.Error });
    }
}

public sealed record DealUpdateRequest(
    string RowVersion, string Title, decimal? Value, string Currency,
    int Probability, DateOnly? ExpectedCloseDate, IReadOnlyList<string>? Tags, string? Notes);
public sealed record DealMoveRequest(string RowVersion, Guid StageId, string? Note);
public sealed record DealReassignRequest(string RowVersion, Guid OwnerUserId, string? Note);
public sealed record DealNoteRequest(string Note);
```

- [ ] **Step 2: Build + smoke test**

```bash
cd TravelCrm.Api && dotnet build --nologo -v q
dotnet run --no-build --urls http://localhost:5044
```

In another terminal:

```bash
TOKEN=$(curl -sS -X POST http://localhost:5044/api/auth/login \
  -H 'Content-Type: application/json' \
  -H 'X-Tenant-Id: 00000000-0000-0000-0000-000000000001' \
  -d '{"email":"admin@travelcrm.io","password":"Admin@12345"}' \
  | sed 's/.*"accessToken":"\([^"]*\)".*/\1/')

curl -sS -X POST http://localhost:5044/api/crm/deals \
  -H "Authorization: Bearer $TOKEN" \
  -H 'X-Tenant-Id: 00000000-0000-0000-0000-000000000001' \
  -H 'Content-Type: application/json' \
  -d '{"title":"Smoke test deal","contactName":"Test Contact","value":1000,"currency":"USD"}' \
  | head -c 600

curl -sS http://localhost:5044/api/crm/deals/kanban \
  -H "Authorization: Bearer $TOKEN" \
  -H 'X-Tenant-Id: 00000000-0000-0000-0000-000000000001' \
  | head -c 600
```

Expected: first call returns a `DealDto` with an `id`. Second returns a `KanbanDto` with 6 columns, the first containing 1 deal.

`Ctrl+C` the API.

- [ ] **Step 3: Commit**

```bash
git add TravelCrm.Api/Features/Crm/Deals/DealsController.cs
git commit -m "feat(phase-1): DealsController — 9 endpoints, RowVersion 409 mapping"
```

---

## Task 17: Lead housekeeping (remove Convert, hasDeals filter, dealCount, delete guard)

**Files:**
- Delete: `TravelCrm.Api/Features/Leads/Commands/ConvertLeadCommand.cs`
- Modify: `TravelCrm.Api/Features/Leads/LeadsController.cs`
- Modify: `TravelCrm.Api/Features/Leads/DTOs/LeadDto.cs`
- Modify: `TravelCrm.Api/Features/Leads/Queries/ListLeadsQuery.cs`
- Modify: `TravelCrm.Api/Features/Leads/Commands/DeleteLeadCommand.cs`

- [ ] **Step 1: Delete `ConvertLeadCommand.cs`**

```bash
git rm TravelCrm.Api/Features/Leads/Commands/ConvertLeadCommand.cs
```

- [ ] **Step 2: Remove `Convert` endpoint from `LeadsController.cs`**

Open `LeadsController.cs`. Find the `Convert` action (POST `/leads/{id}/convert`) and the `ConvertLeadCommand` import. Delete both. Remove any unused `using` lines.

- [ ] **Step 3: Add `DealCount` to `LeadDto`**

In `LeadDto.cs`, add a property at the end of the record:

```csharp
    public int DealCount { get; init; }
```

Or if it's a `record` with positional parameters, add `int DealCount` at the end.

- [ ] **Step 4: Update `ListLeadsQuery` to filter by `hasDeals` and populate `DealCount`**

In `ListLeadsQuery.cs`:

1. Add `bool? HasDeals = null` to the record's constructor parameters.
2. In the handler, after building the base query:

```csharp
        // hasDeals filter
        if (q.HasDeals == true)
            query = query.Where(l => db.Deals.Any(d => d.LeadId == l.Id && !d.IsDeleted));
        else if (q.HasDeals == false)
            query = query.Where(l => !db.Deals.Any(d => d.LeadId == l.Id && !d.IsDeleted));

        // Project with dealCount
        var rows = await query.Select(l => new {
            l,
            DealCount = db.Deals.Count(d => d.LeadId == l.Id && !d.IsDeleted)
        }).ToListAsync(ct);

        var items = rows.Select(r => LeadMapper.ToDto(r.l) with { DealCount = r.DealCount }).ToList();
```

If `LeadMapper.ToDto` doesn't return a record (cannot use `with`), set `DealCount` after mapping:

```csharp
        var items = rows.Select(r =>
        {
            var dto = LeadMapper.ToDto(r.l);
            dto.DealCount = r.DealCount;   // requires init/set on the property
            return dto;
        }).ToList();
```

3. Update the `LeadsController.List` action's `[FromQuery]` parameters to accept `bool? hasDeals`, pass into the query.

- [ ] **Step 5: Update `DeleteLeadCommand` guard**

Replace the existing "Converted leads can't be deleted" guard with an "active deals" guard.

```csharp
        // Replace this earlier guard:
        //   if (row.Status == LeadStatus.Converted) return Result.Failure("Converted leads cannot be deleted.");

        // With this — blocks delete when active deals reference the lead:
        var activeDealCount = await db.Deals.CountAsync(
            d => d.LeadId == row.Id && d.TenantId == row.TenantId
                 && !d.IsDeleted && d.Status == DealStatus.Open, ct);
        if (activeDealCount > 0)
            return Result.Failure($"Lead has {activeDealCount} active deal(s). Detach or close them first.");
```

Add the `using TravelCrm.Api.Domain.Entities.Crm;` directive at the top.

- [ ] **Step 6: Build + run + smoke test**

```bash
cd TravelCrm.Api && dotnet build --nologo -v q
dotnet run --no-build --urls http://localhost:5044
```

In another terminal:

```bash
TOKEN=$(curl -sS -X POST http://localhost:5044/api/auth/login \
  -H 'Content-Type: application/json' \
  -H 'X-Tenant-Id: 00000000-0000-0000-0000-000000000001' \
  -d '{"email":"admin@travelcrm.io","password":"Admin@12345"}' \
  | sed 's/.*"accessToken":"\([^"]*\)".*/\1/')

curl -sS 'http://localhost:5044/api/crm/leads?hasDeals=false&pageSize=3' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'X-Tenant-Id: 00000000-0000-0000-0000-000000000001' | head -c 500
```

Expected: leads returned each with `"dealCount": 0`.

`Ctrl+C` the API.

- [ ] **Step 7: Commit**

```bash
git add TravelCrm.Api/Features/Leads/
git commit -m "feat(phase-1): retire Lead.Convert; add hasDeals filter, dealCount, delete-with-deals guard"
```

---

## Task 18: Frontend models in `crm.models.ts`

**Files:**
- Modify: `src/app/core/models/crm.models.ts`

- [ ] **Step 1: Add Deal/Pipeline types; deprecate Opportunity**

In `crm.models.ts`, find the existing `Opportunity` / `OpportunityStage` types. Mark them deprecated (leave for the time being so the old pipeline stub still compiles until Task 26 deletes it). Below them, add:

```typescript
// ── Phase 1: Deals & Pipelines ───────────────────────────────────────────────

export type PipelineStageKind = 'Open' | 'Won' | 'Lost';
export type DealStatus        = 'Open' | 'Won' | 'Lost';

export interface PipelineStageDto {
  id: string;
  pipelineId: string;
  name: string;
  sortOrder: number;
  defaultProbability: number;
  kind: PipelineStageKind;
  colorHex: string;
  isActive: boolean;
  dealCount: number;
}

export interface PipelineDto {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  dealCount: number;
  stages: PipelineStageDto[];
}

export interface DealActivityDto {
  id: string;
  occurredAt: string;
  actorUserId: string | null;
  actorName: string | null;
  kind: 'Created' | 'StageChanged' | 'OwnerChanged' | 'ValueChanged'
      | 'Closed' | 'Reopened' | 'Note';
  fromValue: string | null;
  toValue: string | null;
  note: string | null;
}

export interface DealDto {
  id: string;
  title: string;
  pipelineId: string;
  pipelineName: string;
  stageId: string;
  stageName: string;
  stageKind: PipelineStageKind;
  stageColor: string;
  leadId: string | null;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  companyName: string | null;
  value: number | null;
  currency: string;
  probability: number;
  expectedCloseDate: string | null;
  actualCloseDate: string | null;
  ownerUserId: string;
  ownerName: string | null;
  tags: string[];
  notes: string | null;
  status: DealStatus;
  rowVersion: string;
  createdAt: string;
  updatedAt: string | null;
  recentActivity: DealActivityDto[] | null;
}

export interface KanbanColumnDto {
  stageId: string;
  stageName: string;
  stageKind: PipelineStageKind;
  stageColor: string;
  sortOrder: number;
  probability: number;
  deals: DealDto[];
  totalCount: number;
  totalValue: number | null;
  totalValueByCurrency: Record<string, number>;
}

export interface KanbanDto {
  pipelineId: string;
  pipelineName: string;
  columns: KanbanColumnDto[];
}
```

- [ ] **Step 2: Build the Angular app**

```bash
cd D:/ClaudeProjects/TravelCRMPlus && npx ng build --configuration development 2>&1 | tail -5
```

Expected: `Output location: ...` (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/app/core/models/crm.models.ts
git commit -m "feat(phase-1): TypeScript types — Deal, Pipeline, PipelineStage, DealActivity, Kanban"
```

---

## Task 19: PipelinesService

**Files:**
- Create: `src/app/core/services/pipelines.service.ts`

- [ ] **Step 1: Create the service**

```typescript
import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-base-url.token';
import { PipelineDto, PipelineStageKind } from '../models/crm.models';

/**
 * Tenant-scoped pipelines + stages CRUD. Signal-cached list because pickers
 * appear in 3+ places (kanban header, deals list filter, deal form).
 *
 * EnvelopeInterceptor unwraps `{success, data}` so methods see bare DTOs.
 */
@Injectable({ providedIn: 'root' })
export class PipelinesService {
  private readonly http    = inject(HttpClient);
  private readonly apiBase = inject(API_BASE_URL);

  private readonly _pipelines = signal<PipelineDto[]>([]);
  readonly pipelines = this._pipelines.asReadonly();

  /** Tenant's default pipeline (or first active). */
  readonly defaultPipeline = computed(() =>
    this._pipelines().find(p => p.isDefault) ??
    this._pipelines().find(p => p.isActive) ??
    null);

  list(includeInactive = false): Observable<PipelineDto[]> {
    const params = includeInactive ? '?includeInactive=true' : '';
    return this.http
      .get<PipelineDto[]>(`${this.apiBase}/api/crm/pipelines${params}`)
      .pipe(tap(p => this._pipelines.set(p)));
  }

  get(id: string): Observable<PipelineDto> {
    return this.http.get<PipelineDto>(`${this.apiBase}/api/crm/pipelines/${id}`);
  }

  create(body: {
    name: string;
    description?: string | null;
    isDefault: boolean;
    initialStages?: Array<{ name: string; probability: number; kind: PipelineStageKind; colorHex: string }>;
  }): Observable<PipelineDto> {
    return this.http.post<PipelineDto>(`${this.apiBase}/api/crm/pipelines`, body);
  }

  update(id: string, body: {
    name: string;
    description?: string | null;
    isActive: boolean;
    isDefault: boolean;
  }): Observable<{ id: string }> {
    return this.http.put<{ id: string }>(`${this.apiBase}/api/crm/pipelines/${id}`, body);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiBase}/api/crm/pipelines/${id}`);
  }

  // ── Stages ──────────────────────────────────────────────────────────────

  addStage(pipelineId: string, body: {
    name: string; probability: number; kind: PipelineStageKind; colorHex: string; sortOrder?: number;
  }) {
    return this.http.post(`${this.apiBase}/api/crm/pipelines/${pipelineId}/stages`, body);
  }

  updateStage(pipelineId: string, stageId: string, body: {
    name: string; probability: number; kind: PipelineStageKind; colorHex: string; isActive: boolean;
  }) {
    return this.http.put(`${this.apiBase}/api/crm/pipelines/${pipelineId}/stages/${stageId}`, body);
  }

  deleteStage(pipelineId: string, stageId: string) {
    return this.http.delete(`${this.apiBase}/api/crm/pipelines/${pipelineId}/stages/${stageId}`);
  }

  reorderStages(pipelineId: string, stageIds: string[]) {
    return this.http.put(`${this.apiBase}/api/crm/pipelines/${pipelineId}/stages/reorder`, { stageIds });
  }

  clear(): void { this._pipelines.set([]); }
}
```

- [ ] **Step 2: Build + commit**

```bash
cd D:/ClaudeProjects/TravelCRMPlus && npx ng build --configuration development 2>&1 | tail -3
git add src/app/core/services/pipelines.service.ts
git commit -m "feat(phase-1): PipelinesService — signal-cached, CRUD + stage ops"
```

---

## Task 20: DealsService

**Files:**
- Create: `src/app/core/services/deals.service.ts`

- [ ] **Step 1: Create**

```typescript
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-base-url.token';
import { DealActivityDto, DealDto, DealStatus, KanbanDto } from '../models/crm.models';

export interface PagedDeals { items: DealDto[]; total: number; }

@Injectable({ providedIn: 'root' })
export class DealsService {
  private readonly http    = inject(HttpClient);
  private readonly apiBase = inject(API_BASE_URL);

  /** Last-fetched kanban — shared between kanban view + deal cards. */
  private readonly _kanban = signal<KanbanDto | null>(null);
  readonly kanban = this._kanban.asReadonly();

  list(filters: {
    pipelineId?: string; stageId?: string; ownerUserId?: string;
    status?: DealStatus; hasLead?: boolean; search?: string;
    page?: number; pageSize?: number;
  } = {}): Observable<PagedDeals> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params = params.set(k, String(v));
    });
    return this.http.get<PagedDeals>(`${this.apiBase}/api/crm/deals`, { params });
  }

  getKanban(pipelineId?: string): Observable<KanbanDto> {
    const params = pipelineId ? new HttpParams().set('pipelineId', pipelineId) : undefined;
    return this.http
      .get<KanbanDto>(`${this.apiBase}/api/crm/deals/kanban`, { params })
      .pipe(tap(k => this._kanban.set(k)));
  }

  get(id: string): Observable<DealDto> {
    return this.http.get<DealDto>(`${this.apiBase}/api/crm/deals/${id}`);
  }

  create(body: {
    leadId?: string; title: string;
    contactName: string; contactEmail?: string; contactPhone?: string; companyName?: string;
    pipelineId?: string; stageId?: string;
    value?: number; currency?: string; probability?: number;
    expectedCloseDate?: string; ownerUserId?: string;
    tags?: string[]; notes?: string;
  }): Observable<DealDto> {
    return this.http.post<DealDto>(`${this.apiBase}/api/crm/deals`, body);
  }

  update(id: string, body: {
    rowVersion: string; title: string;
    value: number | null; currency: string; probability: number;
    expectedCloseDate: string | null; tags: string[]; notes: string | null;
  }): Observable<DealDto> {
    return this.http.put<DealDto>(`${this.apiBase}/api/crm/deals/${id}`, body);
  }

  move(id: string, body: { rowVersion: string; stageId: string; note?: string }): Observable<DealDto> {
    return this.http.post<DealDto>(`${this.apiBase}/api/crm/deals/${id}/move`, body);
  }

  reassign(id: string, body: { rowVersion: string; ownerUserId: string; note?: string }): Observable<DealDto> {
    return this.http.post<DealDto>(`${this.apiBase}/api/crm/deals/${id}/reassign`, body);
  }

  addNote(id: string, note: string): Observable<DealActivityDto> {
    return this.http.post<DealActivityDto>(`${this.apiBase}/api/crm/deals/${id}/notes`, { note });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiBase}/api/crm/deals/${id}`);
  }

  clear(): void { this._kanban.set(null); }
}
```

- [ ] **Step 2: Build + commit**

```bash
cd D:/ClaudeProjects/TravelCRMPlus && npx ng build --configuration development 2>&1 | tail -3
git add src/app/core/services/deals.service.ts
git commit -m "feat(phase-1): DealsService — list/kanban/CRUD/move/reassign/notes"
```

---

## Task 21: Pipelines list + edit components

**Files:**
- Create: `src/app/pages/crm/pipelines/pipeline-list/pipeline-list.component.ts`
- Create: `src/app/pages/crm/pipelines/pipeline-edit/pipeline-edit.component.ts`

This is a meaty UI task. Implementation outline:

- `PipelineListComponent`: table of all pipelines with name, deal count, stage count, default badge, actions (Edit, Delete, Set Default). Loads from `PipelinesService.list(includeInactive: true)`. New-pipeline dialog inline.
- `PipelineEditComponent`: route at `/crm/pipelines/:id`. Shows pipeline metadata form at top + CDK `cdkDragDrop` reorderable stages table below. Per-row: name input, color picker (`<input type="color">`), probability number input, Kind `<mat-select>` (Open/Won/Lost), Active toggle, Delete button. "+ Add stage" appends.

- [ ] **Step 1: Implement `PipelineListComponent`**

Mirror the styling of `pages/settings/subscriptions/plans/subscription-plans.component.ts` (token-driven CSS, MatTable, dark-mode tokens). Use the EntitlementsService `*hasFeature="'deals'"` gate at the route level (covered in Task 26). Permission check inline:

```typescript
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { PipelinesService } from 'src/app/core/services/pipelines.service';
import { PipelineDto } from 'src/app/core/models/crm.models';

@Component({
  selector: 'app-pipeline-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterLink,
    MatButtonModule, MatCardModule, MatDialogModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatTableModule, MatTooltipModule,
    TablerIconsModule,
  ],
  template: `
    <div class="pl-page">
      <div class="pl-header">
        <div>
          <h2 class="pl-title">Pipelines</h2>
          <p class="pl-sub">Configure the stages each pipeline follows.</p>
        </div>
        <button mat-flat-button color="primary" (click)="newPipeline()">
          <i-tabler name="plus" class="icon-sm mr-1"></i-tabler> New pipeline
        </button>
      </div>

      @if (loading()) {
        <div class="loading-wrap"><mat-spinner diameter="32"></mat-spinner></div>
      } @else {
        <mat-card>
          <mat-card-content class="p-0">
            <table mat-table [dataSource]="pipelines()" class="pl-table">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Pipeline</th>
                <td mat-cell *matCellDef="let p">
                  <a [routerLink]="['/crm/pipelines', p.id]" class="pl-link">{{ p.name }}</a>
                  @if (p.isDefault) { <span class="pl-pill pl-pill-default">Default</span> }
                  @if (!p.isActive) { <span class="pl-pill pl-pill-inactive">Inactive</span> }
                </td>
              </ng-container>
              <ng-container matColumnDef="stages">
                <th mat-header-cell *matHeaderCellDef>Stages</th>
                <td mat-cell *matCellDef="let p">{{ p.stages.length }}</td>
              </ng-container>
              <ng-container matColumnDef="deals">
                <th mat-header-cell *matHeaderCellDef>Deals</th>
                <td mat-cell *matCellDef="let p">{{ p.dealCount }}</td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let p" class="actions">
                  <a mat-stroked-button [routerLink]="['/crm/pipelines', p.id]">
                    <i-tabler name="pencil" class="icon-xs mr-1"></i-tabler> Edit
                  </a>
                  <button mat-stroked-button color="warn"
                          [disabled]="p.dealCount > 0 || p.isDefault"
                          [matTooltip]="p.dealCount > 0 ? 'Move deals first' : (p.isDefault ? 'Cannot delete default' : '')"
                          (click)="deletePipeline(p)">
                    <i-tabler name="trash" class="icon-xs"></i-tabler>
                  </button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="cols"></tr>
              <tr mat-row *matRowDef="let row; columns: cols"></tr>
            </table>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    :host { --pl-bg: #fff; --pl-border: #f1f5f9; --pl-text-hi: #0f172a; --pl-text-muted: #64748b; }
    :host-context(.dark-theme) { --pl-bg: #1a2537; --pl-border: #2e3f50; --pl-text-hi: rgba(255,255,255,.9); --pl-text-muted: rgba(255,255,255,.5); }
    .pl-page { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
    .pl-header { display: flex; justify-content: space-between; align-items: center; }
    .pl-title { margin: 0; font-size: 20px; font-weight: 700; color: var(--pl-text-hi); }
    .pl-sub   { margin: 2px 0 0; font-size: 13px; color: var(--pl-text-muted); }
    .loading-wrap { display: flex; justify-content: center; padding: 40px; }
    .pl-table { width: 100%; }
    .pl-table .mat-mdc-header-cell { padding: 12px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: var(--pl-text-muted); }
    .pl-table .mat-mdc-cell { padding: 12px 16px; }
    .pl-link { font-weight: 600; color: var(--pl-text-hi); text-decoration: none; }
    .pl-link:hover { text-decoration: underline; }
    .pl-pill { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-left: 8px; }
    .pl-pill-default  { background: #dbeafe; color: #1d4ed8; }
    .pl-pill-inactive { background: #f1f5f9; color: #64748b; }
    .actions { display: flex; gap: 8px; justify-content: flex-end; }
    .icon-xs { width: 14px; height: 14px; }
    .mr-1 { margin-right: 4px; }
  `],
})
export class PipelineListComponent implements OnInit {
  private readonly api    = inject(PipelinesService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly snack  = inject(MatSnackBar);

  readonly cols      = ['name', 'stages', 'deals', 'actions'];
  readonly pipelines = signal<PipelineDto[]>([]);
  readonly loading   = signal(true);

  ngOnInit(): void { this.refresh(); }

  refresh(): void {
    this.loading.set(true);
    this.api.list(true).subscribe({
      next: ps => { this.pipelines.set(ps); this.loading.set(false); },
      error: () => { this.loading.set(false); this.snack.open('Failed to load pipelines.', 'Close', { duration: 3500 }); },
    });
  }

  newPipeline(): void {
    // Simplest path: create with defaults, jump to edit page
    this.api.create({ name: 'New Pipeline', isDefault: false }).subscribe({
      next: p => this.router.navigate(['/crm/pipelines', p.id]),
      error: err => this.snack.open(err?.error?.error ?? 'Create failed.', 'Close', { duration: 3500 }),
    });
  }

  deletePipeline(p: PipelineDto): void {
    if (!confirm(`Delete pipeline "${p.name}"?`)) return;
    this.api.delete(p.id).subscribe({
      next: () => this.refresh(),
      error: err => this.snack.open(err?.error?.error ?? 'Delete failed.', 'Close', { duration: 3500 }),
    });
  }
}
```

- [ ] **Step 2: Implement `PipelineEditComponent`**

This is large — use a focused implementation with CDK drag-drop on the stages list. Skeleton:

```typescript
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TablerIconsModule } from 'angular-tabler-icons';
import { PipelinesService } from 'src/app/core/services/pipelines.service';
import { PipelineDto, PipelineStageDto, PipelineStageKind } from 'src/app/core/models/crm.models';

@Component({
  selector: 'app-pipeline-edit',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterLink, FormsModule, ReactiveFormsModule, DragDropModule,
    MatButtonModule, MatCardModule, MatCheckboxModule, MatFormFieldModule,
    MatInputModule, MatProgressSpinnerModule, MatSelectModule, MatSlideToggleModule,
    MatSnackBarModule, MatTooltipModule, TablerIconsModule,
  ],
  template: `
    <div class="pe-page">
      <a routerLink="/crm/pipelines" class="pe-back">
        <i-tabler name="arrow-left" class="icon-xs"></i-tabler> Back to pipelines
      </a>

      @if (loading()) {
        <div class="loading-wrap"><mat-spinner diameter="32"></mat-spinner></div>
      } @else if (pipeline(); as p) {
        <mat-card>
          <mat-card-content>
            <form [formGroup]="form" class="pe-form">
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="flex-2">
                <mat-label>Pipeline name *</mat-label>
                <input matInput formControlName="name" maxlength="100">
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="flex-3">
                <mat-label>Description</mat-label>
                <input matInput formControlName="description" maxlength="500">
              </mat-form-field>
              <mat-slide-toggle formControlName="isDefault">Default</mat-slide-toggle>
              <mat-slide-toggle formControlName="isActive">Active</mat-slide-toggle>
            </form>

            <h3 class="pe-stages-title">Stages</h3>
            <p class="pe-help">Drag rows to reorder.</p>

            <div cdkDropList (cdkDropListDropped)="onDrop($event)" class="pe-stages">
              @for (s of stages(); track s.id) {
                <div cdkDrag class="pe-stage">
                  <i-tabler name="grip-vertical" class="pe-drag" cdkDragHandle></i-tabler>
                  <input class="pe-stage-name" [(ngModel)]="s.name" maxlength="100">
                  <input type="color" [(ngModel)]="s.colorHex" class="pe-color">
                  <input type="number" class="pe-prob" min="0" max="100"
                         [(ngModel)]="s.defaultProbability"> %
                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="pe-kind">
                    <mat-select [(ngModel)]="s.kind">
                      <mat-option value="Open">Open</mat-option>
                      <mat-option value="Won">Won</mat-option>
                      <mat-option value="Lost">Lost</mat-option>
                    </mat-select>
                  </mat-form-field>
                  <mat-slide-toggle [(ngModel)]="s.isActive">Active</mat-slide-toggle>
                  <button mat-icon-button color="warn"
                          [disabled]="s.dealCount > 0"
                          [matTooltip]="s.dealCount > 0 ? 'Move deals first' : 'Delete stage'"
                          (click)="deleteStage(s)">
                    <i-tabler name="trash" class="icon-xs"></i-tabler>
                  </button>
                </div>
              }
            </div>

            <button mat-stroked-button (click)="addStage()" class="pe-add">
              <i-tabler name="plus" class="icon-xs mr-1"></i-tabler> Add stage
            </button>

            <div class="pe-actions">
              <button mat-flat-button color="primary" (click)="saveAll()" [disabled]="saving()">
                {{ saving() ? 'Saving…' : 'Save all changes' }}
              </button>
            </div>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .pe-page { padding: 20px; max-width: 1100px; }
    .pe-back { font-size: 13px; color: #64748b; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 12px; }
    .loading-wrap { display: flex; justify-content: center; padding: 40px; }
    .pe-form { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin-bottom: 24px; }
    .flex-2 { flex: 2 1 220px; } .flex-3 { flex: 3 1 320px; }
    .pe-stages-title { margin: 0; font-size: 16px; font-weight: 700; }
    .pe-help { margin: 4px 0 12px; font-size: 12px; color: #94a3b8; }
    .pe-stages { display: flex; flex-direction: column; gap: 6px; }
    .pe-stage { display: flex; align-items: center; gap: 12px; padding: 8px 12px; background: #fafafa; border: 1px solid #e2e8f0; border-radius: 8px; }
    .pe-drag { cursor: grab; color: #94a3b8; }
    .pe-stage-name { flex: 1; border: 1px solid #e2e8f0; padding: 6px 10px; border-radius: 6px; }
    .pe-color { width: 36px; height: 28px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0; }
    .pe-prob { width: 64px; padding: 6px 8px; border: 1px solid #e2e8f0; border-radius: 6px; }
    .pe-kind { width: 120px; }
    .pe-add { margin-top: 12px; }
    .pe-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; padding-top: 12px; border-top: 1px solid #f1f5f9; }
    .icon-xs { width: 14px; height: 14px; }
    .mr-1 { margin-right: 4px; }
  `],
})
export class PipelineEditComponent implements OnInit {
  private readonly api    = inject(PipelinesService);
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snack  = inject(MatSnackBar);
  private readonly fb     = inject(FormBuilder);

  readonly pipeline = signal<PipelineDto | null>(null);
  readonly stages   = signal<PipelineStageDto[]>([]);
  readonly loading  = signal(true);
  readonly saving   = signal(false);

  form = this.fb.group({
    name:        ['', [Validators.required, Validators.maxLength(100)]],
    description: [''],
    isDefault:   [false],
    isActive:    [true],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.get(id).subscribe({
      next: p => {
        this.pipeline.set(p);
        this.stages.set([...p.stages]);
        this.form.patchValue({ name: p.name, description: p.description ?? '', isDefault: p.isDefault, isActive: p.isActive });
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.snack.open('Failed to load pipeline.', 'Close', { duration: 3500 }); },
    });
  }

  onDrop(e: CdkDragDrop<PipelineStageDto[]>) {
    const next = [...this.stages()];
    moveItemInArray(next, e.previousIndex, e.currentIndex);
    this.stages.set(next);
  }

  addStage(): void {
    const id = this.pipeline()!.id;
    this.api.addStage(id, { name: 'New Stage', probability: 50, kind: 'Open', colorHex: '#94a3b8' }).subscribe({
      next: (created: any) => this.stages.update(curr => [...curr, created]),
      error: err => this.snack.open(err?.error?.error ?? 'Add failed.', 'Close', { duration: 3500 }),
    });
  }

  deleteStage(s: PipelineStageDto): void {
    if (!confirm(`Delete stage "${s.name}"?`)) return;
    const id = this.pipeline()!.id;
    this.api.deleteStage(id, s.id).subscribe({
      next: () => this.stages.update(curr => curr.filter(x => x.id !== s.id)),
      error: err => this.snack.open(err?.error?.error ?? 'Delete failed.', 'Close', { duration: 3500 }),
    });
  }

  saveAll(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const id = this.pipeline()!.id;
    const v = this.form.getRawValue();

    // Save pipeline metadata first
    this.api.update(id, {
      name: v.name!, description: v.description, isActive: v.isActive!, isDefault: v.isDefault!,
    }).subscribe({
      next: () => {
        // Save each stage's fields
        const stageSaves = this.stages().map(s =>
          this.api.updateStage(id, s.id, {
            name: s.name, probability: s.defaultProbability, kind: s.kind,
            colorHex: s.colorHex, isActive: s.isActive,
          }));
        // Then reorder
        const reorder = this.api.reorderStages(id, this.stages().map(s => s.id));
        Promise.all(stageSaves.map(o => o.toPromise() as any))
          .then(() => reorder.toPromise())
          .then(() => {
            this.saving.set(false);
            this.snack.open('Pipeline saved.', 'Close', { duration: 2500 });
            this.router.navigate(['/crm/pipelines']);
          })
          .catch((err: any) => {
            this.saving.set(false);
            this.snack.open(err?.error?.error ?? 'Save failed.', 'Close', { duration: 3500 });
          });
      },
      error: err => {
        this.saving.set(false);
        this.snack.open(err?.error?.error ?? 'Save failed.', 'Close', { duration: 3500 });
      },
    });
  }
}
```

- [ ] **Step 3: Build + commit**

```bash
cd D:/ClaudeProjects/TravelCRMPlus && npx ng build --configuration development 2>&1 | tail -3
git add src/app/pages/crm/pipelines/
git commit -m "feat(phase-1): pipelines list + edit (CDK drag-drop stages, color, probability, Kind)"
```

---

## Task 22: Deal form (dual-mode SidePanel + routed)

**Files:**
- Create: `src/app/pages/crm/deals/deal-form/deal-form.component.ts`

Reuse the dual-mode pattern from `lead-form.component.ts`: `inject(SidePanelRef, { optional: true })` so the form works both inside a SidePanel and as a routed page. Form fields per spec section 4.3 (Overview section).

- [ ] **Step 1: Implement**

Use the same compact CSS-token styling pattern as Phase 0 forms. Field list:

- Title (required)
- Pipeline + Stage selects (linked — selecting pipeline filters stages)
- Contact Name (required), Contact Email, Contact Phone, Company
- Value + Currency (currency dropdown of common codes, defaults to tenant default)
- Probability slider (0–100, defaults to stage's `defaultProbability`; "Reset to default" button)
- Expected Close Date (`mat-datepicker`)
- Owner (user picker — pulls from existing users API)
- Tags (comma-separated input like LeadForm)
- Notes (textarea, 3 rows)

When opened with `data.leadId`, fetch the lead and pre-fill the contact/company snapshot fields.

Save behaviour:
- Create mode (no `dealId` in data): `dealsService.create(payload)`
- Edit mode (`dealId` provided): `dealsService.update(dealId, { rowVersion, ... })`
- On success → `panelRef?.close('saved')` or navigate to `/crm/deals`

Wire `panelRef?.setDirty(form.dirty)` in the constructor effect — same pattern as Phase 0 forms.

The full implementation is verbose. Mirror the structure of `src/app/pages/crm/leads/lead-form/lead-form.component.ts` (~280 lines) — replace its fields with the list above and wire to `DealsService` instead of `LeadsService`.

- [ ] **Step 2: Build + commit**

```bash
cd D:/ClaudeProjects/TravelCRMPlus && npx ng build --configuration development 2>&1 | tail -3
git add src/app/pages/crm/deals/deal-form/
git commit -m "feat(phase-1): DealFormComponent — Create/Edit dual-mode SidePanel form"
```

---

## Task 23: Deal list with KPIs

**Files:**
- Create: `src/app/pages/crm/deals/deal-list/deal-list.component.ts`

Mirror `LeadListComponent` (the Phase 0 redesigned version with CSS tokens, KPI strip, search pill, filter pickers, compact table). Replace the data shape with `DealDto`. Visit `/crm/deals`.

- [ ] **Step 1: Implement**

Structure (use the existing LeadListComponent as the visual template):

- **KPI strip (4 stats)**:
  - Open deals (count)
  - Pipeline value — sum value where `status='Open'`, displayed as `₹X · $Y · €Z` (one line per distinct currency)
  - Weighted forecast — `Σ (value × probability/100)` for open deals, again per currency
  - Won this month — count of `status='Won' AND actualCloseDate >= startOfMonth`
- **Filters** (compact pills in the search bar):
  - Pipeline picker (loads from `pipelinesService.list()`)
  - Stage picker (resets when pipeline changes)
  - Owner picker (loads tenant users)
  - Status select (Open / Won / Lost / All)
  - Free-text search
- **Table** (same density as leads list):
  - Title (with stage-color dot prefix), Contact, Company, Value (formatted with currency), Owner, Expected Close, Updated. Row hover, click opens DealDetail in SidePanel.
- **"+ Add Deal"** opens `DealFormComponent` in SidePanel (Task 22).

Use the same CSS variables / dark-mode token pattern from `LeadListComponent`. Wrap the page-level entry points in `*hasFeature="'deals'"` — but this is mostly a route-level concern (Task 26).

Build + commit:

```bash
cd D:/ClaudeProjects/TravelCRMPlus && npx ng build --configuration development 2>&1 | tail -3
git add src/app/pages/crm/deals/deal-list/
git commit -m "feat(phase-1): DealListComponent — KPI strip, filter pills, compact table"
```

---

## Task 24: Deal detail SidePanel

**Files:**
- Create: `src/app/pages/crm/deals/deal-detail/deal-detail.component.ts`

`DealFormComponent` (Task 22) handles **create + edit overview fields**. `DealDetailComponent` is what opens on row-click in the list: same Overview section in edit mode, plus the **Activity feed** + **Reassign owner** + **Add note** actions.

- [ ] **Step 1: Implement**

Component opens via SidePanel with `{ dealId }` in data. On open:

1. `dealsService.get(dealId)` to fetch with embedded activity
2. Render header: `{deal.title}` + breadcrumb `{pipelineName} → {stageName}` pill
3. Stage quick-change `<mat-select>` at top — on change, calls `dealsService.move(id, { rowVersion, stageId })`. If `newStage.kind != 'Open'`, show a `MatDialog` confirm first (Won/Lost gate).
4. Sections (single SidePanel, scrollable):
   - **Overview** (mirrors DealForm in edit mode)
   - **Activity**: reverse-chrono list of `DealActivityDto` with icons per `kind`, actor avatar (initials in coloured circle), relative time (`{{ activity.occurredAt | date:'short' }}`)
   - **Actions row**: Reassign Owner button (opens small picker dialog → `dealsService.reassign(...)`), Add Note (inline textarea + Save → `dealsService.addNote(...)`), Delete (only enabled when `status='Open'`)

Use the same dual-mode pattern: `inject(SidePanelRef, { optional: true })` so this also works as `/crm/deals/:id` routed page.

On 409 (concurrency conflict): catch the error, toast `"This deal was updated by someone else — refreshing"`, re-call `dealsService.get(dealId)`.

```bash
cd D:/ClaudeProjects/TravelCRMPlus && npx ng build --configuration development 2>&1 | tail -3
git add src/app/pages/crm/deals/deal-detail/
git commit -m "feat(phase-1): DealDetailComponent — overview + activity feed + reassign/note/delete"
```

---

## Task 25: Deals kanban with CDK drag-drop

**Files:**
- Create: `src/app/pages/crm/deals/deals-kanban/deals-kanban.component.ts`

The centrepiece. Uses Angular CDK `cdkDropList` per column, `cdkDrag` per card, with cross-list drop.

- [ ] **Step 1: Implement core layout**

```typescript
import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule, transferArrayItem } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { TablerIconsModule } from 'angular-tabler-icons';
import { DealsService } from 'src/app/core/services/deals.service';
import { PipelinesService } from 'src/app/core/services/pipelines.service';
import { SidePanelService } from 'src/app/shared/side-panel';
import { DealDto, KanbanColumnDto, KanbanDto, PipelineDto } from 'src/app/core/models/crm.models';

@Component({
  selector: 'app-deals-kanban',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, DragDropModule,
    MatButtonModule, MatDialogModule, MatFormFieldModule, MatProgressSpinnerModule,
    MatSelectModule, MatSnackBarModule, TablerIconsModule,
  ],
  template: `
    <div class="kb-page">
      <div class="kb-header">
        <div>
          <h2 class="kb-title">Sales Pipeline</h2>
          @if (kanban(); as k) {
            <p class="kb-sub">{{ totalOpenCount() }} open deals · {{ pipelineValueLabel() }}</p>
          }
        </div>
        <div class="kb-controls">
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="kb-pipeline-picker">
            <mat-label>Pipeline</mat-label>
            <mat-select [(ngModel)]="selectedPipelineId" (ngModelChange)="onPipelineChange($event)">
              @for (p of pipelines(); track p.id) {
                <mat-option [value]="p.id">{{ p.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <button mat-flat-button color="primary" (click)="addDeal()">
            <i-tabler name="plus" class="icon-sm mr-1"></i-tabler> New deal
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="loading-wrap"><mat-spinner diameter="32"></mat-spinner></div>
      } @else if (kanban(); as k) {
        <div class="kb-columns" cdkDropListGroup>
          @for (col of k.columns; track col.stageId) {
            <div class="kb-col" [style.--col-color]="col.stageColor"
                 cdkDropList
                 [cdkDropListData]="col.deals"
                 [id]="col.stageId"
                 (cdkDropListDropped)="onDrop($event)">
              <div class="kb-col-head">
                <span class="kb-col-name">{{ col.stageName }}</span>
                <span class="kb-col-count">{{ col.totalCount }}</span>
              </div>
              @for (d of col.deals; track d.id) {
                <div class="kb-card" cdkDrag (click)="openDeal(d)">
                  <div class="kb-card-title">{{ d.title }}</div>
                  <div class="kb-card-meta">
                    @if (d.value !== null) {
                      <span class="kb-value">{{ d.value | number:'1.0-0' }} {{ d.currency }}</span>
                    }
                    <span class="kb-owner" [title]="d.ownerName">{{ ownerInitials(d.ownerName) }}</span>
                  </div>
                  @if (d.contactName) {
                    <div class="kb-contact">{{ d.contactName }}{{ d.companyName ? ' · ' + d.companyName : '' }}</div>
                  }
                </div>
              }
              @if (col.deals.length === 0) {
                <div class="kb-empty">No deals — drag here</div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .kb-page { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
    .kb-header { display: flex; justify-content: space-between; align-items: flex-end; }
    .kb-title { margin: 0; font-size: 20px; font-weight: 700; }
    .kb-sub   { margin: 2px 0 0; font-size: 13px; color: #64748b; }
    .kb-controls { display: flex; gap: 12px; align-items: center; }
    .kb-pipeline-picker { width: 220px; }
    .loading-wrap { display: flex; justify-content: center; padding: 40px; }
    .kb-columns { display: flex; gap: 12px; overflow-x: auto; min-height: 60vh; padding-bottom: 8px; }
    .kb-col {
      flex: 0 0 280px; background: #f8fafc; border-radius: 10px; padding: 10px;
      border-top: 3px solid var(--col-color); display: flex; flex-direction: column; gap: 8px;
    }
    .kb-col-head { display: flex; justify-content: space-between; align-items: center; padding: 4px 4px 6px; }
    .kb-col-name { font-size: 13px; font-weight: 700; color: #0f172a; }
    .kb-col-count {
      display: inline-block; min-width: 24px; text-align: center;
      background: #fff; border-radius: 12px; padding: 2px 8px; font-size: 11px;
      color: #64748b; border: 1px solid #e2e8f0;
    }
    .kb-card {
      background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
      padding: 10px 12px; cursor: pointer; transition: box-shadow 120ms;
    }
    .kb-card:hover { box-shadow: 0 4px 8px rgba(15,23,42,.08); }
    .kb-card-title { font-size: 13px; font-weight: 600; color: #0f172a; margin-bottom: 4px; }
    .kb-card-meta { display: flex; justify-content: space-between; align-items: center; }
    .kb-value { font-size: 13px; font-weight: 700; color: #0f172a; }
    .kb-owner {
      width: 22px; height: 22px; border-radius: 50%; background: #6366f1; color: #fff;
      font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center;
    }
    .kb-contact { font-size: 11.5px; color: #64748b; margin-top: 4px; }
    .kb-empty {
      padding: 16px; text-align: center; font-size: 12px; color: #94a3b8;
      border: 2px dashed #e2e8f0; border-radius: 8px;
    }
    .cdk-drag-placeholder { opacity: 0.4; }
    .cdk-drag-preview { box-shadow: 0 8px 24px rgba(15,23,42,.15); }
    .icon-sm { width: 16px; height: 16px; }
    .mr-1 { margin-right: 4px; }
  `],
})
export class DealsKanbanComponent implements OnInit {
  private readonly deals     = inject(DealsService);
  private readonly pipelines = inject(PipelinesService);
  private readonly sidePanel = inject(SidePanelService);
  private readonly snack     = inject(MatSnackBar);

  readonly loading           = signal(true);
  readonly kanban            = signal<KanbanDto | null>(null);
  readonly pipelinesList     = signal<PipelineDto[]>([]);
  readonly pipelines$        = this.pipelinesList.asReadonly();
  selectedPipelineId: string | null = null;

  readonly totalOpenCount = computed(() => {
    const k = this.kanban();
    if (!k) return 0;
    return k.columns.filter(c => c.stageKind === 'Open').reduce((s, c) => s + c.totalCount, 0);
  });

  readonly pipelineValueLabel = computed(() => {
    const k = this.kanban();
    if (!k) return '';
    const sums: Record<string, number> = {};
    for (const c of k.columns) {
      if (c.stageKind !== 'Open') continue;
      for (const [cur, sum] of Object.entries(c.totalValueByCurrency)) {
        sums[cur] = (sums[cur] ?? 0) + sum;
      }
    }
    return Object.entries(sums).map(([cur, s]) => `${s.toLocaleString()} ${cur}`).join(' · ') || '—';
  });

  ngOnInit(): void {
    this.pipelines.list().subscribe(ps => {
      this.pipelinesList.set(ps);
      const def = this.pipelines.defaultPipeline();
      this.selectedPipelineId = def?.id ?? ps[0]?.id ?? null;
      this.loadKanban();
    });
  }

  pipelines(): PipelineDto[] { return this.pipelinesList(); }

  loadKanban(): void {
    if (!this.selectedPipelineId) { this.loading.set(false); return; }
    this.loading.set(true);
    this.deals.getKanban(this.selectedPipelineId).subscribe({
      next: k => { this.kanban.set(k); this.loading.set(false); },
      error: () => { this.loading.set(false); this.snack.open('Failed to load kanban.', 'Close', { duration: 3500 }); },
    });
  }

  onPipelineChange(pid: string): void {
    this.selectedPipelineId = pid;
    this.loadKanban();
  }

  onDrop(e: CdkDragDrop<DealDto[]>): void {
    if (e.previousContainer === e.container) return;  // same-column reorder: no-op for now
    const card = e.previousContainer.data[e.previousIndex];
    const toStageId = e.container.id;

    // Optimistic move
    transferArrayItem(e.previousContainer.data, e.container.data, e.previousIndex, e.currentIndex);
    this.kanban.update(k => k ? { ...k } : k);  // trigger change-detect

    const toColumn = this.kanban()!.columns.find(c => c.stageId === toStageId)!;
    if (toColumn.stageKind !== 'Open') {
      // Won/Lost confirmation
      const note = prompt(`Close deal "${card.title}" as ${toColumn.stageName}? Optional close note:`);
      if (note === null) {
        // user cancelled — revert
        transferArrayItem(e.container.data, e.previousContainer.data, e.currentIndex, e.previousIndex);
        return;
      }
      this.commitMove(card, toStageId, note || undefined);
      return;
    }
    this.commitMove(card, toStageId);
  }

  private commitMove(card: DealDto, toStageId: string, note?: string): void {
    this.deals.move(card.id, { rowVersion: card.rowVersion, stageId: toStageId, note }).subscribe({
      next: () => this.loadKanban(),
      error: err => {
        if (err?.error?.error === 'concurrency_conflict') {
          this.snack.open('This deal was just updated by someone else — refreshing.', 'Close', { duration: 3500 });
        } else {
          this.snack.open(err?.error?.error ?? 'Move failed.', 'Close', { duration: 3500 });
        }
        this.loadKanban();
      },
    });
  }

  ownerInitials(name: string | null): string {
    if (!name) return '?';
    const parts = name.split(' ').filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
  }

  addDeal(): void {
    const ref = this.sidePanel.open(/* DealFormComponent from Task 22 */ null as any, {
      title: 'New Deal', subtitle: 'Add a deal to the pipeline', width: '560px',
      data: { pipelineId: this.selectedPipelineId },
    });
    ref.afterClosed().subscribe(r => { if (r === 'saved') this.loadKanban(); });
  }

  openDeal(d: DealDto): void {
    const ref = this.sidePanel.open(/* DealDetailComponent from Task 24 */ null as any, {
      title: d.title, subtitle: `${d.pipelineName} · ${d.stageName}`, width: '560px',
      data: { dealId: d.id },
    });
    ref.afterClosed().subscribe(() => this.loadKanban());
  }
}
```

Replace the two `null as any` placeholders with imports of `DealFormComponent` (Task 22) and `DealDetailComponent` (Task 24) once they're committed.

- [ ] **Step 2: Build + commit**

```bash
cd D:/ClaudeProjects/TravelCRMPlus && npx ng build --configuration development 2>&1 | tail -3
git add src/app/pages/crm/deals/deals-kanban/
git commit -m "feat(phase-1): kanban with CDK drag-drop, optimistic UI, 409 revert, Won/Lost confirm"
```

---

## Task 26: Routes, sidebar nav, old `/crm/pipeline` redirect

**Files:**
- Modify: `src/app/pages/crm/crm.routes.ts`
- Modify: the sidebar nav file (likely `src/app/layouts/full/sidebar/sidebar-data.ts` or similar — confirm location)
- Delete: `src/app/pages/crm/pipeline/` (the stub)

- [ ] **Step 1: Update `crm.routes.ts`**

Add the new routes and the redirect. Wire `*hasFeature` via existing `canActivate` route guards if present, otherwise rely on the in-component check.

```typescript
import { Routes } from '@angular/router';

export const CrmRoutes: Routes = [
  // ... existing routes (leads, etc.)

  {
    path: 'deals',
    loadComponent: () => import('./deals/deal-list/deal-list.component').then(m => m.DealListComponent),
    data: { title: 'Deals' },
  },
  {
    path: 'deals/pipeline',
    loadComponent: () => import('./deals/deals-kanban/deals-kanban.component').then(m => m.DealsKanbanComponent),
    data: { title: 'Pipeline' },
  },
  {
    path: 'deals/:id',
    loadComponent: () => import('./deals/deal-detail/deal-detail.component').then(m => m.DealDetailComponent),
    data: { title: 'Deal' },
  },
  {
    path: 'pipelines',
    loadComponent: () => import('./pipelines/pipeline-list/pipeline-list.component').then(m => m.PipelineListComponent),
    data: { title: 'Pipelines' },
  },
  {
    path: 'pipelines/:id',
    loadComponent: () => import('./pipelines/pipeline-edit/pipeline-edit.component').then(m => m.PipelineEditComponent),
    data: { title: 'Edit Pipeline' },
  },
  // Redirect the legacy stub
  { path: 'pipeline', redirectTo: 'deals/pipeline', pathMatch: 'full' },
];
```

- [ ] **Step 2: Delete the old pipeline stub**

```bash
rm -rf src/app/pages/crm/pipeline
```

- [ ] **Step 3: Add sidebar menu entries**

Find the sidebar data source for the CRM mega-menu. Add entries for "Deals", "Pipeline", "Pipelines admin" — wrap visibility in `*hasFeature="'deals'"` (sidebar components usually accept a `featureCode` field; if not, add one to the schema).

Pattern (verify against the existing sidebar config — likely uses an icon name + route):

```typescript
{ displayName: 'Deals',          iconName: 'briefcase',  route: '/crm/deals',          featureCode: 'deals' },
{ displayName: 'Pipeline',       iconName: 'layout-kanban', route: '/crm/deals/pipeline', featureCode: 'pipeline_kanban' },
{ displayName: 'Pipelines',      iconName: 'route',      route: '/crm/pipelines',      featureCode: 'deals' },
```

If the sidebar template doesn't yet respect `featureCode`, wrap each link in `*hasFeature="..."` directly in the template.

- [ ] **Step 4: Build + commit**

```bash
cd D:/ClaudeProjects/TravelCRMPlus && npx ng build --configuration development 2>&1 | tail -3
git add src/app/pages/crm/ src/app/layouts/
git commit -m "feat(phase-1): routes + sidebar menu for deals & pipelines, redirect /crm/pipeline"
```

---

## Task 27: Lead list + lead form updates

**Files:**
- Modify: `src/app/pages/crm/leads/lead-list/lead-list.component.ts`
- Modify: `src/app/pages/crm/leads/lead-form/lead-form.component.ts`
- Modify: `src/app/core/services/leads.service.ts` (add `hasDeals` param, `dealCount` on LeadDto)

- [ ] **Step 1: Update `leads.service.ts`**

Find the `list` method, add `hasDeals?: 'true' | 'false' | undefined` to its options. Wire it into the `HttpParams`. Add `dealCount: number` to the `LeadDto` TypeScript interface.

- [ ] **Step 2: Update `lead-list.component.ts`**

1. **Replace "Convert" menu item with "Create Deal"**:

In the action menu for each row, change:

```html
<button mat-menu-item (click)="convertLead(row)">
  <i-tabler name="arrow-right" class="ll-icon-xs ll-mr"></i-tabler> Convert
</button>
```

To:

```html
<button mat-menu-item (click)="createDealFromLead(row)">
  <i-tabler name="briefcase" class="ll-icon-xs ll-mr"></i-tabler> Create Deal
</button>
```

Remove the old `convertLead()` method. Add:

```typescript
import { DealFormComponent } from '../../deals/deal-form/deal-form.component';

createDealFromLead(lead: LeadDto): void {
  const ref = this.sidePanel.open(DealFormComponent, {
    title: 'New Deal from Lead',
    subtitle: `${lead.firstName} ${lead.lastName}${lead.company ? ' · ' + lead.company : ''}`,
    width: '560px',
    data: { leadId: lead.id },
  });
  ref.afterClosed().subscribe(r => { if (r === 'saved') this.load(); });
}
```

2. **Add `hasDeals` filter pill**:

Add a third `mat-form-field` next to the Status/Source pickers:

```html
<mat-form-field appearance="outline" subscriptSizing="dynamic" class="ll-filter-field">
  <mat-label>Has deals</mat-label>
  <mat-select [(ngModel)]="hasDealsFilter" (ngModelChange)="filterByDropdown()">
    <mat-option value="">All</mat-option>
    <mat-option value="true">With deals</mat-option>
    <mat-option value="false">Without deals</mat-option>
  </mat-select>
</mat-form-field>
```

3. **Add `dealCount` badge in the Name cell**:

```html
<div class="ll-name-text">
  <span class="ll-name-primary">{{ row.firstName }} {{ row.lastName }}</span>
  @if (row.jobTitle) { <span class="ll-name-secondary">{{ row.jobTitle }}</span> }
  @if (row.dealCount > 0) {
    <span class="ll-deal-badge" matTooltip="Active and historical deals from this lead">
      {{ row.dealCount }} {{ row.dealCount === 1 ? 'deal' : 'deals' }}
    </span>
  }
</div>
```

Add a CSS rule:

```css
.ll-deal-badge {
  font-size: 10.5px; font-weight: 600; padding: 2px 8px; border-radius: 10px;
  background: #e0e7ff; color: #4338ca; align-self: flex-start; margin-top: 3px;
}
```

4. **Remove the `Converted` `<mat-option>`** from the Status select dropdown. The enum value is gone from the UI surface.

- [ ] **Step 3: Update `lead-form.component.ts`**

Add a "Deals" section in edit mode (when `lead.id` is present), below the form sections:

```html
@if (!isNew() && deals().length > 0) {
  <section class="lf-section">
    <p class="lf-section-label">Deals from this lead</p>
    @for (d of deals(); track d.id) {
      <a [routerLink]="['/crm/deals', d.id]" class="lf-deal-link">
        <span class="lf-deal-title">{{ d.title }}</span>
        <span class="lf-deal-stage" [style.background]="d.stageColor">{{ d.stageName }}</span>
        @if (d.value !== null) { <span class="lf-deal-value">{{ d.value | number:'1.0-0' }} {{ d.currency }}</span> }
      </a>
    }
  </section>
  <section class="lf-section">
    <button mat-stroked-button (click)="createDealForThisLead()">
      <i-tabler name="plus" class="icon-xs mr-1"></i-tabler> Add another deal
    </button>
  </section>
}
```

Inject `DealsService` and call `deals.list({ pipelineId: undefined })` filtered by `leadId` in `ngOnInit` after lead loads. Note: `ListDealsQuery` doesn't currently take a `leadId` filter — either:
- (a) Add a `leadId` query param (small backend tweak), or
- (b) Pull all deals for the tenant and filter client-side.

For Phase 1, do (a) — add `leadId` to `ListDealsQuery` filters (single line change in `ListDealsHandler`):

```csharp
if (q.LeadId.HasValue) query = query.Where(d => d.LeadId == q.LeadId.Value);
```

Add to the record's constructor + controller `[FromQuery]`.

- [ ] **Step 4: Build + commit**

```bash
cd D:/ClaudeProjects/TravelCRMPlus && npx ng build --configuration development 2>&1 | tail -3
cd TravelCrm.Api && dotnet build --nologo -v q
git add src/app/pages/crm/leads/ src/app/core/services/leads.service.ts \
        TravelCrm.Api/Features/Leads/Queries/ListLeadsQuery.cs \
        TravelCrm.Api/Features/Leads/LeadsController.cs \
        TravelCrm.Api/Features/Crm/Deals/Queries/ListDealsQuery.cs \
        TravelCrm.Api/Features/Crm/Deals/DealsController.cs
git commit -m "feat(phase-1): lead-side updates — Create Deal action, hasDeals filter, dealCount badge, deals section"
```

---

## Task 28: Wrap — smoke test, docs regen, graphify, push

- [ ] **Step 1: End-to-end smoke test**

Start the API + frontend:

```bash
# Terminal 1
cd D:/ClaudeProjects/TravelCRMPlus/TravelCrm.Api
dotnet run --no-build --urls http://localhost:5044

# Terminal 2
cd D:/ClaudeProjects/TravelCRMPlus
npx ng serve --port 4200
```

Browser flow (sign in as `admin@travelcrm.io` / `Admin@12345`):

1. Visit `/crm/leads` — confirm Convert menu item is replaced by "Create Deal"
2. Click Create Deal on any lead → SidePanel opens pre-filled with the lead snapshot → Save
3. Visit `/crm/deals` — see the new deal in the list, KPI strip totals reflect it
4. Click the deal → SidePanel detail opens with activity feed showing "Created"
5. Visit `/crm/deals/pipeline` — see the deal in the first column; drag it to a different column → confirm activity log entry appears
6. Drag the deal to "Closed Won" → confirm dialog appears → confirm with note → ActualCloseDate populates
7. Try to delete the closed deal from the detail view → 409 "Closed deals are immutable"
8. Visit `/crm/pipelines/:id` — drag a stage to reorder → save → verify in `/crm/deals/pipeline`
9. Drop a deal on Won, then drop again (concurrent simulation via two browser tabs): second drop returns 409 with refresh toast

- [ ] **Step 2: Regenerate implemented-modules.docx**

Edit `docs/generate-implemented-modules.js`:

In the `crmRows` array, **replace** the seven frontend-only stub rows (Companies through Reports) with:

```javascript
const crmRows = [
  { module: 'Leads', backend: 'Features/Leads + LeadsController', frontend: 'pages/crm/leads/ (list + form)', status: 'Full' },
  { module: 'Deals', backend: 'Features/Crm/Deals + DealsController (9 endpoints)', frontend: 'pages/crm/deals/ (list, kanban, detail)', status: 'Full' },
  { module: 'Pipelines (configurable stages)', backend: 'Features/Crm/Pipelines + PipelinesController (9 endpoints)', frontend: 'pages/crm/pipelines/ (list + drag-drop edit)', status: 'Full' },
  { module: 'Tasks (CRM)', backend: 'Features/Tasks + TasksController', frontend: 'apps/task/', status: 'Full' },
  { module: 'Time Entries', backend: 'Features/TimeEntries + TimeEntriesController', frontend: 'embedded in task detail', status: 'Full' },
  { module: 'Reminders', backend: 'Features/Reminders + RemindersController', frontend: 'pages/reminders/', status: 'Full' },
  // ── Remaining stubs (Phase 2 onwards) ──
  { module: 'Companies', backend: '—', frontend: 'pages/crm/companies/', status: 'Frontend-only' },
  { module: 'Customers', backend: '—', frontend: 'pages/crm/customers/', status: 'Frontend-only' },
  { module: 'Bookings',  backend: '—', frontend: 'pages/crm/bookings/',  status: 'Frontend-only' },
  { module: 'Packages',  backend: '—', frontend: 'pages/crm/packages/',  status: 'Frontend-only' },
  { module: 'Destinations', backend: '—', frontend: 'pages/crm/destinations/', status: 'Frontend-only' },
  { module: 'Reports',   backend: '—', frontend: 'pages/crm/reports/',   status: 'Frontend-only' },
];
```

Run the generator:

```bash
cd D:/ClaudeProjects/TravelCRMPlus/docs && node generate-implemented-modules.js
```

Expected: `Wrote D:\ClaudeProjects\TravelCRMPlus\docs\implemented-modules.docx (NNN bytes)`.

- [ ] **Step 3: Update graphify**

```bash
cd D:/ClaudeProjects/TravelCRMPlus && graphify update . 2>&1 | tail -10
```

Expected: no errors, graph updated to include new entities/handlers/controllers.

- [ ] **Step 4: Commit doc + graph updates**

```bash
git add docs/implemented-modules.docx docs/generate-implemented-modules.js graphify-out/
git commit -m "docs(phase-1): regen implemented-modules + graphify update"
```

- [ ] **Step 5: Push**

```bash
git push origin master
```

- [ ] **Step 6: Done — close the loop**

Update `docs/superpowers/specs/2026-05-13-phase-1-deals-pipeline-design.md` Definition-of-Done checklist (Section 8) — tick the boxes that are now satisfied. Commit the spec update separately if any boxes remain unchecked (e.g. integration tests).

---

## Self-Review Notes

This plan covers every section of the design spec:

| Spec §  | Task |
|---------|------|
| 2 Domain Model       | Tasks 1–2 |
| 3 API Surface        | Tasks 5–8, 9–16, 17 (lead-side) |
| 4 Frontend           | Tasks 18–27 |
| 5.1 Multi-tenancy    | All backend tasks (explicit per-handler) |
| 5.2 Permissions      | Task 3 |
| 5.3 Feature gating   | Tasks 8 + 16 ([RequiresFeature]); Task 26 (sidebar) |
| 5.4 Migration & seed | Tasks 2 + 4 |
| 5.5 Converted retire | Tasks 4 + 17 + 27 |
| 5.6 Concurrency      | Tasks 12, 13, 14 (RowVersion); Task 16 (409 mapping); Task 25 (UI revert) |
| 5.7 Multi-currency   | Tasks 10 (kanban DTO totals) + 23 (KPI strip rendering) |
| 5.8 Edge cases       | Distributed across tasks (cross-pipeline 400, stage 409, deal-on-lead-delete) |
| 5.9 Tests            | Implicit in each task's smoke command; full integration suite is a follow-up |
| 6 Effort breakdown   | Task list maps to the 29 SP breakdown |

**Known compromises** (called out where they appear):
- Integration tests are **not** authored as separate xUnit files in this plan — smoke commands inline cover the happy path. Add a follow-up task if rigorous integration coverage is required for the Definition-of-Done check.
- Task 25 kanban uses `prompt()` for the Won/Lost close-reason note — replace with a proper Material dialog in a polish follow-up.
- Same-column reorder is a no-op (drops back to its original spot). Phase 1 doesn't require intra-column order persistence; defer to a later polish task.
- Owner picker is a simple user dropdown — no avatar / search. Acceptable for Phase 1.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-13-phase-1-deals-pipeline.md`.**

**Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration with isolated context per task.

2. **Inline Execution** — Execute tasks in this session using executing-plans with batch checkpoints for review.

**Which approach?**
