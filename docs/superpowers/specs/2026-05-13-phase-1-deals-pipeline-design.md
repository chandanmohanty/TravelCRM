# Phase 1 — Deals & Pipeline Design

> **Status:** Approved · Brainstormed 2026-05-13
> **Parent plan:** `docs/znicrm-feature-parity-plan.md` (Phase 1 of 14)
> **Depends on:** Phase 0 (Subscriptions, FeatureGate, `*hasFeature` directive) — shipped
> **Effort target:** ~29 SP (~3–4 weeks for 1 engineer) — see Section 6 for breakdown

## 1. Purpose & Scope

Ship the sales-pipeline core of TravelCRMPlus: **multi-pipeline per tenant**, **drag-drop kanban**, **list view**, **deal detail**, and **conversion from Lead → Deal**. This is the centrepiece of the "execution-focused" promise from the plan doc — every later phase (quotes, invoices, automation, AI scoring) anchors on the `Deal` entity defined here.

### Goals

- Tenants can define one or many pipelines, each with their own stages, probabilities, and won/lost semantics
- Users can create deals from a Lead (auto-snapshot) or from scratch
- Drag-drop kanban moves a deal between stages with optimistic UI and 409-safe concurrency
- Every stage / owner / value change is auto-logged to a per-deal activity feed
- All UI is plan-gated (`deals` feature code) and permission-gated (`crm.deals.*` + `crm.pipelines.manage`)

### Non-goals (deferred)

- **Custom fields** — `Deal.CustomFields jsonb` column is created but has no UI in this phase
- **Cross-pipeline deal moves** — out of scope; requires a separate `ChangeDealPipelineCommand`
- **Multi-currency totals with FX conversion** — KPIs render per-currency lines instead
- **Hangfire stale-deal sweep** — lands in Phase 13 (Reports) alongside the rest of the analytics jobs
- **Bulk move / bulk reassign UX** — single-deal operations only in Phase 1

---

## 2. Domain Model

Three new entities + one history table, all under `Domain/Entities/Crm/`.

### 2.1 `Pipeline`

Tenant-scoped, per-tenant configurable. One tenant can have many pipelines (e.g. "Outbound Sales", "Repeat Customer", "Group Bookings").

| Field | Type | Notes |
|---|---|---|
| `Id` | Guid | PK |
| `TenantId` | Guid | FK + index |
| `Name` | string(100) | required, unique within tenant |
| `Description` | string(500)? | optional |
| `IsDefault` | bool | exactly one default per tenant; new deals/leads fall back to this |
| `IsActive` | bool | inactive pipelines are hidden from pickers but existing deals keep working |
| `SortOrder` | int | display order in pickers / settings UI |
| audit | | `CreatedAt`, `UpdatedAt`, `IAuditableEntity` |

### 2.2 `PipelineStage`

Child of Pipeline. Stages carry both display attributes (color, probability) and system semantics (`Kind = Open | Won | Lost`) so reports can compute win-rate regardless of how the tenant names the stages.

| Field | Type | Notes |
|---|---|---|
| `Id` | Guid | PK |
| `TenantId` | Guid | denormalised for query speed + tenant scoping |
| `PipelineId` | Guid | FK, cascade delete |
| `Name` | string(100) | required, unique within pipeline |
| `SortOrder` | int | kanban column order |
| `DefaultProbability` | int (0–100) | applied to new deals; can be overridden per deal |
| `Kind` | enum | `Open` / `Won` / `Lost` — semantic role for reporting |
| `ColorHex` | string(7) | kanban column accent (e.g. `#15803d`) |
| `IsActive` | bool | inactive stages hidden from new-deal pickers |

### 2.3 `Deal`

Primary entity. Carries lead snapshot fields so deals stay readable when the lead is detached or deleted.

