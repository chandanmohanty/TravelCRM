# Lead Import — Excel Bulk Upload + Google Sheets Recurring Sync — Design

> **Status:** Approved (brainstorm 2026-05-17)
> **Surface:** "Import Leads ▾" dropdown beside "Add Lead" on the CRM Leads list
> **Stack:** ASP.NET Core 8 + MediatR + EF Core (PostgreSQL); Angular 21 standalone + SidePanel primitive
> **Relation to roadmap:** Google Sheets is a Phase-4-class lead-source integration delivered early; data model is built so the Phase-4 connector framework can absorb it.

---

## 1. Goal & Scope

Two ways to bulk-bring leads into the CRM, surfaced from a single dropdown button:

1. **Bulk Upload from Excel File** — one-shot, stateless: upload `.xlsx`/`.csv` → map columns → validate → batch upsert leads → per-row result report.
2. **Connect Google Sheet** — persistent connection with **recurring sync**: OAuth to a platform-owned Google app → pick spreadsheet+tab → map columns → choose cadence → background Hangfire polling upserts leads continuously.

Both share one upsert/validation/dedupe engine so imported leads are indistinguishable from hand-entered ones and behaviour is identical across paths.

### In scope
- Excel `.xlsx`/`.xlsm`/`.csv` parse (≤5 MB, ≤10,000 data rows)
- Flexible column-mapping UI (fuzzy auto-guess), reused by both paths
- Upsert-by-key (default `email`), position-independent, in-file dedupe
- Platform-wide Google OAuth app, per-tenant refresh token, config-gated
- Recurring sync via one 5-min Hangfire dispatcher fanning out per-connection jobs
- A3 conflict rule (sheet overwrites mapped fields only when the row's content hash changed)
- "Lead Sources" CRM sub-page to manage Sheet connections
- Structured per-row result report + downloadable error CSV

### Out of scope (explicit YAGNI)
- Legacy binary `.xls` (reject at parse with "save as .xlsx")
- Writing back to sheets; multi-sheet/whole-workbook import; scheduled Excel re-import
- Bidirectional sync; row-deleted-in-sheet → lead-deleted (we never auto-delete CRM leads from a sync)
- Per-tenant BYO Google credentials; service-account model

---

## 2. Domain Model

New entities under `Domain/Entities/Crm/`, tenant-scoped, `IAuditableEntity` (audit quartet `CreatedAt/By`, `UpdatedAt/By`).

### `LeadImportSource` — persisted Google Sheet connection (Excel does NOT create one)
| Field | Type | Notes |
|---|---|---|
| `Id`, `TenantId` | Guid | |
| `Kind` | enum `LeadImportSourceKind` | `GoogleSheet` (Excel reserved, not persisted now) |
| `DisplayName` | string(200) | e.g. "Q1 web leads — Sheet1" |
| `SpreadsheetId` | string(200) | Google file id |
| `SheetName` | string(200) | the tab |
| `ColumnMapping` | jsonb | CRM field → source header, e.g. `{"email":"E-mail","firstName":"First"}` |
| `MatchKeyField` | string(50) | CRM field used for upsert (default `email`) |
| `SyncCadence` | enum `SyncCadence` | `Manual` / `Every15Min` / `Hourly` / `Daily` |
| `Status` | enum `LeadImportSourceStatus` | `Active` / `Paused` / `Error` / `Disconnected` |
| `LastPolledAt`, `LastSuccessAt` | DateTime? | |
| `LastResultJson` | jsonb? | `{created,updated,skipped,failed,errors[]}` from last run |
| `LastError` | string(1000)? | populated when `Status=Error` |
| `RowVersion` | byte[] | EF concurrency token (edit-mapping flow); trigger-managed like `Deal.RowVersion` |
| audit quartet | | |

### `LeadImportRowState` — per-imported-row state (powers A3 hash-skip + position-independent upsert)
| Field | Type | Notes |
|---|---|---|
| `Id`, `TenantId` | Guid | |
| `ImportSourceId` | Guid | FK → `LeadImportSource`, cascade delete |
| `MatchKey` | string(256) | normalised key value (e.g. lowercased email) |
| `ContentHash` | string(64) | SHA-256 of mapped cell values; unchanged ⇒ skip |
| `LeadId` | Guid? | lead this row created/updated (null if row invalid) |
| `LastSeenAt` | DateTime | last poll this key appeared |
| index | | unique `(ImportSourceId, MatchKey)` |

### `GoogleOAuthToken` — per-tenant refresh token for the platform Google app
| Field | Type | Notes |
|---|---|---|
| `Id`, `TenantId` | Guid | unique `TenantId` |
| `RefreshToken` | string(4000) | **encrypted at rest** via existing `ProtectedStringConverter` (same as `AiProviderConfiguration.ApiKey`) |
| `GrantedScopes` | string(500) | space-delimited; expect `spreadsheets.readonly userinfo.email` |
| `ConnectedByUserId` | Guid | who authorised |
| `ConnectedAt` | DateTime | |

### `lead_import_staging` — short-lived Excel parse buffer (not a domain entity)
`Id, TenantId, RowsJson (jsonb), HeadersJson (jsonb), CreatedAt`. Avoids re-uploading the file across wizard steps. Deleted on commit (common path); an **hourly** sweep job removes any rows older than 1h (abandoned wizards).

### Lead provenance
No new `Lead` columns. Imported leads are normal `Lead` rows; provenance derivable via `LeadImportRowState.LeadId`. `Lead.Source` is set to the parsed value or `LeadSource.Other` (no new `LeadSource.Import` enum value — deliberate, avoids enum/migration churn).

---

## 3. Backend API Surface

Feature folder `Features/Crm/LeadImport/`. All endpoints `[Authorize]` + `[RequiresFeature(FeatureCatalog.LeadImport)]` (new code — see §6) + permission `crm.leads.manage` for writes / `crm.leads.view` for the Lead Sources list.

### Excel (stateless, 3 steps)
| Method | Route | MediatR | Purpose |
|---|---|---|---|
| POST | `/api/crm/leads/import/excel/parse` | `ParseExcelCommand` (multipart `IFormFile`) | Validate file; read headers + first 5 data rows; persist parsed rows to `lead_import_staging`; return `{ stagingId, headers[], previewRows[], totalRows }` |
| POST | `/api/crm/leads/import/excel/preview` | `PreviewImportCommand(stagingId, mapping, matchKeyField)` | Dry-run classify: `{ willCreate, willUpdate, willSkip, sampleErrors[] }`, no writes |
| POST | `/api/crm/leads/import/excel/commit` | `CommitExcelImportCommand(stagingId, mapping, matchKeyField)` | Batched upsert via `LeadImportEngine`; return `LeadImportResult`; discard staging |

### Google Sheets — OAuth
| Method | Route | Notes |
|---|---|---|
| GET | `/api/crm/leads/import/google/status` | `{ configured, connected, grantedScopes }` — drives wizard states |
| GET | `/api/crm/leads/import/google/auth-url` | Google consent URL; `state` = HMAC(tenantId\|nonce\|exp). 409 if app not configured |
| GET | `/api/crm/leads/import/google/callback` | Exchanges code→refresh token, stores encrypted `GoogleOAuthToken`, returns self-closing HTML (`window.close()` + `postMessage` to opener) |
| POST | `/api/crm/leads/import/google/disconnect` | Calls Google revocation endpoint + deletes token + sets tenant's connections `Disconnected` |

### Google Sheets — connections + sync
| Method | Route | MediatR |
|---|---|---|
| GET | `/api/crm/leads/import/google/sheets/{spreadsheetId}/tabs` | `ListSheetTabsQuery` (refresh token if expired) |
| GET | `/api/crm/leads/import/google/sheets/{spreadsheetId}/headers?tab=` | `GetSheetHeadersQuery` (headers + 5 preview rows) |
| GET | `/api/crm/lead-sources` | `ListLeadImportSourcesQuery` (management page) |
| POST | `/api/crm/lead-sources` | `CreateLeadImportSourceCommand(...)` — persists + kicks immediate sync |
| PUT | `/api/crm/lead-sources/{id}` | `UpdateLeadImportSourceCommand(rowVersion, ...)` — RowVersion-guarded |
| POST | `/api/crm/lead-sources/{id}/sync` | `RunLeadImportSyncCommand` — "Sync now" |
| POST | `/api/crm/lead-sources/{id}/pause` · `/resume` | toggle `Status` |
| DELETE | `/api/crm/lead-sources/{id}` | `DeleteLeadImportSourceCommand` — removes connection + row-state |

### Shared engine
```
LeadImportEngine.ApplyAsync(tenantId, mappedRows, matchKeyField, sourceId?) → LeadImportResult
```
- `sourceId == null` (Excel): stateless upsert by key, no row-state, always-update on match.
- `sourceId != null` (Sheets): also reads/writes `LeadImportRowState` — hash-skip + A3 (update only when row hash changed) + `LeadId`/`LastSeenAt` tracking.
- Identical `LeadImportResult` shape → one frontend report component.

The Google SDK is wrapped behind `ISheetsReader` + `IGoogleTokenProvider` interfaces so the engine and sync are unit-testable without network.

---

## 4. Engine: Parsing, Validation, Dedupe

**Excel library:** `ClosedXML` (MIT) for `.xlsx`/`.xlsm`; built-in CSV reader for `.csv`. `.xls` rejected at parse.

**Parse limits:** ≤5 MB, ≤10,000 data rows, first non-empty row = headers; over-limit → 400 with specific message.

**Importable Lead fields & rules:**

| Field | Required | Rule |
|---|---|---|
| `email` | **yes** (default match key) | non-empty, valid email shape, normalised lower/trim |
| `firstName`, `lastName` | no | trimmed; default `""` |
| `phone`, `company`, `jobTitle`, `assignedTo` | no | trimmed, clamped to `Lead` column sizes |
| `status` | no | parse `LeadStatus`; blank/unknown → `New`; **`Converted` → row error** (retired Phase 1) |
| `source` | no | parse `LeadSource`; blank/unknown → `Other` |
| `score` | no | int 0–100; bad/out-of-range → clamp + warning |
| `estimatedValue` | no | decimal ≥ 0; bad → null + warning |
| `tags` | no | split `,`/`;` → list (existing pipe-joined `Lead.Tags` storage) |
| `notes` | no | trimmed, max 4000 |

**Per-row outcome (shared):** `Created` / `Updated` / `Skipped(reason)` / `Failed(reason)`. Result = counts + first 100 error rows `{ rowNumber, key, reason }`; wizard offers a client-generated "download full error report (.csv)".

**Dedupe / upsert (single shared rule):**
- Key normalised (email → lower+trim).
- In-file duplicate keys: first wins, rest `Skipped("duplicate in source")`.
- Vs existing leads (`WHERE TenantId=… AND <keyField>=<value>`): found → update mapped fields (Excel always; Sheets only if row hash changed — A3); not found → create.
- Create path reuses `CreateLeadCommand` invariants.
- Transactional **per batch of 500** — poison row fails its row only, never aborts the run.
- `CreatedBy/UpdatedBy` = importing user (Excel) or `null` (Sheets background sync — matches Phase-1 nullable-system-actor precedent).

---

## 5. Google Sheets OAuth + Recurring Sync

**Libraries:** `Google.Apis.Auth` + `Google.Apis.Sheets.v4` (Apache-2.0). Scopes: `spreadsheets.readonly` + `userinfo.email` (least privilege; never write).

**Config-gated platform app** (user-secrets/config):
```
GoogleSheets:ClientId
GoogleSheets:ClientSecret
GoogleSheets:RedirectUri
```
Empty `ClientId` ⇒ `IGoogleSheetsGate.IsConfigured == false`; every Google endpoint + the wizard show a "not set up on this server yet" state. Excel path is fully independent of this.

**OAuth (auth-code + offline):**
1. `GET /google/auth-url` → consent URL with `access_type=offline`, `prompt=consent`, `state=HMAC(tenantId|nonce|exp)`.
2. `GET /google/callback` → verify+expire state HMAC (CSRF + tenant binding) → exchange code → store `GoogleOAuthToken` (refresh token encrypted) → 200 self-closing HTML.
3. Access tokens never persisted — `GoogleTokenProvider` mints on demand from the refresh token, caches the ~1h access token in-memory per tenant. Refresh failure (revoked) → connections `Status=Error` + "Reconnect" CTA.

**Recurring sync (Hangfire), mirrors existing sweep-job pattern:**
- `LeadImportSyncDispatcherJob` (recurring, every 5 min): select `LeadImportSource WHERE Status=Active AND (LastPolledAt + cadence ≤ now)` (`Manual` never auto-due), enqueue per-connection `RunLeadImportSyncJob(sourceId)` (fire-and-forget so one slow sheet doesn't block others).
- `RunLeadImportSyncJob(sourceId)` `[DisableConcurrentExecution]` per source: explicit scope → set tenant from `LeadImportSource.TenantId` (no HTTP `ITenantContext` in background; mirrors `HoldExpirySweepJob`) → `GoogleTokenProvider` access token → `spreadsheets.values.get(spreadsheetId, sheet!A:Z)` → map via stored `ColumnMapping` → `LeadImportEngine.ApplyAsync(tenantId, rows, matchKeyField, sourceId)` → write `LastPolledAt/LastSuccessAt/LastResultJson`; on exception set `Status=Error`+`LastError` + create a tenant `Notification` (Phase-1 entity exists) "Google Sheet sync failed: …".
- "Sync now" enqueues the same job immediately.
- `429` rate-limit → catch, `Status=Error`+`LastError="rate limited, will retry"`, next dispatcher tick retries (no tight loop). 5-min dispatcher + 15-min minimum cadence keeps us well under Google's 300 read/min/project.

---

## 6. Cross-Cutting

**Multi-tenancy:** all four new tables carry `TenantId`; every handler/engine/job scopes explicitly (codebase convention, no global filters). OAuth `state` HMAC-bound to tenant. Refresh token per-tenant; access token cache per-tenant.

**Permissions:** reuse `crm.leads.manage` (writes) / `crm.leads.view` (Lead Sources list). No new permission slugs.

**Feature gating:** **add new `FeatureCatalog.LeadImport` code** (`"lead_import"`) — semantically distinct from `LeadSourceWebForms`; Phase-4 will want granular lead-source codes anyway. Granted to the same plan tiers as `core_crm`. Controllers `[RequiresFeature(FeatureCatalog.LeadImport)]`; dropdown `*hasFeature="'lead_import'"`.

**Migration:** one EF migration `AddLeadImport` — tables `lead_import_sources`, `lead_import_row_states`, `google_oauth_tokens`, `lead_import_staging`; indexes: `lead_import_sources(tenant_id,status)`, unique `lead_import_row_states(import_source_id,match_key)`, unique `google_oauth_tokens(tenant_id)`, `lead_import_staging(tenant_id,created_at)`. `GoogleOAuthToken.RefreshToken` via `ProtectedStringConverter`. `LeadImportSource.RowVersion`: the migration creates a **new dedicated trigger + function** for the `lead_import_sources` table (e.g. `fn_lead_import_source_row_version` / `trg_lead_import_source_row_version`), structurally identical to the Phase-1 deal trigger and using the same `decode(replace(gen_random_uuid()::text,'-',''),'hex')` body (**not** `gen_random_bytes`, which needs pgcrypto). It does **not** reuse the deal-specific trigger.

**Staging cleanup:** add an **hourly** `LeadImportStagingSweepJob` to the existing recurring-jobs registrar (delete `lead_import_staging` rows older than 1h). Hourly (not daily) so abandoned-wizard buffers don't linger ~24h — consistent with the "short-lived" / minimise-data-at-rest intent.

**Security:**
- Refresh token encrypted at rest; status endpoint returns only booleans/scopes.
- OAuth `state` HMAC via app data-protection key; expired/forged rejected.
- Upload: content-type + extension allowlist, 5 MB + row caps, parsed server-side only; ClosedXML reads values (no formula/macro execution).
- `readonly` Sheets scope; disconnect calls Google revocation endpoint.

**Error handling:** per-row failure isolated (batch-of-500); sync failure → `Status=Error`+`LastError`+`Notification`+Reconnect CTA; Excel parse error → 400 with human message; commit returns structured per-row report.

**Testing (integration + unit):** ClosedXML parse (valid/oversized/bad-email/dupe-in-file/`Converted`-rejected); `LeadImportEngine` upsert (create/update/hash-skip-A3/in-file-dupe); OAuth state HMAC verify+expire; Sheets sync with faked `ISheetsReader`; tenant-isolation fails-closed; dispatcher due-calculation. Google SDK behind `ISheetsReader`/`IGoogleTokenProvider` for network-free tests.

**New dependencies:** `ClosedXML`, `Google.Apis.Auth`, `Google.Apis.Sheets.v4` (3 NuGet). Zero new frontend deps.

---

## 7. Frontend Surface

- **Dropdown:** "Import Leads ▾" `mat-stroked-button` + `matMenuTriggerFor` beside "Add Lead" in `ll-header`, gated `*hasFeature="'lead_import'"` + `crm.leads.manage`. Items: *Bulk Upload from Excel File*, *Connect Google Sheet*.
- **Excel Import Wizard** (SidePanel, 3 steps): Upload (drag/drop, validation) → Map columns (reusable mapping component, fuzzy auto-guess, pick match key) → Review & run (counts + confirm → result report + error-CSV download).
- **Google Sheets Wizard** (SidePanel): not-configured state | Connect (OAuth popup) → Pick sheet (paste URL/id + tab dropdown) → Map columns + key → Sync settings (cadence + Sync-now) → Save (immediate initial sync).
- **Lead Sources page** (new CRM sub-page + sidebar entry): table of Sheet connections — name, mapped status, cadence, last sync, last result, actions (Sync now / Pause-Resume / Edit mapping / Disconnect). Reuses `lead-list` density + dark-mode token CSS.
- **Reusable** `lead-import-mapping.component.ts` consumed by both wizards (single fuzzy-match + field-list source of truth).

---

## 8. Effort

~22–28 SP. Excel path ~7 (independently shippable, no external dependency), Sheets OAuth ~6, recurring sync + dispatcher ~6, mapping UI + Lead Sources page ~5, tests ~4. Excel ships first; Sheets layers on.

## 9. Sequencing

1. Domain + EF migration + feature code
2. Engine (parse/validate/dedupe/upsert) + Excel commands/controller
3. Mapping UI component + Excel wizard + dropdown button
4. Google config gate + OAuth endpoints + token provider
5. Sheets queries + connection CRUD + Sheets wizard
6. Hangfire dispatcher + per-connection sync job + staging sweep
7. Lead Sources management page + sidebar route
8. Tests, smoke, docs regen