| Field | Type | Notes |
|---|---|---|
| `Id` | Guid | PK |
| `TenantId` | Guid | FK + index |
| `Title` | string(200) | required |
| `PipelineId` | Guid | FK |
| `StageId` | Guid | FK; constrained to same pipeline |
| `LeadId` | Guid? | nullable FK — drill-back link, not a hard parent |
| **Snapshot** | | denormalised at create-time |
| `ContactName` | string(200) | required |
| `ContactEmail` | string(256)? | |
| `ContactPhone` | string(50)? | |
| `CompanyName` | string(200)? | |
| **Commercial** | | |
| `Value` | decimal(18,2)? | nullable so deals can start without a number |
| `Currency` | string(5) | defaults to tenant `DefaultCurrencyCode`; per-deal overridable |
| `Probability` | int (0–100) | stage default on create; per-deal overridable; does **not** auto-overwrite on stage change |
| `ExpectedCloseDate` | date? | |
| `ActualCloseDate` | date? | auto-set when stage transitions to Won/Lost; cleared when moved back to Open |
| **Ownership** | | |
| `OwnerUserId` | Guid | FK to ApplicationUser; required; defaults to current user on create |
| **Misc** | | |
| `Tags` | List<string> | `|`-joined storage, matching existing Lead.Tags pattern |
| `Notes` | string(4000)? | freeform |
| `CustomFields` | jsonb | reserved; no Phase-1 UI |
| `Status` | enum | computed cache: `Open` / `Won` / `Lost` — derived from `StageId.Kind` |
| `RowVersion` | byte[] | EF optimistic-concurrency token for kanban drag-drop |
| audit | | `CreatedAt/By`, `UpdatedAt/By`, `IAuditableEntity` |

### 2.4 `DealActivity`

Append-only history feed. Auto-written on a fixed set of events.

| Field | Type | Notes |
|---|---|---|
| `Id` | Guid | PK |
| `TenantId` | Guid | scoping |
| `DealId` | Guid | FK |
| `OccurredAt` | DateTime | UTC |
| `ActorUserId` | Guid? | always populated in Phase 1; nullable to leave room for Phase 7's workflow-engine auto-moves (e.g. "stale deal auto-closes to Lost") |
| `ActorName` | string(200)? | denormalised so the feed reads cleanly even after a user is renamed |
| `Kind` | enum | `Created` / `StageChanged` / `OwnerChanged` / `ValueChanged` / `Closed` / `Reopened` / `Note` |
| `FromValue` | string(500)? | generic — captures any "before" |
| `ToValue` | string(500)? | generic — captures any "after" |
| `Note` | string(2000)? | populated for `Kind=Note` |

**Auto-logged events:**
`Created`, `StageChanged` (every move), `OwnerChanged` (every reassign), `ValueChanged` (when value or currency changes), `Closed` (when entering Won/Lost), `Reopened` (when moved back to Open from Won/Lost), `Note` (explicit `AddDealNoteCommand`).

**Not** logged: title edits, tag edits, notes-field edits, expected-close changes. The existing `AuditSaveChangesInterceptor` still captures those for the platform audit log — `DealActivity` is the *user-visible* feed.

---

## 3. API Surface

All routes `[Authorize]` + `[RequiresFeature(FeatureCatalog.Deals)]`. Result-type pattern matches existing CRM controllers.

### 3.1 Pipelines — tenant admin (`crm.pipelines.manage`)

| Method | Route | Command/Query |
|---|---|---|
| GET    | `/api/crm/pipelines`                              | `ListPipelinesQuery` — returns pipelines with stages embedded |
| GET    | `/api/crm/pipelines/{id}`                         | `GetPipelineQuery` |
| POST   | `/api/crm/pipelines`                              | `CreatePipelineCommand(name, description?, initialStages?)` |
| PUT    | `/api/crm/pipelines/{id}`                         | `UpdatePipelineCommand(name, description?, isActive, isDefault)` |
| DELETE | `/api/crm/pipelines/{id}`                         | `DeletePipelineCommand` — 409 if any deals exist on this pipeline |
| POST   | `/api/crm/pipelines/{id}/stages`                  | `AddStageCommand(name, kind, color, probability, sortOrder)` |
| PUT    | `/api/crm/pipelines/{pid}/stages/{sid}`           | `UpdateStageCommand(...)` |
| PUT    | `/api/crm/pipelines/{id}/stages/reorder`          | `ReorderStagesCommand({ stageIds: [...] })` — atomic rewrite |
| DELETE | `/api/crm/pipelines/{pid}/stages/{sid}`           | `DeleteStageCommand` — 409 if deals are on stage |

### 3.2 Deals — primary surface

| Method | Route | Command/Query | Permission |
|---|---|---|---|
| GET    | `/api/crm/deals`                       | `ListDealsQuery(pipelineId?, stageId?, ownerUserId?, status?, search?, hasLead?, page, pageSize)` | `view` |
| GET    | `/api/crm/deals/kanban?pipelineId={id}` | `GetKanbanQuery` — returns `{ stage, deals[] }[]` pre-grouped + ordered | `view` |
| GET    | `/api/crm/deals/{id}`                  | `GetDealQuery` — includes recent `DealActivity` embedded | `view` |
| POST   | `/api/crm/deals`                       | `CreateDealCommand(leadId?, title, contact/company/email/phone, pipelineId, stageId?, value?, currency?, expectedCloseDate?, ownerUserId?, tags[], notes?)` | `manage` |
| PUT    | `/api/crm/deals/{id}`                  | `UpdateDealCommand(rowVersion, ...)` — all editable fields | `manage` |
| POST   | `/api/crm/deals/{id}/move`             | `MoveDealStageCommand(rowVersion, stageId, note?)` — used by kanban drag + detail stage dropdown | `manage` |
| POST   | `/api/crm/deals/{id}/reassign`         | `ReassignDealCommand(rowVersion, ownerUserId, note?)` | `manage` |
| POST   | `/api/crm/deals/{id}/notes`            | `AddDealNoteCommand(note)` | `manage` |
| DELETE | `/api/crm/deals/{id}`                  | `DeleteDealCommand` — soft delete; only when `Status=Open` | `delete` |

### 3.3 Lead-side housekeeping

- **Remove** `LeadsController.Convert` endpoint + `ConvertLeadCommand` entirely
- **Add** filter param `?hasDeals=true|false|all` to `LeadsController.GET /leads`
- **Update** `DeleteLeadCommand` guard: blocked when the lead has **active (Open) deals**; closed deals are OK
- **Update** `LeadDto`: add `dealCount: int`
- **Update** `LeadsController.Delete` error message accordingly

### 3.4 Validation invariants

- `MoveDealStageCommand`: `stageId.PipelineId == deal.PipelineId` (cross-pipeline rejected)
- `CreateDealCommand`: if `leadId` provided, lead must belong to the same tenant; snapshot fields auto-populated from the lead, overrideable in the same payload
- `CreateDealCommand`: `pipelineId` defaults to tenant's default pipeline if omitted; `stageId` defaults to the pipeline's **first active stage with `Kind=Open`** by `SortOrder`. If no Open stage exists (degenerate — admin removed them all), fall back to the first active stage by `SortOrder` regardless of Kind
- Stage transitions to `Won`/`Lost`: server sets `ActualCloseDate = UtcNow.Date`, marks `Status = Won|Lost`, writes `DealActivity Kind=Closed`
- Stage transitions from `Won`/`Lost` to `Open`: server clears `ActualCloseDate`, marks `Status=Open`, writes `DealActivity Kind=Reopened`
- Probability is **never** auto-overwritten on stage change — only on explicit `UpdateDealCommand` or a "Reset to stage default" client-side helper

---

## 4. Frontend Architecture

### 4.1 Routes (under existing lazy-loaded `crm/`)

```
crm/
├── deals/
│   ├── (list)         → DealsListComponent       [hasFeature 'deals']
│   ├── pipeline       → DealsKanbanComponent     [hasFeature 'pipeline_kanban']
│   └── :id            → DealDetailComponent      (SidePanel)
└── pipelines/
    ├── (list)         → PipelinesListComponent   [hasFeature 'deals', requires crm.pipelines.manage]
    └── :id            → PipelineEditComponent
```

The existing `/crm/pipeline` stub redirects to `/crm/deals/pipeline` so sidebar / bookmarks stay valid.

### 4.2 Services (`core/services/`)

- **`DealsService`** — list, kanban, get, create, update, move, reassign, addNote, delete; signal-cached pipeline-selected state shared between list + kanban
- **`PipelinesService`** — pipelines + stages CRUD; signal-cached pipeline list (consumed by ≥3 pickers)

Both follow the existing `LeadsService` / `SuppliersService` pattern: `HttpClient`, `EnvelopeInterceptor` unwraps, signal-based local cache, Observable returns to handlers.

### 4.3 Components

#### `DealsKanbanComponent`
- Pipeline picker (signal) → loads kanban via `GetKanbanQuery`
- Columns rendered from `stages[]` ordered by `sortOrder`
- Card surface: title, value+currency, owner avatar, expected-close pill, tag chips
- **CDK drag-drop** between columns:
  1. Optimistic move (signal update — card jumps to target column immediately)
  2. `POST /deals/{id}/move` with current `rowVersion`
  3. Success → refresh affected stage columns
  4. 409 Conflict → revert + toast "This deal was just updated by someone else — refreshing"
  5. Other failure → revert + toast `error.message`
- **Won/Lost confirm dialog**: drops onto stages where `Kind != Open` open a "Confirm move" modal with the destination stage name and an optional close-reason note
- Card click → `DealDetailComponent` in SidePanel
- Empty per-column state ("No deals — drag here")
- Empty kanban-wide state when tenant has no pipelines (won't happen post-seed but defensive)

#### `DealsListComponent`
- Mirrors `LeadListComponent` density and layout
- KPI strip: Open deals (count) · Pipeline value (sum by currency) · Weighted forecast (Σ value × probability/100, by currency) · Won this month
- Filters: pipeline dropdown · stage dropdown (filtered by selected pipeline) · owner picker · status (Open/Won/Lost/All) · free-text · `hasLead`
- Row click opens `DealDetailComponent` in SidePanel
- "+ Add Deal" → CreateDeal SidePanel form

#### `DealDetailComponent` (SidePanel form)
- Header: deal title + pipeline/stage breadcrumb pill
- Stage quick-change dropdown at top (fires `MoveDealStageCommand` directly)
- Sections (not tabs — fits the compact panel form factor):
  - **Overview**: title, contact snapshot (read-only after create), value+currency, expected close, probability slider (defaults to stage default; "Reset to default" link), owner picker, tags, notes
  - **Activity**: reverse-chronological `DealActivity` feed with icon-per-kind, actor avatar, relative time
- Action row: "Reassign owner" (opens small dialog), "Add note" (inline text), "Delete deal" (only enabled when `Status=Open`)
- Dual-mode pattern from Phase 0: `inject(SidePanelRef, { optional: true })` so it doubles as a routed `/crm/deals/:id` page

#### `PipelinesListComponent` + `PipelineEditComponent`
- List: pipelines table with name, stage count, deal count, default badge
- Edit page: pipeline metadata at top + drag-to-reorder stages table
  - Per-stage row: name, color picker, probability input, `Kind` selector (Open/Won/Lost), active toggle, delete
  - "+ Add stage" appends at end
  - Save fires `UpdatePipelineCommand` + `ReorderStagesCommand` in one round-trip

### 4.4 Lead-side UI changes

- `LeadListComponent`: action menu "Convert" → "**Create Deal**" (opens new-deal SidePanel pre-filled with snapshot)
- `LeadListComponent`: new filter pill "Has deals" (yes / no / all)
- `LeadListComponent`: name cell shows a "{n} deals" badge when `lead.dealCount > 0`
- `LeadDetailComponent`: adds a "Deals" section listing this lead's deals with a "+ New Deal" button

---

## 5. Cross-Cutting Concerns

### 5.1 Multi-tenancy
- Every entity carries `TenantId`
- Every handler starts with `.Where(x => x.TenantId == tenantContext.TenantId!.Value)`
- Cross-tenant references fail closed: a request that names another tenant's `pipelineId` returns `"not found"` from the lookup query, not a permission error (avoids existence-leak)

### 5.2 Permissions (added to `PermissionCatalog`)
- `crm.deals.view` — list, get, kanban
- `crm.deals.manage` — create, update, move, reassign, addNote
- `crm.deals.delete` — delete
- `crm.pipelines.manage` — pipeline + stage CRUD

`RolePermissionSeeder` grants: Admin → all four; Sales Rep → view + manage; Read-only → view only.

### 5.3 Feature gating
- `FeatureCatalog.Deals` attached to plans Starter+ (already in catalog from Phase 0)
- `FeatureCatalog.PipelineKanban` attached to plans Free+ (everyone gets kanban; differentiation is in later phases' automation)
- `[RequiresFeature(FeatureCatalog.Deals)]` on `DealsController` + `PipelinesController`
- Sidebar menu item gated by `*hasFeature="'deals'"`; kanban view toggle gated by `*hasFeature="'pipeline_kanban'"`

### 5.4 Migration & Seed
Two pieces:

**EF migration `AddDealsAndPipelines`** — schema only:
1. Tables: `pipelines`, `pipeline_stages`, `deals`, `deal_activities`
2. Indexes:
   - `pipelines (tenant_id, sort_order)` · unique `(tenant_id, name)`
   - `pipeline_stages (tenant_id, pipeline_id, sort_order)` · unique `(pipeline_id, name)`
   - `deals (tenant_id, owner_user_id)` · `(tenant_id, stage_id, sort_order)` · `(tenant_id, status)` · `(tenant_id, lead_id) WHERE lead_id IS NOT NULL`
   - `deal_activities (tenant_id, deal_id, occurred_at DESC)`

**SeedData / `PipelineSeeder`** — idempotent data backfill, runs on every boot (matches the Phase 0 `PlanSeeder` pattern):
1. For every existing tenant without any pipeline, seed one "Sales" pipeline (`IsDefault=true`) + 6 stages (Prospect, Qualification, Proposal, Negotiation, Closed Won, Closed Lost)
2. For every Lead currently `Status = Converted`, set `Status = Qualified` (one-shot conditional update; logged when rows are touched)
3. Wired into `SeedData.SeedAsync` after `PlanSeeder.SeedAsync` so new tenants get pipelines automatically on provision

### 5.5 `LeadStatus.Converted` retirement
- Enum value kept (removing breaks historical migration replay) but marked `[Obsolete]`
- All UI references removed: filter dropdown, badge case, etc.
- API rejects incoming `Status = Converted` on create/update with 400

### 5.6 Concurrency
- `Deal.RowVersion` byte[] EF-Core token
- `UpdateDealCommand`, `MoveDealStageCommand`, `ReassignDealCommand` require client to pass the current `rowVersion`
- DbUpdateConcurrencyException → return `Result.Failure("concurrency_conflict")` → controller maps to 409 Conflict with a stable shape: `{ error: "concurrency_conflict", currentVersion: "..." }`
- Client reverts optimistic UI and refetches

### 5.7 Multi-currency
- Each `Deal` carries its own `Currency`
- KPI totals render as **separate lines per currency** (e.g. "₹12,45,000 · $48,000 · €15,000")
- No FX conversion in Phase 1 — defer to Phase 13 reports where it can be configured per tenant

### 5.8 Edge cases
| Case | Behaviour |
|---|---|
| Move deal to stage in different pipeline | 400 "stage doesn't belong to this pipeline" |
| Delete stage with deals on it | 409 with `{ dealCount }`; UI prompts bulk-move |
| Delete pipeline with any deals | 409; must move/close deals first |
| Delete lead with active deals | 409; UI offers "Detach from deals" (sets `LeadId = null`, snapshot preserved) |
| Tenant has no pipelines | Defensive: seeder runs at provision. UI shows empty state offering "Create pipeline" |
| Move Won → Open | `ActualCloseDate` cleared, `Status = Open`, `DealActivity Kind=Reopened` written |
| Manual probability override | Persists across stage changes; "Reset to stage default" button available on form |
| Two users drag same card | RowVersion → 409; second user gets toast + auto-refresh |

### 5.9 Tests
Integration coverage targets:
- Happy paths for all 14 endpoints
- Failure: cross-pipeline stage move, cross-tenant pipeline reference, concurrency conflict, lead-with-deals delete
- Behaviour: Won/Lost auto-sets `ActualCloseDate`, Reopen clears it, snapshot copy on `leadId`-based create, probability not overwritten on stage change

---

## 6. Effort Estimate

Mapping the original 25 SP from the parent plan into this design:

| Slice | SP |
|---|---|
| Domain entities + EF config + migration + seeder | 3 |
| Pipelines + Stages backend (8 endpoints) | 4 |
| Deals backend (9 endpoints + DealActivity) | 5 |
| Lead-side housekeeping (Convert removal, dealCount, hasDeals filter, delete guard) | 1 |
| `DealsService` + `PipelinesService` Angular services | 1 |
| `DealsKanbanComponent` (drag-drop, optimistic UI, 409 handling) | 4 |
| `DealsListComponent` + KPI strip + filters | 2 |
| `DealDetailComponent` SidePanel form + activity feed | 3 |
| `PipelinesListComponent` + `PipelineEditComponent` (drag-reorder stages) | 2 |
| `LeadListComponent` / `LeadDetailComponent` updates | 1 |
| Integration tests | 2 |
| Smoke-test + docs regen + commits | 1 |
| **Total** | **29 SP** |

The 4 SP over the plan's estimate are honest absorption of: multi-pipeline (Q2 = C, plan assumed single), full drag-drop kanban (Q4 = C, plan was open), and the `RowVersion` concurrency model the kanban demands.

---

## 7. Open Questions

None blocking implementation. The following are intentionally deferred:

- **Bulk operations** (multi-select kanban / list) — Phase 1.5 if demanded
- **Stage-progression validation rules** (can't skip stages? require X before Y?) — folds into Workflow Engine (Phase 7)
- **Per-pipeline default owner / round-robin** — folds into Assignments (Phase 8)
- **Webhook on deal won** — folds into Webhooks (Phase 11)
- **FX-converted forecast totals** — folds into Reports (Phase 13)

---

## 8. Definition of Done

A Phase-1 PR is mergeable when **all of**:

- [ ] All 14 endpoints have FluentValidation + inline `currentUser.HasPermission(...)` check + integration test
- [ ] All UI screens responsive + dark-mode token-driven (Phase 0 pattern)
- [ ] `[RequiresFeature(FeatureCatalog.Deals)]` enforced on every Deals/Pipelines controller
- [ ] `*hasFeature="'deals'"` gates every entry point in the sidebar + lead actions
- [ ] Concurrency conflict path tested end-to-end (drag from two browsers)
- [ ] Backfill of `Status=Converted` leads verified on demo tenant
- [ ] Permissions catalog updated; `RolePermissionSeeder` grants reflect the matrix above
- [ ] `docs/implemented-modules.docx` regenerated to add the 4 new modules
- [ ] `graphify update .` run to refresh the knowledge graph
- [ ] One smoke-test session: create lead → create deal from lead → drag to Won → verify Lead unchanged (no "Converted" status) but `dealCount = 1`
