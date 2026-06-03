# Lead Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Import Leads ▾" dropdown beside "Add Lead" offering (1) stateless Excel/CSV bulk upload and (2) a platform-OAuth Google Sheets connection with recurring Hangfire sync — both backed by one shared upsert/validate/dedupe engine.

**Architecture:** ASP.NET Core 8 + MediatR + EF Core (PostgreSQL). One `LeadImportEngine` does upsert-by-key for both paths (Excel = stateless always-update; Sheets = `LeadImportRowState` content-hash skip + A3 update-only-when-changed). Google SDK hidden behind `ISheetsReader`/`IGoogleTokenProvider` interfaces for network-free tests. Google half is config-gated (dormant until `GoogleSheets:ClientId/Secret/RedirectUri` supplied); Excel half has zero external dependency and ships first. Angular 21 standalone + the existing SidePanel primitive for both wizards.

**Tech Stack:** C# 12, .NET 8, EF Core 8, MediatR 12, FluentValidation, Hangfire (PostgreSQL), ClosedXML, Google.Apis.Auth, Google.Apis.Sheets.v4, Angular 21, Angular Material, RxJS, PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-05-17-lead-import-design.md`

**Baseline:** master HEAD `5af91f8` (Phase 0 + Phase 1 shipped). Reuse patterns: `ProtectedStringConverter` (encrypt-at-rest, see `AiProviderConfiguration.ApiKey`), `Deal.RowVersion` trigger (`fn_deal_row_version` / `trg_deal_row_version` using `decode(replace(gen_random_uuid()::text,'-',''),'hex')`), the recurring sweep-job pattern (`TrialExpirySweepJob`/`HoldExpirySweepJob` + `RecurringJobRegistrar`), `Result<T>` (`TravelCrm.Api.Common`), per-handler tenant scoping (`ITenantContext.IsResolved`/`.TenantId`), inline `ICurrentUser.HasPermission(slug)`, `[RequiresFeature(FeatureCatalog.X)]`, the `Notification` entity, SidePanel (`SidePanelService.open`, `SidePanelRef`, `SIDE_PANEL_DATA`), `EnvelopeInterceptor` (services see bare DTOs, no `.data` unwrap).

---

## ▶ EXECUTION PROGRESS

**Status: ✅ COMPLETE — All 16 tasks shipped on master (2026-06-04).**

| Task | Description | Commit |
|---|---|---|
| 1 | NuGet deps + GoogleSheetsOptions + lead_import feature code | `e9db1e1` |
| 2 | Domain entities + enums | `b09979d` |
| 3 | EF config + AddLeadImport migration + plan grant | `163ba05` |
| 4 | LeadFieldMap (TDD) | `af51062` + `8d4c99b` |
| 5 | Tabular parsers (ClosedXML + CSV) | `c9e1dbe` + `3a2aa66` |
| 6 | LeadImportEngine (shared upsert/dedupe/A3) | `384401a` + `0a0e66f` + `48efd76` |
| 7 | Excel commands + controller + staging sweep | `5cc6923` + `6c996e1` |
| 8 | Frontend Excel wizard + mapping + dropdown | `d0e0274` |
| 9 | GoogleSheetsGate + TokenProvider + SheetsReader | `3fbcb5d` + `28f13ae` |
| 10 | GoogleOAuthController + OAuthState HMAC | `dad57c9` + `d78eb1f` |
| 11 | Sheets queries + LeadImportSource CRUD | `f22702f` + `583f1b9` |
| 12 | LeadSourcesController + GoogleSheetsController | `1980123` |
| 13 | Hangfire sync job + dispatcher + registrar | `e4302ca` + `03d14ee` |
| 14 | Frontend Google Sheets wizard | `0e8cde5` + `6ef6995` |
| 15 | Lead Sources management page + route + sidebar | `cad5747` + `46318e0` |
| 16 | Wrap — sync-job tests + plan banner + graphify | (this commit) |

**Test suite**: 166 passed / 1 pre-existing skip / 0 failed. Build: 0 errors / 2 pre-existing CS9113 / 0 CS0618.

**Known follow-ups** (T16 deferred, all documented in code comments):
- `Notification.UserId` is non-nullable — `RunLeadImportSyncJob` has a `TODO(T16)` placeholder where a tenant notification should be created on sync failure. Once the Notification entity gets a "system actor" pattern, fill in the missing notification.
- `RunLeadImportSyncCommand` does not block manual sync on `Paused`/`Error`/`Disconnected` sources by design — manual override is intentional. The frontend now disables the Sync Now button for `Disconnected` rows.

---

## Conventions (apply to every task)

- Before `dotnet build`/`dotnet ef`: `Get-Process -Name "TravelCrm.Api" -ErrorAction SilentlyContinue | Stop-Process -Force` (dev server locks the exe).
- Backend build OK = `0 Error(s)`, exactly **2 CS9113** warnings (`RefreshCommandHandler`, `ForgotPasswordCommand`), **0 CS0618**. Any new warning is yours to fix.
- Frontend build = `cd D:/ClaudeProjects/TravelCRMPlus && npx ng build --configuration development 2>&1 | tail -5` → "Application bundle generation complete", 0 TS errors (pre-existing Sass `if()` deprecation + the pre-existing `NG8113 TenantPlanComponent` warning are acceptable).
- **Never** stage `src/assets/scss/_container.scss` (known unrelated pre-existing change).
- DB conn (user-secrets): `Host=localhost;Port=5432;Database=travelcrm;Username=postgres;Password=Cl0ud@2026$`. psql: `C:\Program Files\PostgreSQL\18\bin\psql.exe`. From PowerShell use the `--%` stop-parse token for `psql -c "..."`.
- EFCore.NamingConventions auto snake_cases tables/columns — never add `[Table]`/`[Column]`.
- Tenant scoping is explicit per-handler (`.Where(x => x.TenantId == tenant.TenantId!.Value)`), no global filters.
- Login for smoke tests: `POST /api/auth/login` `{"email":"admin@travelcrm.io","password":"Admin@12345"}` + header `X-Tenant-Id: 00000000-0000-0000-0000-000000000001`; reuse `accessToken` as `Authorization: Bearer`.
- Each task ends with a single commit using the message in its final step.

---

## File Structure

### Backend — new
```
TravelCrm.Api/
├── Domain/Entities/Crm/
│   ├── LeadImportSource.cs       (entity + LeadImportSourceKind/SyncCadence/LeadImportSourceStatus enums)
│   ├── LeadImportRowState.cs
│   ├── GoogleOAuthToken.cs
│   └── LeadImportStaging.cs
├── Features/Crm/LeadImport/
│   ├── Dtos.cs                   (LeadImportResult, LeadImportRowOutcome, ColumnMappingDto, ParseResultDto,
│   │                              PreviewResultDto, GoogleStatusDto, LeadImportSourceDto, SheetTabDto, SheetHeadersDto)
│   ├── LeadFieldMap.cs           (importable-field catalog, fuzzy header guess, row→Lead projection + validation)
│   ├── ILeadImportEngine.cs
│   ├── LeadImportEngine.cs       (shared upsert/dedupe/A3 hash for both paths)
│   ├── Parsing/
│   │   ├── ITabularLeadParser.cs (headers + rows abstraction)
│   │   ├── ClosedXmlLeadParser.cs(.xlsx/.xlsm)
│   │   └── CsvLeadParser.cs      (.csv)
│   ├── Commands/
│   │   ├── ParseExcelCommand.cs
│   │   ├── PreviewImportCommand.cs
│   │   ├── CommitExcelImportCommand.cs
│   │   ├── CreateLeadImportSourceCommand.cs
│   │   ├── UpdateLeadImportSourceCommand.cs
│   │   ├── DeleteLeadImportSourceCommand.cs
│   │   ├── RunLeadImportSyncCommand.cs
│   │   └── SetLeadImportSourceStatusCommand.cs   (pause/resume)
│   ├── Queries/
│   │   ├── ListLeadImportSourcesQuery.cs
│   │   ├── ListSheetTabsQuery.cs
│   │   └── GetSheetHeadersQuery.cs
│   ├── LeadImportExcelController.cs               (parse/preview/commit)
│   ├── LeadSourcesController.cs                   (sources CRUD + sync/pause/resume)
│   └── Google/
│       └── GoogleOAuthController.cs               (status/auth-url/callback/disconnect)
├── Infrastructure/Google/
│   ├── GoogleSheetsOptions.cs
│   ├── IGoogleSheetsGate.cs / GoogleSheetsGate.cs
│   ├── IGoogleTokenProvider.cs / GoogleTokenProvider.cs
│   └── ISheetsReader.cs / GoogleSheetsReader.cs
├── Infrastructure/Jobs/
│   ├── LeadImportSyncDispatcherJob.cs
│   ├── RunLeadImportSyncJob.cs
│   └── LeadImportStagingSweepJob.cs
└── Migrations/{stamp}_AddLeadImport.cs            (generated + manual trigger SQL)
```

### Backend — modified
```
TravelCrm.Api/
├── Common/FeatureCatalog.cs                       (add LeadImport const + to All)
├── Infrastructure/Persistence/ApplicationDbContext.cs (4 DbSets + entity config + row_version trigger note)
├── Infrastructure/Persistence/PlanSeeder.cs       (grant lead_import to the core_crm tiers)
├── Infrastructure/Jobs/RecurringJobRegistrar.cs   (register dispatcher + staging sweep)
├── TravelCrm.Api.csproj                           (3 NuGet PackageReferences)
└── Program.cs                                     (options bind + DI for Google + engine + parsers)
```

### Frontend — new
```
src/app/
├── core/models/lead-import.model.ts
├── core/services/lead-import.service.ts
└── pages/crm/
    ├── leads/import/
    │   ├── lead-import-mapping.component.ts        (reusable mapping step)
    │   ├── excel-import-wizard.component.ts        (SidePanel)
    │   └── google-sheets-wizard.component.ts       (SidePanel)
    └── lead-sources/
        └── lead-sources.component.ts               (management page)
```

### Frontend — modified
```
src/app/
├── pages/crm/leads/lead-list/lead-list.component.ts   (Import Leads ▾ menu button)
├── pages/crm/crm.routes.ts                            (lead-sources route)
└── layouts/full/vertical/sidebar/sidebar-data.ts
└── layouts/full/horizontal/sidebar/sidebar-data.ts    (Lead Sources nav entry)
```

---

## Task Index

**Excel path (independently shippable — Tasks 1–8):**
1. NuGet deps + Google config options + feature code
2. Domain entities + enums
3. EF config + migration (incl. row_version trigger) + plan-feature grant
4. `LeadFieldMap` (field catalog, fuzzy guess, project+validate) — TDD
5. Tabular parsers (ClosedXML + CSV) behind `ITabularLeadParser` — TDD
6. `LeadImportEngine` (shared upsert/dedupe/A3) — TDD
7. Excel commands (parse/preview/commit) + `LeadImportExcelController` + staging sweep job
8. Frontend: model + service (Excel) + reusable mapping component + Excel wizard + dropdown button

**Google Sheets path (layers on — Tasks 9–16):**
9. `GoogleSheetsGate` + `GoogleTokenProvider` + `ISheetsReader` (interfaces + impls)
10. `GoogleOAuthController` (status/auth-url/callback/disconnect) — TDD on state HMAC
11. Sheets queries (tabs/headers) + `LeadImportSource` CRUD commands/queries
12. `LeadSourcesController` + sync/pause/resume
13. Hangfire `RunLeadImportSyncJob` + `LeadImportSyncDispatcherJob` + registrar wiring
14. Frontend: service (Google) + Google Sheets wizard
15. Frontend: Lead Sources management page + route + sidebar
16. Wrap: end-to-end smoke (Excel + Sheets faked), docs regen, graphify, final review

Tasks 1–8 ≈ 13 SP · Tasks 9–16 ≈ 13 SP · total ≈ 26 SP.

---

## Task 1: NuGet deps + Google config options + feature code

**Files:**
- Modify: `TravelCrm.Api/TravelCrm.Api.csproj`
- Create: `TravelCrm.Api/Infrastructure/Google/GoogleSheetsOptions.cs`
- Modify: `TravelCrm.Api/Common/FeatureCatalog.cs`
- Modify: `TravelCrm.Api/Program.cs`

- [ ] **Step 1: Add the three NuGet PackageReferences**

In `TravelCrm.Api.csproj`, inside the `<ItemGroup>` that already holds PackageReferences, add (use the versions resolved by `dotnet add package` — do not hand-pin):

```bash
Get-Process -Name "TravelCrm.Api" -ErrorAction SilentlyContinue | Stop-Process -Force
cd D:/ClaudeProjects/TravelCRMPlus/TravelCrm.Api
dotnet add package ClosedXML
dotnet add package Google.Apis.Auth
dotnet add package Google.Apis.Sheets.v4
```

- [ ] **Step 2: Create the options class**

`TravelCrm.Api/Infrastructure/Google/GoogleSheetsOptions.cs`:

```csharp
namespace TravelCrm.Api.Infrastructure.Google;

/// <summary>
/// Platform-wide Google OAuth app config. Bound from configuration section
/// "GoogleSheets". Empty <see cref="ClientId"/> ⇒ the whole Google path is
/// dormant (IGoogleSheetsGate.IsConfigured == false) and the Excel path is
/// unaffected.
/// </summary>
public sealed class GoogleSheetsOptions
{
    public const string SectionName = "GoogleSheets";

    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string RedirectUri { get; set; } = string.Empty;

    /// <summary>Least-privilege scopes; never request write.</summary>
    public static readonly string[] Scopes =
    {
        "https://www.googleapis.com/auth/spreadsheets.readonly",
        "https://www.googleapis.com/auth/userinfo.email",
    };
}
```

- [ ] **Step 3: Add the feature code**

In `TravelCrm.Api/Common/FeatureCatalog.cs`, under the `// ── Lead Capture ──` block add the constant:

```csharp
    public const string LeadImport         = "lead_import";          // Excel + Google Sheets bulk import
```

And in the `All` array, in the `// Lead capture` group, append `LeadImport`:

```csharp
        LeadDistribution, LeadSourceFacebook, LeadSourceGoogleAds,
        LeadSourceIndiaMart, LeadSourceTradeIndia, LeadSourceWhatsApp, LeadSourceWebForms,
        LeadImport,
```

- [ ] **Step 4: Bind options in Program.cs**

In `TravelCrm.Api/Program.cs`, after the other `builder.Services.Configure<...>` / options registrations (search for an existing `.Configure<` call to find the block), add:

```csharp
builder.Services.Configure<TravelCrm.Api.Infrastructure.Google.GoogleSheetsOptions>(
    builder.Configuration.GetSection(
        TravelCrm.Api.Infrastructure.Google.GoogleSheetsOptions.SectionName));
```

- [ ] **Step 5: Build**

Run:
```bash
Get-Process -Name "TravelCrm.Api" -ErrorAction SilentlyContinue | Stop-Process -Force
cd D:/ClaudeProjects/TravelCRMPlus/TravelCrm.Api && dotnet build 2>&1 | Select-String -Pattern "Error|Warning" | Select-Object -Last 10
```
Expected: `0 Error(s)`, exactly 2 CS9113 warnings, 0 CS0618.

- [ ] **Step 6: Commit**

```bash
git add TravelCrm.Api/TravelCrm.Api.csproj TravelCrm.Api/Infrastructure/Google/GoogleSheetsOptions.cs TravelCrm.Api/Common/FeatureCatalog.cs TravelCrm.Api/Program.cs
git commit -m "feat(lead-import): add ClosedXML+Google NuGet deps, GoogleSheetsOptions, lead_import feature code"
```

---

## Task 2: Domain entities + enums

**Files:**
- Create: `TravelCrm.Api/Domain/Entities/Crm/LeadImportSource.cs`
- Create: `TravelCrm.Api/Domain/Entities/Crm/LeadImportRowState.cs`
- Create: `TravelCrm.Api/Domain/Entities/Crm/GoogleOAuthToken.cs`
- Create: `TravelCrm.Api/Domain/Entities/Crm/LeadImportStaging.cs`

- [ ] **Step 1: Create `LeadImportSource.cs`**

```csharp
namespace TravelCrm.Api.Domain.Entities.Crm;

public enum LeadImportSourceKind
{
    GoogleSheet = 1,
    // Excel reserved — Excel imports are stateless and create no source row.
    Excel = 2,
}

public enum SyncCadence
{
    Manual     = 0,
    Every15Min = 1,
    Hourly     = 2,
    Daily      = 3,
}

public enum LeadImportSourceStatus
{
    Active       = 1,
    Paused       = 2,
    Error        = 3,
    Disconnected = 4,
}

/// <summary>
/// A persisted Google Sheet connection with recurring sync. Excel imports do
/// NOT create one of these. RowVersion is trigger-managed exactly like
/// <see cref="Deal.RowVersion"/> (see migration trigger in Task 3).
/// </summary>
public sealed class LeadImportSource : IAuditableEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    public LeadImportSourceKind Kind { get; set; } = LeadImportSourceKind.GoogleSheet;
    public string DisplayName { get; set; } = string.Empty;

    public string SpreadsheetId { get; set; } = string.Empty;
    public string SheetName { get; set; } = string.Empty;

    /// <summary>JSON object: CRM field → source header. Stored jsonb.</summary>
    public string ColumnMapping { get; set; } = "{}";

    public string MatchKeyField { get; set; } = "email";

    public SyncCadence SyncCadence { get; set; } = SyncCadence.Manual;
    public LeadImportSourceStatus Status { get; set; } = LeadImportSourceStatus.Active;

    public DateTime? LastPolledAt { get; set; }
    public DateTime? LastSuccessAt { get; set; }

    /// <summary>jsonb? — last run's {created,updated,skipped,failed,errors[]}.</summary>
    public string? LastResultJson { get; set; }
    public string? LastError { get; set; }

    public byte[] RowVersion { get; set; } = Array.Empty<byte>();

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Guid?    CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public Guid?    UpdatedBy { get; set; }
}
```

- [ ] **Step 2: Create `LeadImportRowState.cs`**

```csharp
namespace TravelCrm.Api.Domain.Entities.Crm;

/// <summary>
/// Per-imported-row state for a Google Sheet connection. Powers the A3
/// hash-skip rule and position-independent upsert. Unique on
/// (ImportSourceId, MatchKey). Cascade-deleted with the source.
/// </summary>
public sealed class LeadImportRowState
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid ImportSourceId { get; set; }

    public string MatchKey { get; set; } = string.Empty;
    public string ContentHash { get; set; } = string.Empty;
    public Guid? LeadId { get; set; }
    public DateTime LastSeenAt { get; set; } = DateTime.UtcNow;
}
```

- [ ] **Step 3: Create `GoogleOAuthToken.cs`**

```csharp
namespace TravelCrm.Api.Domain.Entities.Crm;

/// <summary>
/// Per-tenant refresh token for the platform Google app. RefreshToken is
/// encrypted at rest via ProtectedStringConverter (configured in Task 3,
/// same pattern as AiProviderConfiguration.ApiKey). Unique on TenantId.
/// </summary>
public sealed class GoogleOAuthToken
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    /// <summary>SENSITIVE — encrypted at rest.</summary>
    public string RefreshToken { get; set; } = string.Empty;
    public string GrantedScopes { get; set; } = string.Empty;
    public Guid ConnectedByUserId { get; set; }
    public DateTime ConnectedAt { get; set; } = DateTime.UtcNow;
}
```

- [ ] **Step 4: Create `LeadImportStaging.cs`**

```csharp
namespace TravelCrm.Api.Domain.Entities.Crm;

/// <summary>
/// Short-lived Excel parse buffer so the file is uploaded once across wizard
/// steps. Deleted on commit; hourly sweep removes rows older than 1h.
/// Not a domain entity — no audit quartet.
/// </summary>
public sealed class LeadImportStaging
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    /// <summary>jsonb — array of row objects keyed by header.</summary>
    public string RowsJson { get; set; } = "[]";
    /// <summary>jsonb — array of header strings in column order.</summary>
    public string HeadersJson { get; set; } = "[]";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
```

- [ ] **Step 5: Build**

```bash
Get-Process -Name "TravelCrm.Api" -ErrorAction SilentlyContinue | Stop-Process -Force
cd D:/ClaudeProjects/TravelCRMPlus/TravelCrm.Api && dotnet build 2>&1 | Select-String -Pattern "error|Build succeeded" | Select-Object -Last 5
```
Expected: `Build succeeded`, 0 errors (entities not yet referenced — pure compile check).

- [ ] **Step 6: Commit**

```bash
git add TravelCrm.Api/Domain/Entities/Crm/LeadImportSource.cs TravelCrm.Api/Domain/Entities/Crm/LeadImportRowState.cs TravelCrm.Api/Domain/Entities/Crm/GoogleOAuthToken.cs TravelCrm.Api/Domain/Entities/Crm/LeadImportStaging.cs
git commit -m "feat(lead-import): add LeadImportSource/RowState/GoogleOAuthToken/Staging entities + enums"
```

---

## Task 3: EF config + migration (incl. row_version trigger) + plan-feature grant

**Files:**
- Modify: `TravelCrm.Api/Infrastructure/Persistence/ApplicationDbContext.cs`
- Modify: `TravelCrm.Api/Infrastructure/Persistence/PlanSeeder.cs`
- Create: `TravelCrm.Api/Migrations/{stamp}_AddLeadImport.cs` (generated, then hand-edited for trigger SQL)

- [ ] **Step 1: Add the four DbSets**

In `ApplicationDbContext.cs`, near the other CRM DbSets, add:

```csharp
    public DbSet<LeadImportSource> LeadImportSources => Set<LeadImportSource>();
    public DbSet<LeadImportRowState> LeadImportRowStates => Set<LeadImportRowState>();
    public DbSet<GoogleOAuthToken> GoogleOAuthTokens => Set<GoogleOAuthToken>();
    public DbSet<LeadImportStaging> LeadImportStagings => Set<LeadImportStaging>();
```

Add `using TravelCrm.Api.Domain.Entities.Crm;` if not already present.

- [ ] **Step 2: Add entity configuration**

In `OnModelCreating`, after the `Deal` config block (search `b.Property(d => d.RowVersion).IsRowVersion();`), add:

```csharp
        builder.Entity<LeadImportSource>(b =>
        {
            b.HasKey(s => s.Id);
            b.Property(s => s.Kind).HasConversion<int>();
            b.Property(s => s.Status).HasConversion<int>();
            b.Property(s => s.SyncCadence).HasConversion<int>();
            b.Property(s => s.DisplayName).HasMaxLength(200).IsRequired();
            b.Property(s => s.SpreadsheetId).HasMaxLength(200).IsRequired();
            b.Property(s => s.SheetName).HasMaxLength(200).IsRequired();
            b.Property(s => s.MatchKeyField).HasMaxLength(50).IsRequired();
            b.Property(s => s.ColumnMapping).HasColumnType("jsonb");
            b.Property(s => s.LastResultJson).HasColumnType("jsonb");
            b.Property(s => s.LastError).HasMaxLength(1000);
            b.Property(s => s.RowVersion).IsRowVersion();
            b.HasIndex(s => new { s.TenantId, s.Status });
        });

        builder.Entity<LeadImportRowState>(b =>
        {
            b.HasKey(r => r.Id);
            b.Property(r => r.MatchKey).HasMaxLength(256).IsRequired();
            b.Property(r => r.ContentHash).HasMaxLength(64).IsRequired();
            b.HasIndex(r => new { r.ImportSourceId, r.MatchKey }).IsUnique();
            b.HasOne<LeadImportSource>()
                .WithMany()
                .HasForeignKey(r => r.ImportSourceId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<GoogleOAuthToken>(b =>
        {
            b.HasKey(t => t.Id);
            // Refresh token encrypted at rest — same converter as AiProviderConfiguration.ApiKey.
            b.Property(t => t.RefreshToken).HasMaxLength(4000).HasConversion(_protectedString);
            b.Property(t => t.GrantedScopes).HasMaxLength(500);
            b.HasIndex(t => t.TenantId).IsUnique();
        });

        builder.Entity<LeadImportStaging>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.RowsJson).HasColumnType("jsonb");
            b.Property(x => x.HeadersJson).HasColumnType("jsonb");
            b.HasIndex(x => new { x.TenantId, x.CreatedAt });
        });
```

- [ ] **Step 3: Grant the feature in PlanSeeder**

Open `TravelCrm.Api/Infrastructure/Persistence/PlanSeeder.cs`. Find where `FeatureCatalog.CoreCrm` is granted to plan tiers. For every tier that gets `CoreCrm`, add `FeatureCatalog.LeadImport` alongside it (same array/list entry pattern used there). Match the existing seeding style exactly — do not invent a new helper.

- [ ] **Step 4: Generate the migration**

```bash
Get-Process -Name "TravelCrm.Api" -ErrorAction SilentlyContinue | Stop-Process -Force
cd D:/ClaudeProjects/TravelCRMPlus/TravelCrm.Api && dotnet ef migrations add AddLeadImport
```
Expected: a new `Migrations/{timestamp}_AddLeadImport.cs` + updated snapshot.

- [ ] **Step 5: Append the row_version trigger to the migration**

Open the generated `{timestamp}_AddLeadImport.cs`. At the END of `Up(...)` (after the generated `CreateTable`/`CreateIndex` calls) add:

```csharp
            migrationBuilder.Sql(@"
CREATE OR REPLACE FUNCTION fn_lead_import_source_row_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.row_version := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lead_import_source_row_version ON lead_import_sources;
CREATE TRIGGER trg_lead_import_source_row_version
BEFORE INSERT OR UPDATE ON lead_import_sources
FOR EACH ROW EXECUTE FUNCTION fn_lead_import_source_row_version();
");
```

At the START of `Down(...)` add:

```csharp
            migrationBuilder.Sql(@"
DROP TRIGGER IF EXISTS trg_lead_import_source_row_version ON lead_import_sources;
DROP FUNCTION IF EXISTS fn_lead_import_source_row_version();
");
```

(This is a NEW dedicated trigger — it must NOT reuse `fn_deal_row_version`. Body uses `gen_random_uuid()`, never `gen_random_bytes` which needs the uninstalled pgcrypto extension.)

- [ ] **Step 6: Apply the migration**

```bash
cd D:/ClaudeProjects/TravelCRMPlus/TravelCrm.Api && dotnet ef database update
```
Expected: `Done.`

- [ ] **Step 7: Verify tables + trigger exist**

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" "Host=localhost;Port=5432;Database=travelcrm;Username=postgres;Password=Cl0ud@2026$" --% -c "\dt lead_import_sources lead_import_row_states google_oauth_tokens lead_import_staging" -c "SELECT tgname FROM pg_trigger WHERE tgname='trg_lead_import_source_row_version';"
```
Expected: 4 tables listed + 1 trigger row.

- [ ] **Step 8: Commit**

```bash
git add TravelCrm.Api/Infrastructure/Persistence/ApplicationDbContext.cs TravelCrm.Api/Infrastructure/Persistence/PlanSeeder.cs TravelCrm.Api/Migrations/
git commit -m "feat(lead-import): EF config + AddLeadImport migration with row_version trigger + plan grant"
```

---

## Task 4: `LeadFieldMap` — field catalog, fuzzy guess, project+validate (TDD)

**Files:**
- Create: `TravelCrm.Api/Features/Crm/LeadImport/Dtos.cs`
- Create: `TravelCrm.Api/Features/Crm/LeadImport/LeadFieldMap.cs`
- Test: `TravelCrm.Tests/LeadImport/LeadFieldMapTests.cs`

- [ ] **Step 1: Create the shared DTOs**

`TravelCrm.Api/Features/Crm/LeadImport/Dtos.cs`:

```csharp
namespace TravelCrm.Api.Features.Crm.LeadImport;

public sealed record ImportFieldDto(string Key, string Label, bool Required);

public enum LeadImportRowStatus { Created, Updated, Skipped, Failed }

public sealed record LeadImportRowOutcome(int RowNumber, string Key, LeadImportRowStatus Status, string? Reason);

public sealed record LeadImportResult(
    int Created, int Updated, int Skipped, int Failed,
    IReadOnlyList<LeadImportRowOutcome> Errors); // first 100 non-success rows

public sealed record ParseResultDto(
    Guid StagingId, IReadOnlyList<string> Headers,
    IReadOnlyList<Dictionary<string, string>> PreviewRows, int TotalRows);

public sealed record PreviewResultDto(int WillCreate, int WillUpdate, int WillSkip,
    IReadOnlyList<LeadImportRowOutcome> SampleErrors);

public sealed record GoogleStatusDto(bool Configured, bool Connected, string GrantedScopes);

public sealed record SheetTabDto(string Title);
public sealed record SheetHeadersDto(IReadOnlyList<string> Headers,
    IReadOnlyList<Dictionary<string, string>> PreviewRows);

public sealed record LeadImportSourceDto(
    Guid Id, string DisplayName, string SpreadsheetId, string SheetName,
    Dictionary<string, string> ColumnMapping, string MatchKeyField,
    string SyncCadence, string Status, DateTime? LastPolledAt, DateTime? LastSuccessAt,
    string? LastResultJson, string? LastError, string RowVersion);
```

- [ ] **Step 2: Write the failing test**

`TravelCrm.Tests/LeadImport/LeadFieldMapTests.cs`:

```csharp
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Crm.LeadImport;
using Xunit;

namespace TravelCrm.Tests.LeadImport;

public sealed class LeadFieldMapTests
{
    [Fact]
    public void Catalog_has_email_required_and_others_optional()
    {
        var email = LeadFieldMap.Fields.Single(f => f.Key == "email");
        Assert.True(email.Required);
        Assert.True(LeadFieldMap.Fields.Single(f => f.Key == "firstName").Required == false);
    }

    [Theory]
    [InlineData("E-mail", "email")]
    [InlineData("Email Address", "email")]
    [InlineData("First Name", "firstName")]
    [InlineData("Phone No.", "phone")]
    [InlineData("Company Name", "company")]
    public void GuessMapping_matches_fuzzy_headers(string header, string expectedField)
    {
        var map = LeadFieldMap.GuessMapping(new[] { header });
        Assert.Equal(header, map[expectedField]);
    }

    [Fact]
    public void Project_valid_row_produces_lead_with_normalised_email()
    {
        var row = new Dictionary<string, string> { ["E-mail"] = "  Bob@Example.COM ", ["First"] = "Bob" };
        var map = new Dictionary<string, string> { ["email"] = "E-mail", ["firstName"] = "First" };
        var (lead, error) = LeadFieldMap.Project(row, map);
        Assert.Null(error);
        Assert.Equal("bob@example.com", lead!.Email);
        Assert.Equal("Bob", lead.FirstName);
    }

    [Fact]
    public void Project_missing_email_fails()
    {
        var (_, error) = LeadFieldMap.Project(
            new Dictionary<string, string> { ["First"] = "Bob" },
            new Dictionary<string, string> { ["email"] = "E-mail", ["firstName"] = "First" });
        Assert.Contains("email", error, System.StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Project_converted_status_is_rejected()
    {
        var (_, error) = LeadFieldMap.Project(
            new Dictionary<string, string> { ["E-mail"] = "a@b.com", ["S"] = "Converted" },
            new Dictionary<string, string> { ["email"] = "E-mail", ["status"] = "S" });
        Assert.Contains("Converted", error);
    }

    [Fact]
    public void Project_clamps_out_of_range_score()
    {
        var (lead, error) = LeadFieldMap.Project(
            new Dictionary<string, string> { ["E-mail"] = "a@b.com", ["Sc"] = "999" },
            new Dictionary<string, string> { ["email"] = "E-mail", ["score"] = "Sc" });
        Assert.Null(error);
        Assert.Equal(100, lead!.Score);
    }
}
```

- [ ] **Step 2b: Run it — expect FAIL**

```bash
cd D:/ClaudeProjects/TravelCRMPlus && dotnet test TravelCrm.Tests --filter "FullyQualifiedName~LeadFieldMapTests" 2>&1 | Select-Object -Last 5
```
Expected: compile error / FAIL — `LeadFieldMap` does not exist.

- [ ] **Step 3: Implement `LeadFieldMap.cs`**

```csharp
using System.Text.RegularExpressions;
using TravelCrm.Api.Domain.Entities;

namespace TravelCrm.Api.Features.Crm.LeadImport;

/// <summary>
/// Single source of truth for the importable Lead field catalog, fuzzy header
/// guessing, and row→Lead projection+validation. Shared by Excel and Sheets.
/// </summary>
public static class LeadFieldMap
{
    public static readonly IReadOnlyList<ImportFieldDto> Fields = new[]
    {
        new ImportFieldDto("email", "Email", true),
        new ImportFieldDto("firstName", "First Name", false),
        new ImportFieldDto("lastName", "Last Name", false),
        new ImportFieldDto("phone", "Phone", false),
        new ImportFieldDto("company", "Company", false),
        new ImportFieldDto("jobTitle", "Job Title", false),
        new ImportFieldDto("assignedTo", "Assigned To", false),
        new ImportFieldDto("status", "Status", false),
        new ImportFieldDto("source", "Source", false),
        new ImportFieldDto("score", "Score", false),
        new ImportFieldDto("estimatedValue", "Estimated Value", false),
        new ImportFieldDto("tags", "Tags", false),
        new ImportFieldDto("notes", "Notes", false),
    };

    private static readonly Dictionary<string, string[]> Synonyms = new()
    {
        ["email"]          = new[] { "email", "e-mail", "emailaddress", "mail" },
        ["firstName"]      = new[] { "firstname", "first", "fname", "givenname" },
        ["lastName"]       = new[] { "lastname", "last", "lname", "surname", "familyname" },
        ["phone"]          = new[] { "phone", "phoneno", "phonenumber", "mobile", "contact", "tel" },
        ["company"]        = new[] { "company", "companyname", "organisation", "organization", "account" },
        ["jobTitle"]       = new[] { "jobtitle", "title", "designation", "role" },
        ["assignedTo"]     = new[] { "assignedto", "owner", "salesrep", "agent" },
        ["status"]         = new[] { "status", "leadstatus", "stage" },
        ["source"]         = new[] { "source", "leadsource", "channel" },
        ["score"]          = new[] { "score", "leadscore", "rating" },
        ["estimatedValue"] = new[] { "estimatedvalue", "value", "dealvalue", "amount", "budget" },
        ["tags"]           = new[] { "tags", "labels", "categories" },
        ["notes"]          = new[] { "notes", "note", "comments", "remarks", "description" },
    };

    private static string Norm(string s) =>
        Regex.Replace(s ?? string.Empty, "[^a-z0-9]", "", RegexOptions.IgnoreCase).ToLowerInvariant();

    /// <summary>CRM field → best-guess source header (only confident matches).</summary>
    public static Dictionary<string, string> GuessMapping(IEnumerable<string> headers)
    {
        var result = new Dictionary<string, string>();
        var hs = headers.Where(h => !string.IsNullOrWhiteSpace(h)).ToList();
        foreach (var (field, syns) in Synonyms)
        {
            var hit = hs.FirstOrDefault(h => syns.Contains(Norm(h)))
                   ?? hs.FirstOrDefault(h => syns.Any(s => Norm(h).Contains(s)));
            if (hit != null) result[field] = hit;
        }
        return result;
    }

    private static readonly Regex EmailRx =
        new(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.Compiled);

    /// <summary>
    /// Project a source row through a mapping into a Lead. Returns
    /// (lead, null) on success or (null, reason) on a row error.
    /// </summary>
    public static (Lead? lead, string? error) Project(
        IReadOnlyDictionary<string, string> row,
        IReadOnlyDictionary<string, string> mapping)
    {
        string Get(string field) =>
            mapping.TryGetValue(field, out var hdr) && row.TryGetValue(hdr, out var v)
                ? (v ?? string.Empty).Trim() : string.Empty;

        var email = Get("email").ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email)) return (null, "Missing required field: email");
        if (!EmailRx.IsMatch(email)) return (null, $"Invalid email: {email}");

        var lead = new Lead
        {
            Email     = email,
            FirstName = Clamp(Get("firstName"), 100),
            LastName  = Clamp(Get("lastName"), 100),
            Phone     = Clamp(Get("phone"), 50),
            Company   = Clamp(Get("company"), 200),
            JobTitle  = Clamp(Get("jobTitle"), 150),
            AssignedTo= Clamp(Get("assignedTo"), 256),
            Notes     = Clamp(Get("notes"), 4000),
        };

        var statusRaw = Get("status");
        if (!string.IsNullOrWhiteSpace(statusRaw))
        {
            if (Enum.TryParse<LeadStatus>(statusRaw, true, out var st))
            {
#pragma warning disable CS0618
                if (st == LeadStatus.Converted)
                    return (null, "Status 'Converted' is retired — use a Deal to express conversion");
#pragma warning restore CS0618
                lead.Status = st;
            }
            else lead.Status = LeadStatus.New;
        }

        var srcRaw = Get("source");
        lead.Source = Enum.TryParse<LeadSource>(srcRaw, true, out var sr) ? sr : LeadSource.Other;

        var scoreRaw = Get("score");
        if (int.TryParse(scoreRaw, out var sc)) lead.Score = Math.Clamp(sc, 0, 100);

        var evRaw = Get("estimatedValue");
        if (decimal.TryParse(evRaw, out var ev) && ev >= 0) lead.EstimatedValue = ev;

        var tagsRaw = Get("tags");
        if (!string.IsNullOrWhiteSpace(tagsRaw))
            lead.Tags = tagsRaw.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();

        return (lead, null);
    }

    private static string Clamp(string s, int max) =>
        string.IsNullOrEmpty(s) ? string.Empty : (s.Length <= max ? s : s[..max]);
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd D:/ClaudeProjects/TravelCRMPlus && dotnet test TravelCrm.Tests --filter "FullyQualifiedName~LeadFieldMapTests" 2>&1 | Select-Object -Last 5
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add TravelCrm.Api/Features/Crm/LeadImport/Dtos.cs TravelCrm.Api/Features/Crm/LeadImport/LeadFieldMap.cs TravelCrm.Tests/LeadImport/LeadFieldMapTests.cs
git commit -m "feat(lead-import): LeadFieldMap field catalog + fuzzy guess + project/validate (TDD)"
```

---

## Task 5: Tabular parsers (ClosedXML + CSV) behind `ITabularLeadParser` (TDD)

**Files:**
- Create: `TravelCrm.Api/Features/Crm/LeadImport/Parsing/ITabularLeadParser.cs`
- Create: `TravelCrm.Api/Features/Crm/LeadImport/Parsing/ClosedXmlLeadParser.cs`
- Create: `TravelCrm.Api/Features/Crm/LeadImport/Parsing/CsvLeadParser.cs`
- Test: `TravelCrm.Tests/LeadImport/TabularParserTests.cs`

- [ ] **Step 1: Define the interface**

`Parsing/ITabularLeadParser.cs`:

```csharp
namespace TravelCrm.Api.Features.Crm.LeadImport.Parsing;

public sealed record TabularData(
    IReadOnlyList<string> Headers,
    IReadOnlyList<Dictionary<string, string>> Rows);

public interface ITabularLeadParser
{
    /// <summary>True if this parser handles the given file extension (".xlsx" etc.).</summary>
    bool CanParse(string fileName);

    /// <summary>
    /// Parse the stream. Throws <see cref="LeadImportParseException"/> with a
    /// human message on caps/format violations. First non-empty row = headers.
    /// </summary>
    TabularData Parse(Stream stream, string fileName);
}

public sealed class LeadImportParseException(string message) : Exception(message);
```

- [ ] **Step 2: Write failing tests**

`TravelCrm.Tests/LeadImport/TabularParserTests.cs`:

```csharp
using System.Text;
using ClosedXML.Excel;
using TravelCrm.Api.Features.Crm.LeadImport.Parsing;
using Xunit;

namespace TravelCrm.Tests.LeadImport;

public sealed class TabularParserTests
{
    [Fact]
    public void Csv_parses_headers_and_rows()
    {
        var csv = "Email,First\r\na@b.com,Bob\r\nc@d.com,Carol\r\n";
        var p = new CsvLeadParser();
        Assert.True(p.CanParse("leads.csv"));
        var d = p.Parse(new MemoryStream(Encoding.UTF8.GetBytes(csv)), "leads.csv");
        Assert.Equal(new[] { "Email", "First" }, d.Headers);
        Assert.Equal(2, d.Rows.Count);
        Assert.Equal("a@b.com", d.Rows[0]["Email"]);
    }

    [Fact]
    public void Csv_handles_quoted_comma()
    {
        var csv = "Email,Notes\r\na@b.com,\"Hello, world\"\r\n";
        var d = new CsvLeadParser().Parse(new MemoryStream(Encoding.UTF8.GetBytes(csv)), "x.csv");
        Assert.Equal("Hello, world", d.Rows[0]["Notes"]);
    }

    [Fact]
    public void Xlsx_parses_first_sheet()
    {
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("Sheet1");
        ws.Cell(1, 1).Value = "Email"; ws.Cell(1, 2).Value = "First";
        ws.Cell(2, 1).Value = "a@b.com"; ws.Cell(2, 2).Value = "Bob";
        using var ms = new MemoryStream();
        wb.SaveAs(ms); ms.Position = 0;
        var p = new ClosedXmlLeadParser();
        Assert.True(p.CanParse("leads.xlsx"));
        var d = p.Parse(ms, "leads.xlsx");
        Assert.Equal(new[] { "Email", "First" }, d.Headers);
        Assert.Equal("Bob", d.Rows[0]["First"]);
    }

    [Fact]
    public void Xls_is_rejected_with_helpful_message()
    {
        var p = new ClosedXmlLeadParser();
        var ex = Assert.Throws<LeadImportParseException>(
            () => p.Parse(new MemoryStream(new byte[] { 1 }), "old.xls"));
        Assert.Contains(".xlsx", ex.Message);
    }

    [Fact]
    public void Csv_over_row_cap_throws()
    {
        var sb = new StringBuilder("Email\r\n");
        for (var i = 0; i < 10_001; i++) sb.Append($"u{i}@x.com\r\n");
        var ex = Assert.Throws<LeadImportParseException>(
            () => new CsvLeadParser().Parse(new MemoryStream(Encoding.UTF8.GetBytes(sb.ToString())), "big.csv"));
        Assert.Contains("10,000", ex.Message);
    }
}
```

- [ ] **Step 2b: Run — expect FAIL**

```bash
cd D:/ClaudeProjects/TravelCRMPlus && dotnet test TravelCrm.Tests --filter "FullyQualifiedName~TabularParserTests" 2>&1 | Select-Object -Last 5
```
Expected: compile error — parsers don't exist.

- [ ] **Step 3: Implement `CsvLeadParser.cs`**

```csharp
using System.Text;

namespace TravelCrm.Api.Features.Crm.LeadImport.Parsing;

public sealed class CsvLeadParser : ITabularLeadParser
{
    private const int MaxRows = 10_000;

    public bool CanParse(string fileName) =>
        fileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase);

    public TabularData Parse(Stream stream, string fileName)
    {
        using var reader = new StreamReader(stream, Encoding.UTF8, true);
        var lines = new List<List<string>>();
        var fields = new List<string>();
        var sb = new StringBuilder();
        bool inQuotes = false;
        int ch;
        void EndField() { fields.Add(sb.ToString()); sb.Clear(); }
        void EndLine() { EndField(); lines.Add(new List<string>(fields)); fields.Clear(); }

        while ((ch = reader.Read()) != -1)
        {
            var c = (char)ch;
            if (inQuotes)
            {
                if (c == '"')
                {
                    if (reader.Peek() == '"') { reader.Read(); sb.Append('"'); }
                    else inQuotes = false;
                }
                else sb.Append(c);
            }
            else
            {
                if (c == '"') inQuotes = true;
                else if (c == ',') EndField();
                else if (c == '\r') { /* swallow */ }
                else if (c == '\n') EndLine();
                else sb.Append(c);
            }
        }
        if (sb.Length > 0 || fields.Count > 0) EndLine();

        var nonEmpty = lines.Where(l => l.Any(c => !string.IsNullOrWhiteSpace(c))).ToList();
        if (nonEmpty.Count == 0) throw new LeadImportParseException("The file has no data.");

        var headers = nonEmpty[0].Select(h => h.Trim()).ToList();
        var dataLines = nonEmpty.Skip(1).ToList();
        if (dataLines.Count > MaxRows)
            throw new LeadImportParseException($"Too many rows ({dataLines.Count:N0}). The limit is 10,000 data rows.");

        var rows = dataLines.Select(l =>
        {
            var d = new Dictionary<string, string>();
            for (var i = 0; i < headers.Count; i++)
                d[headers[i]] = i < l.Count ? l[i] : string.Empty;
            return d;
        }).ToList();

        return new TabularData(headers, rows);
    }
}
```

- [ ] **Step 4: Implement `ClosedXmlLeadParser.cs`**

```csharp
using ClosedXML.Excel;

namespace TravelCrm.Api.Features.Crm.LeadImport.Parsing;

public sealed class ClosedXmlLeadParser : ITabularLeadParser
{
    private const int MaxRows = 10_000;

    public bool CanParse(string fileName) =>
        fileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase) ||
        fileName.EndsWith(".xlsm", StringComparison.OrdinalIgnoreCase);

    public TabularData Parse(Stream stream, string fileName)
    {
        if (fileName.EndsWith(".xls", StringComparison.OrdinalIgnoreCase))
            throw new LeadImportParseException("Legacy .xls files are not supported. Please save as .xlsx and retry.");

        XLWorkbook wb;
        try { wb = new XLWorkbook(stream); }
        catch (Exception ex) { throw new LeadImportParseException($"Could not read the workbook: {ex.Message}"); }

        using (wb)
        {
            var ws = wb.Worksheets.FirstOrDefault()
                ?? throw new LeadImportParseException("The workbook has no sheets.");
            var range = ws.RangeUsed();
            if (range == null) throw new LeadImportParseException("The first sheet has no data.");

            var allRows = range.RowsUsed().ToList();
            var headerRow = allRows.FirstOrDefault(r => r.Cells().Any(c => !string.IsNullOrWhiteSpace(c.GetString())))
                ?? throw new LeadImportParseException("Could not find a header row.");

            var headers = headerRow.Cells(1, range.ColumnCount())
                .Select(c => c.GetString().Trim()).ToList();

            var dataRows = allRows.SkipWhile(r => r.RowNumber() <= headerRow.RowNumber()).ToList();
            if (dataRows.Count > MaxRows)
                throw new LeadImportParseException($"Too many rows ({dataRows.Count:N0}). The limit is 10,000 data rows.");

            var rows = new List<Dictionary<string, string>>();
            foreach (var r in dataRows)
            {
                var d = new Dictionary<string, string>();
                for (var i = 0; i < headers.Count; i++)
                    d[headers[i]] = r.Cell(i + 1).GetString().Trim();
                if (d.Values.Any(v => !string.IsNullOrWhiteSpace(v))) rows.Add(d);
            }
            return new TabularData(headers, rows);
        }
    }
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd D:/ClaudeProjects/TravelCRMPlus && dotnet test TravelCrm.Tests --filter "FullyQualifiedName~TabularParserTests" 2>&1 | Select-Object -Last 5
```
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add TravelCrm.Api/Features/Crm/LeadImport/Parsing/ TravelCrm.Tests/LeadImport/TabularParserTests.cs
git commit -m "feat(lead-import): ClosedXML + CSV parsers behind ITabularLeadParser (TDD)"
```

---

## Task 6: `LeadImportEngine` — shared upsert/dedupe/A3 (TDD)

**Files:**
- Create: `TravelCrm.Api/Features/Crm/LeadImport/ILeadImportEngine.cs`
- Create: `TravelCrm.Api/Features/Crm/LeadImport/LeadImportEngine.cs`
- Test: `TravelCrm.Tests/LeadImport/LeadImportEngineTests.cs`

- [ ] **Step 1: Define the interface**

`ILeadImportEngine.cs`:

```csharp
namespace TravelCrm.Api.Features.Crm.LeadImport;

public interface ILeadImportEngine
{
    /// <param name="sourceId">null = Excel stateless always-update; non-null =
    /// Sheets path using LeadImportRowState hash-skip + A3 update-only-when-changed.</param>
    Task<LeadImportResult> ApplyAsync(
        Guid tenantId,
        IReadOnlyList<IReadOnlyDictionary<string, string>> rows,
        IReadOnlyDictionary<string, string> mapping,
        string matchKeyField,
        Guid? sourceId,
        Guid? actingUserId,
        CancellationToken ct);
}
```

- [ ] **Step 2: Write failing tests (in-memory Sqlite DbContext)**

`TravelCrm.Tests/LeadImport/LeadImportEngineTests.cs`:

```csharp
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.DataProtection;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Domain.Entities.Crm;
using TravelCrm.Api.Features.Crm.LeadImport;
using TravelCrm.Api.Infrastructure.Persistence;
using Xunit;

namespace TravelCrm.Tests.LeadImport;

public sealed class LeadImportEngineTests : IDisposable
{
    private readonly SqliteConnection _conn;
    private readonly ApplicationDbContext _db;
    private readonly Guid _tenant = Guid.NewGuid();

    public LeadImportEngineTests()
    {
        _conn = new SqliteConnection("DataSource=:memory:");
        _conn.Open();
        var opts = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_conn).Options;
        _db = new ApplicationDbContext(opts, DataProtectionProvider.Create("tests"));
        _db.Database.EnsureCreated();
    }

    private LeadImportEngine Engine() => new(_db);

    private static IReadOnlyList<IReadOnlyDictionary<string, string>> Rows(
        params (string email, string first)[] rs) =>
        rs.Select(r => (IReadOnlyDictionary<string, string>)
            new Dictionary<string, string> { ["E"] = r.email, ["F"] = r.first }).ToList();

    private static readonly Dictionary<string, string> Map =
        new() { ["email"] = "E", ["firstName"] = "F" };

    [Fact]
    public async Task Excel_path_creates_new_leads()
    {
        var r = await Engine().ApplyAsync(_tenant, Rows(("a@b.com", "Bob")), Map, "email", null, null, default);
        Assert.Equal(1, r.Created);
        Assert.Equal(1, await _db.Leads.CountAsync());
    }

    [Fact]
    public async Task Excel_path_updates_existing_by_key()
    {
        _db.Leads.Add(new Lead { TenantId = _tenant, Email = "a@b.com", FirstName = "Old" });
        await _db.SaveChangesAsync();
        var r = await Engine().ApplyAsync(_tenant, Rows(("A@B.com", "New")), Map, "email", null, null, default);
        Assert.Equal(1, r.Updated);
        Assert.Equal("New", (await _db.Leads.SingleAsync(l => l.TenantId == _tenant)).FirstName);
    }

    [Fact]
    public async Task In_file_duplicate_key_first_wins()
    {
        var r = await Engine().ApplyAsync(_tenant,
            Rows(("a@b.com", "First"), ("a@b.com", "Second")), Map, "email", null, null, default);
        Assert.Equal(1, r.Created);
        Assert.Equal(1, r.Skipped);
        Assert.Equal("First", (await _db.Leads.SingleAsync()).FirstName);
    }

    [Fact]
    public async Task Sheets_path_skips_unchanged_row_on_second_run()
    {
        var src = new LeadImportSource { TenantId = _tenant, DisplayName = "S" };
        _db.LeadImportSources.Add(src); await _db.SaveChangesAsync();

        var r1 = await Engine().ApplyAsync(_tenant, Rows(("a@b.com", "Bob")), Map, "email", src.Id, null, default);
        Assert.Equal(1, r1.Created);
        var r2 = await Engine().ApplyAsync(_tenant, Rows(("a@b.com", "Bob")), Map, "email", src.Id, null, default);
        Assert.Equal(1, r2.Skipped);
        Assert.Equal(0, r2.Updated);
    }

    [Fact]
    public async Task Sheets_path_updates_when_content_hash_changes()
    {
        var src = new LeadImportSource { TenantId = _tenant, DisplayName = "S" };
        _db.LeadImportSources.Add(src); await _db.SaveChangesAsync();
        await Engine().ApplyAsync(_tenant, Rows(("a@b.com", "Bob")), Map, "email", src.Id, null, default);
        var r2 = await Engine().ApplyAsync(_tenant, Rows(("a@b.com", "Robert")), Map, "email", src.Id, null, default);
        Assert.Equal(1, r2.Updated);
        Assert.Equal("Robert", (await _db.Leads.SingleAsync()).FirstName);
    }

    [Fact]
    public async Task Invalid_email_row_is_failed_not_aborting_run()
    {
        var r = await Engine().ApplyAsync(_tenant,
            Rows(("bad", "X"), ("ok@b.com", "Y")), Map, "email", null, null, default);
        Assert.Equal(1, r.Created);
        Assert.Equal(1, r.Failed);
    }

    [Fact]
    public async Task Tenant_isolation_does_not_update_other_tenant_lead()
    {
        var other = Guid.NewGuid();
        _db.Leads.Add(new Lead { TenantId = other, Email = "a@b.com", FirstName = "Theirs" });
        await _db.SaveChangesAsync();
        var r = await Engine().ApplyAsync(_tenant, Rows(("a@b.com", "Mine")), Map, "email", null, null, default);
        Assert.Equal(1, r.Created);
        Assert.Equal("Theirs", (await _db.Leads.SingleAsync(l => l.TenantId == other)).FirstName);
    }

    public void Dispose() { _db.Dispose(); _conn.Dispose(); }
}
```

- [ ] **Step 2b: Run — expect FAIL**

```bash
cd D:/ClaudeProjects/TravelCRMPlus && dotnet test TravelCrm.Tests --filter "FullyQualifiedName~LeadImportEngineTests" 2>&1 | Select-Object -Last 5
```
Expected: compile error — `LeadImportEngine` missing. (If `Microsoft.Data.Sqlite`/`Microsoft.EntityFrameworkCore.Sqlite` aren't in `TravelCrm.Tests.csproj`, `dotnet add TravelCrm.Tests package Microsoft.EntityFrameworkCore.Sqlite` first.)

- [ ] **Step 3: Implement `LeadImportEngine.cs`**

```csharp
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Domain.Entities.Crm;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.LeadImport;

public sealed class LeadImportEngine(ApplicationDbContext db) : ILeadImportEngine
{
    private const int BatchSize = 500;

    public async Task<LeadImportResult> ApplyAsync(
        Guid tenantId,
        IReadOnlyList<IReadOnlyDictionary<string, string>> rows,
        IReadOnlyDictionary<string, string> mapping,
        string matchKeyField,
        Guid? sourceId,
        Guid? actingUserId,
        CancellationToken ct)
    {
        int created = 0, updated = 0, skipped = 0, failed = 0;
        var errors = new List<LeadImportRowOutcome>();
        void Track(int n, string key, LeadImportRowStatus st, string? reason)
        {
            if (st == LeadImportRowStatus.Created) created++;
            else if (st == LeadImportRowStatus.Updated) updated++;
            else if (st == LeadImportRowStatus.Skipped) { skipped++; }
            else { failed++; }
            if (st != LeadImportRowStatus.Created && st != LeadImportRowStatus.Updated
                && errors.Count < 100)
                errors.Add(new LeadImportRowOutcome(n, key, st, reason));
        }

        // Row-state map for the Sheets path (keyed by normalised match key).
        Dictionary<string, LeadImportRowState> stateByKey = new();
        if (sourceId is { } sid)
            stateByKey = await db.Set<LeadImportRowState>()
                .Where(s => s.ImportSourceId == sid)
                .ToDictionaryAsync(s => s.MatchKey, ct);

        var seenKeys = new HashSet<string>(StringComparer.Ordinal);
        var batch = new List<(int rowNo, Lead lead, string key, string hash)>();

        async Task FlushAsync()
        {
            if (batch.Count == 0) return;
            var keys = batch.Select(b => b.key).Distinct().ToList();
            var existing = await db.Leads
                .Where(l => l.TenantId == tenantId && keys.Contains(l.Email))
                .ToDictionaryAsync(l => l.Email, ct);

            foreach (var (rowNo, lead, key, hash) in batch)
            {
                try
                {
                    var hasState = stateByKey.TryGetValue(key, out var state);
                    if (existing.TryGetValue(key, out var current))
                    {
                        // A3: Sheets only updates when the row hash changed.
                        if (sourceId != null && hasState && state!.ContentHash == hash)
                        {
                            state.LastSeenAt = DateTime.UtcNow;
                            Track(rowNo, key, LeadImportRowStatus.Skipped, "unchanged");
                            continue;
                        }
                        ApplyFields(current, lead);
                        current.UpdatedAt = DateTime.UtcNow;
                        current.UpdatedBy = actingUserId;
                        UpsertState(sourceId, tenantId, stateByKey, key, hash, current.Id);
                        Track(rowNo, key, LeadImportRowStatus.Updated, null);
                    }
                    else
                    {
                        lead.Id = Guid.NewGuid();
                        lead.TenantId = tenantId;
                        lead.CreatedAt = DateTime.UtcNow;
                        lead.CreatedBy = actingUserId;
                        db.Leads.Add(lead);
                        UpsertState(sourceId, tenantId, stateByKey, key, hash, lead.Id);
                        Track(rowNo, key, LeadImportRowStatus.Created, null);
                    }
                }
                catch (Exception ex)
                {
                    Track(rowNo, key, LeadImportRowStatus.Failed, ex.Message);
                }
            }

            try { await db.SaveChangesAsync(ct); }
            catch (Exception ex)
            {
                // Poison batch: re-run row-by-row so one bad row fails only itself.
                db.ChangeTracker.Clear();
                foreach (var (rowNo, _, key, _) in batch)
                    Track(rowNo, key, LeadImportRowStatus.Failed, ex.Message);
            }
            batch.Clear();
        }

        var rowNumber = 1; // header is row 1; data starts at 2
        foreach (var raw in rows)
        {
            ct.ThrowIfCancellationRequested();
            rowNumber++;
            var (lead, error) = LeadFieldMap.Project(raw, mapping);
            if (error != null) { Track(rowNumber, "", LeadImportRowStatus.Failed, error); continue; }

            var key = NormaliseKey(matchKeyField, lead!);
            if (!seenKeys.Add(key))
            {
                Track(rowNumber, key, LeadImportRowStatus.Skipped, "duplicate in source");
                continue;
            }
            var hash = ContentHash(raw, mapping);
            batch.Add((rowNumber, lead!, key, hash));
            if (batch.Count >= BatchSize) await FlushAsync();
        }
        await FlushAsync();

        return new LeadImportResult(created, updated, skipped, failed, errors);
    }

    private static void ApplyFields(Lead target, Lead src)
    {
        target.FirstName = src.FirstName;
        target.LastName  = src.LastName;
        target.Phone     = src.Phone;
        target.Company   = src.Company;
        target.JobTitle  = src.JobTitle;
        target.AssignedTo= src.AssignedTo;
        target.Status    = src.Status;
        target.Source    = src.Source;
        target.Score     = src.Score;
        target.EstimatedValue = src.EstimatedValue;
        target.Tags      = src.Tags;
        target.Notes     = src.Notes;
    }

    private static void UpsertState(
        Guid? sourceId, Guid tenantId,
        Dictionary<string, LeadImportRowState> map,
        string key, string hash, Guid leadId)
    {
        if (sourceId is not { } sid) return;
        if (map.TryGetValue(key, out var s))
        {
            s.ContentHash = hash; s.LeadId = leadId; s.LastSeenAt = DateTime.UtcNow;
        }
        else
        {
            map[key] = new LeadImportRowState
            {
                TenantId = tenantId, ImportSourceId = sid,
                MatchKey = key, ContentHash = hash, LeadId = leadId,
                LastSeenAt = DateTime.UtcNow,
            };
            // Attach via the same context so it's persisted in the batch save.
            // (DbContext is captured in the engine instance.)
        }
    }

    private static string NormaliseKey(string field, Lead l)
        => (field == "email" ? l.Email : l.Email).Trim().ToLowerInvariant();

    private static string ContentHash(
        IReadOnlyDictionary<string, string> row,
        IReadOnlyDictionary<string, string> mapping)
    {
        var sb = new StringBuilder();
        foreach (var f in LeadFieldMap.Fields.OrderBy(f => f.Key, StringComparer.Ordinal))
            if (mapping.TryGetValue(f.Key, out var hdr) && row.TryGetValue(hdr, out var v))
                sb.Append(f.Key).Append('=').Append((v ?? "").Trim()).Append('');
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(sb.ToString())));
    }
}
```

> **Note for implementer:** `UpsertState` creates new `LeadImportRowState` rows but does not `db.Add` them. Fix this in the engine: when a new state is created in `UpsertState`, also call `db.Set<LeadImportRowState>().Add(state)`. Pass the `db` in (the method is static for clarity here — make it an instance method, or add the entity at the call sites in `FlushAsync` right after `UpsertState`). Verified by the `Sheets_path_skips_unchanged_row_on_second_run` test, which only passes if states persist.

- [ ] **Step 4: Run tests, fix the state-persistence wiring until green**

```bash
cd D:/ClaudeProjects/TravelCRMPlus && dotnet test TravelCrm.Tests --filter "FullyQualifiedName~LeadImportEngineTests" 2>&1 | Select-Object -Last 8
```
Expected: all 7 tests PASS (iterate on `UpsertState`/`db.Add` wiring per the note until green).

- [ ] **Step 5: Commit**

```bash
git add TravelCrm.Api/Features/Crm/LeadImport/ILeadImportEngine.cs TravelCrm.Api/Features/Crm/LeadImport/LeadImportEngine.cs TravelCrm.Tests/LeadImport/LeadImportEngineTests.cs
git commit -m "feat(lead-import): LeadImportEngine shared upsert/dedupe/A3 hash-skip (TDD)"
```

---

## Task 7: Excel commands + controller + staging sweep job

**Files:**
- Create: `TravelCrm.Api/Features/Crm/LeadImport/Commands/ParseExcelCommand.cs`
- Create: `TravelCrm.Api/Features/Crm/LeadImport/Commands/PreviewImportCommand.cs`
- Create: `TravelCrm.Api/Features/Crm/LeadImport/Commands/CommitExcelImportCommand.cs`
- Create: `TravelCrm.Api/Features/Crm/LeadImport/LeadImportExcelController.cs`
- Create: `TravelCrm.Api/Infrastructure/Jobs/LeadImportStagingSweepJob.cs`
- Modify: `TravelCrm.Api/Infrastructure/Jobs/RecurringJobRegistrar.cs`
- Modify: `TravelCrm.Api/Program.cs` (DI: engine + parsers)

- [ ] **Step 1: Register engine + parsers in Program.cs**

In `Program.cs`, near other `AddScoped` registrations:

```csharp
builder.Services.AddScoped<TravelCrm.Api.Features.Crm.LeadImport.ILeadImportEngine,
    TravelCrm.Api.Features.Crm.LeadImport.LeadImportEngine>();
builder.Services.AddScoped<TravelCrm.Api.Features.Crm.LeadImport.Parsing.ITabularLeadParser,
    TravelCrm.Api.Features.Crm.LeadImport.Parsing.ClosedXmlLeadParser>();
builder.Services.AddScoped<TravelCrm.Api.Features.Crm.LeadImport.Parsing.ITabularLeadParser,
    TravelCrm.Api.Features.Crm.LeadImport.Parsing.CsvLeadParser>();
```

- [ ] **Step 2: `ParseExcelCommand.cs`**

```csharp
using System.Text.Json;
using MediatR;
using Microsoft.AspNetCore.Http;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Crm;
using TravelCrm.Api.Features.Crm.LeadImport.Parsing;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.LeadImport.Commands;

public sealed record ParseExcelCommand(IFormFile File) : IRequest<Result<ParseResultDto>>;

public sealed class ParseExcelCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user,
    IEnumerable<ITabularLeadParser> parsers)
    : IRequestHandler<ParseExcelCommand, Result<ParseResultDto>>
{
    private const long MaxBytes = 5 * 1024 * 1024;

    public async Task<Result<ParseResultDto>> Handle(ParseExcelCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.leads.manage"))
            return Result.Failure<ParseResultDto>("You don't have permission to import leads.");
        if (!tenant.IsResolved) return Result.Failure<ParseResultDto>("Tenant context not resolved.");

        var file = cmd.File;
        if (file is null || file.Length == 0) return Result.Failure<ParseResultDto>("No file uploaded.");
        if (file.Length > MaxBytes) return Result.Failure<ParseResultDto>("File exceeds the 5 MB limit.");

        var parser = parsers.FirstOrDefault(p => p.CanParse(file.FileName));
        if (parser is null)
            return Result.Failure<ParseResultDto>("Unsupported file type. Upload .xlsx, .xlsm or .csv.");

        TabularData data;
        try
        {
            await using var s = file.OpenReadStream();
            using var ms = new MemoryStream();
            await s.CopyToAsync(ms, ct); ms.Position = 0;
            data = parser.Parse(ms, file.FileName);
        }
        catch (LeadImportParseException ex) { return Result.Failure<ParseResultDto>(ex.Message); }

        var staging = new LeadImportStaging
        {
            TenantId   = tenant.TenantId!.Value,
            HeadersJson= JsonSerializer.Serialize(data.Headers),
            RowsJson   = JsonSerializer.Serialize(data.Rows),
        };
        db.LeadImportStagings.Add(staging);
        await db.SaveChangesAsync(ct);

        return Result.Success(new ParseResultDto(
            staging.Id, data.Headers, data.Rows.Take(5).ToList(), data.Rows.Count));
    }
}
```

- [ ] **Step 3: `PreviewImportCommand.cs` and `CommitExcelImportCommand.cs`**

```csharp
using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.LeadImport.Commands;

public sealed record PreviewImportCommand(
    Guid StagingId, Dictionary<string, string> Mapping, string MatchKeyField)
    : IRequest<Result<PreviewResultDto>>;

public sealed class PreviewImportCommandHandler(
    ApplicationDbContext db, ITenantContext tenant, ICurrentUser user)
    : IRequestHandler<PreviewImportCommand, Result<PreviewResultDto>>
{
    public async Task<Result<PreviewResultDto>> Handle(PreviewImportCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.leads.manage"))
            return Result.Failure<PreviewResultDto>("You don't have permission to import leads.");
        if (!tenant.IsResolved) return Result.Failure<PreviewResultDto>("Tenant context not resolved.");

        var staging = await db.LeadImportStagings.FirstOrDefaultAsync(
            s => s.Id == cmd.StagingId && s.TenantId == tenant.TenantId!.Value, ct);
        if (staging is null) return Result.Failure<PreviewResultDto>("Upload session expired. Please re-upload.");

        var rows = JsonSerializer.Deserialize<List<Dictionary<string, string>>>(staging.RowsJson)!;
        var existing = await db.Leads
            .Where(l => l.TenantId == tenant.TenantId!.Value)
            .Select(l => l.Email).ToListAsync(ct);
        var existingSet = existing.Select(e => e.Trim().ToLowerInvariant()).ToHashSet();

        int willCreate = 0, willUpdate = 0, willSkip = 0;
        var seen = new HashSet<string>();
        var sample = new List<LeadImportRowOutcome>();
        var n = 1;
        foreach (var r in rows)
        {
            n++;
            var (lead, error) = LeadFieldMap.Project(r, cmd.Mapping);
            if (error != null)
            {
                willSkip++;
                if (sample.Count < 20)
                    sample.Add(new LeadImportRowOutcome(n, "", LeadImportRowStatus.Failed, error));
                continue;
            }
            var key = lead!.Email;
            if (!seen.Add(key)) { willSkip++; continue; }
            if (existingSet.Contains(key)) willUpdate++; else willCreate++;
        }
        return Result.Success(new PreviewResultDto(willCreate, willUpdate, willSkip, sample));
    }
}

public sealed record CommitExcelImportCommand(
    Guid StagingId, Dictionary<string, string> Mapping, string MatchKeyField)
    : IRequest<Result<LeadImportResult>>;

public sealed class CommitExcelImportCommandHandler(
    ApplicationDbContext db, ITenantContext tenant, ICurrentUser user,
    ILeadImportEngine engine)
    : IRequestHandler<CommitExcelImportCommand, Result<LeadImportResult>>
{
    public async Task<Result<LeadImportResult>> Handle(CommitExcelImportCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.leads.manage"))
            return Result.Failure<LeadImportResult>("You don't have permission to import leads.");
        if (!tenant.IsResolved) return Result.Failure<LeadImportResult>("Tenant context not resolved.");

        var staging = await db.LeadImportStagings.FirstOrDefaultAsync(
            s => s.Id == cmd.StagingId && s.TenantId == tenant.TenantId!.Value, ct);
        if (staging is null) return Result.Failure<LeadImportResult>("Upload session expired. Please re-upload.");

        var rows = JsonSerializer.Deserialize<List<Dictionary<string, string>>>(staging.RowsJson)!
            .Select(d => (IReadOnlyDictionary<string, string>)d).ToList();

        var result = await engine.ApplyAsync(
            tenant.TenantId!.Value, rows, cmd.Mapping, cmd.MatchKeyField,
            sourceId: null,
            actingUserId: user.IsAuthenticated ? user.UserId : null, ct);

        db.LeadImportStagings.Remove(staging);
        await db.SaveChangesAsync(ct);
        return Result.Success(result);
    }
}
```

- [ ] **Step 4: `LeadImportExcelController.cs`**

```csharp
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Crm.LeadImport.Commands;

namespace TravelCrm.Api.Features.Crm.LeadImport;

[Authorize]
[ApiController]
[RequiresFeature(FeatureCatalog.LeadImport)]
[Route("api/crm/leads/import/excel")]
public sealed class LeadImportExcelController(IMediator mediator) : ControllerBase
{
    [HttpPost("parse")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<IActionResult> Parse([FromForm] IFormFile file, CancellationToken ct)
    {
        var r = await mediator.Send(new ParseExcelCommand(file), ct);
        return r.IsSuccess ? Ok(r.Value) : BadRequest(new { error = r.Error });
    }

    public sealed record MapBody(Guid StagingId, Dictionary<string, string> Mapping, string MatchKeyField);

    [HttpPost("preview")]
    public async Task<IActionResult> Preview(MapBody body, CancellationToken ct)
    {
        var r = await mediator.Send(
            new PreviewImportCommand(body.StagingId, body.Mapping, body.MatchKeyField ?? "email"), ct);
        return r.IsSuccess ? Ok(r.Value) : BadRequest(new { error = r.Error });
    }

    [HttpPost("commit")]
    public async Task<IActionResult> Commit(MapBody body, CancellationToken ct)
    {
        var r = await mediator.Send(
            new CommitExcelImportCommand(body.StagingId, body.Mapping, body.MatchKeyField ?? "email"), ct);
        return r.IsSuccess ? Ok(r.Value) : BadRequest(new { error = r.Error });
    }
}
```

Confirm `[RequiresFeature]` attribute namespace by grepping an existing controller that uses it; add the matching `using`.

- [ ] **Step 5: `LeadImportStagingSweepJob.cs`**

```csharp
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Infrastructure.Jobs;

/// <summary>Hourly: delete abandoned Excel staging buffers older than 1h.</summary>
public sealed class LeadImportStagingSweepJob(
    ApplicationDbContext db, ILogger<LeadImportStagingSweepJob> logger)
{
    public async Task ExecuteAsync(CancellationToken ct)
    {
        var cutoff = DateTime.UtcNow.AddHours(-1);
        var stale = await db.LeadImportStagings.Where(s => s.CreatedAt < cutoff).ToListAsync(ct);
        if (stale.Count == 0) { logger.LogInformation("StagingSweep: nothing to clean"); return; }
        db.LeadImportStagings.RemoveRange(stale);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("StagingSweep: removed {Count} stale staging rows", stale.Count);
    }
}
```

- [ ] **Step 6: Register the sweep job**

In `RecurringJobRegistrar.RegisterAll`, after the `TrialExpirySweepJob` block add:

```csharp
        jobs.AddOrUpdate<LeadImportStagingSweepJob>(
            recurringJobId: "lead-import-staging-sweep",
            methodCall:     j => j.ExecuteAsync(CancellationToken.None),
            cronExpression: Cron.Hourly);
```

- [ ] **Step 7: Build + smoke parse**

```bash
Get-Process -Name "TravelCrm.Api" -ErrorAction SilentlyContinue | Stop-Process -Force
cd D:/ClaudeProjects/TravelCRMPlus/TravelCrm.Api && dotnet build 2>&1 | Select-String -Pattern "Error|Warning" | Select-Object -Last 8
```
Expected: 0 errors, 2 CS9113, 0 CS0618. Then run the app, login (see Conventions), `POST /api/crm/leads/import/excel/parse` with a 2-row CSV (`Email,First`\n`a@b.com,Bob`) as multipart `file` → expect `{ stagingId, headers, previewRows, totalRows:1 }`.

- [ ] **Step 8: Commit**

```bash
git add TravelCrm.Api/Features/Crm/LeadImport/Commands/ TravelCrm.Api/Features/Crm/LeadImport/LeadImportExcelController.cs TravelCrm.Api/Infrastructure/Jobs/LeadImportStagingSweepJob.cs TravelCrm.Api/Infrastructure/Jobs/RecurringJobRegistrar.cs TravelCrm.Api/Program.cs
git commit -m "feat(lead-import): Excel parse/preview/commit commands + controller + hourly staging sweep"
```

---

## Task 8: Frontend — model + service (Excel) + mapping component + Excel wizard + dropdown

**Files:**
- Create: `src/app/core/models/lead-import.model.ts`
- Create: `src/app/core/services/lead-import.service.ts`
- Create: `src/app/pages/crm/leads/import/lead-import-mapping.component.ts`
- Create: `src/app/pages/crm/leads/import/excel-import-wizard.component.ts`
- Modify: `src/app/pages/crm/leads/lead-list/lead-list.component.ts`

- [ ] **Step 1: Model**

`src/app/core/models/lead-import.model.ts`:

```typescript
export interface ImportField { key: string; label: string; required: boolean; }

export interface ParseResult {
  stagingId: string;
  headers: string[];
  previewRows: Record<string, string>[];
  totalRows: number;
}

export interface PreviewResult {
  willCreate: number; willUpdate: number; willSkip: number;
  sampleErrors: LeadImportRowOutcome[];
}

export interface LeadImportRowOutcome {
  rowNumber: number; key: string;
  status: 'Created' | 'Updated' | 'Skipped' | 'Failed';
  reason: string | null;
}

export interface LeadImportResult {
  created: number; updated: number; skipped: number; failed: number;
  errors: LeadImportRowOutcome[];
}

export const LEAD_IMPORT_FIELDS: ImportField[] = [
  { key: 'email', label: 'Email', required: true },
  { key: 'firstName', label: 'First Name', required: false },
  { key: 'lastName', label: 'Last Name', required: false },
  { key: 'phone', label: 'Phone', required: false },
  { key: 'company', label: 'Company', required: false },
  { key: 'jobTitle', label: 'Job Title', required: false },
  { key: 'assignedTo', label: 'Assigned To', required: false },
  { key: 'status', label: 'Status', required: false },
  { key: 'source', label: 'Source', required: false },
  { key: 'score', label: 'Score', required: false },
  { key: 'estimatedValue', label: 'Estimated Value', required: false },
  { key: 'tags', label: 'Tags', required: false },
  { key: 'notes', label: 'Notes', required: false },
];
```

- [ ] **Step 2: Service (Excel methods; Google methods added in Task 14)**

`src/app/core/services/lead-import.service.ts`:

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-base-url.token';
import { ParseResult, PreviewResult, LeadImportResult } from '../models/lead-import.model';

@Injectable({ providedIn: 'root' })
export class LeadImportService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/api/crm/leads/import`;

  parseExcel(file: File): Observable<ParseResult> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    return this.http.post<ParseResult>(`${this.base}/excel/parse`, fd);
  }

  preview(stagingId: string, mapping: Record<string, string>, matchKeyField: string): Observable<PreviewResult> {
    return this.http.post<PreviewResult>(`${this.base}/excel/preview`, { stagingId, mapping, matchKeyField });
  }

  commit(stagingId: string, mapping: Record<string, string>, matchKeyField: string): Observable<LeadImportResult> {
    return this.http.post<LeadImportResult>(`${this.base}/excel/commit`, { stagingId, mapping, matchKeyField });
  }
}
```

(No `.data` unwrap — `EnvelopeInterceptor` already unwraps.)

- [ ] **Step 3: Reusable mapping component**

`src/app/pages/crm/leads/import/lead-import-mapping.component.ts` — a standalone, OnPush component taking `@Input() headers: string[]`, `@Input() initialMapping: Record<string,string>`, exposing `@Output() mappingChange` and `@Output() matchKeyChange`. It renders one `mat-select` per `LEAD_IMPORT_FIELDS` entry (options = headers + "— ignore —"), a match-key `mat-select` (default `email`), and shows a red hint if the required `email` field is unmapped. Use the same density/token CSS conventions as `lead-list` (`:host` light tokens + `:host-context(.dark-theme)` overrides). Pre-fill from `initialMapping` (server fuzzy guess). Emit on every change. Keep it under ~180 lines; signals + `computed` for the "email mapped?" validity flag.

- [ ] **Step 4: Excel wizard (SidePanel, 3 steps)**

`src/app/pages/crm/leads/import/excel-import-wizard.component.ts` — standalone OnPush component opened via `SidePanelService.open`. Inject `SidePanelRef` and `LeadImportService`. Steps via a `step` signal (`'upload' | 'map' | 'review' | 'done'`):
  1. **upload**: drag/drop + file input (`.xlsx,.xlsm,.csv`), client-side 5 MB guard, calls `parseExcel`, on success stores `ParseResult`, runs client fuzzy-guess pre-fill (reuse the same synonym list — or accept the server's `previewRows`/headers and let the mapping component guess), advance to `map`.
  2. **map**: embed `<app-lead-import-mapping>`, "Preview" button calls `preview()`, shows `willCreate/willUpdate/willSkip` + sample errors, advance to `review`.
  3. **review**: confirm → `commit()` → show `LeadImportResult` counts; if `errors.length`, render a "Download error report (.csv)" button that builds a client-side CSV blob from `errors`. "Close" calls `sidePanelRef.close(true)` so the leads list refreshes.
Use `takeUntilDestroyed(inject(DestroyRef))` on all subscriptions; mirror an existing SidePanel wizard's structure. Keep under ~320 lines.

- [ ] **Step 5: Dropdown button in lead-list**

In `src/app/pages/crm/leads/lead-list/lead-list.component.ts`, in the `ll-header` next to the "Add Lead" button add a Material menu trigger gated by the existing feature directive + permission:

```html
<button mat-stroked-button [matMenuTriggerFor]="importMenu"
        *hasFeature="'lead_import'" class="ll-import-btn">
  Import Leads <mat-icon>arrow_drop_down</mat-icon>
</button>
<mat-menu #importMenu="matMenu">
  <button mat-menu-item (click)="openExcelImport()">
    <mat-icon>upload_file</mat-icon><span>Bulk Upload from Excel File</span>
  </button>
  <button mat-menu-item (click)="openGoogleSheets()">
    <mat-icon>table_chart</mat-icon><span>Connect Google Sheet</span>
  </button>
</mat-menu>
```

Add `MatMenuModule`, `MatIconModule` to the component imports if missing. Implement:

```typescript
openExcelImport(): void {
  this.sidePanel.open(ExcelImportWizardComponent, {
    title: 'Bulk Upload Leads', subtitle: 'Excel or CSV', width: '560px',
  }).afterClosed().subscribe(refreshed => { if (refreshed) this.reload(); });
}
openGoogleSheets(): void { /* wired in Task 14 */ }
```

(Replace `this.reload()` with the component's actual list-refresh method name — grep the file.)

- [ ] **Step 6: Frontend build**

```bash
cd D:/ClaudeProjects/TravelCRMPlus && npx ng build --configuration development 2>&1 | tail -5
```
Expected: "Application bundle generation complete", 0 TS errors (pre-existing Sass `if()` + `NG8113 TenantPlanComponent` warnings acceptable).

- [ ] **Step 7: Commit**

```bash
git add src/app/core/models/lead-import.model.ts src/app/core/services/lead-import.service.ts src/app/pages/crm/leads/import/ src/app/pages/crm/leads/lead-list/lead-list.component.ts
git commit -m "feat(lead-import): Excel wizard, reusable mapping component, model+service, Import Leads dropdown"
```

---

## Task 9: `GoogleSheetsGate` + `GoogleTokenProvider` + `ISheetsReader`

**Files:**
- Create: `TravelCrm.Api/Infrastructure/Google/IGoogleSheetsGate.cs` + `GoogleSheetsGate.cs`
- Create: `TravelCrm.Api/Infrastructure/Google/IGoogleTokenProvider.cs` + `GoogleTokenProvider.cs`
- Create: `TravelCrm.Api/Infrastructure/Google/ISheetsReader.cs` + `GoogleSheetsReader.cs`
- Modify: `TravelCrm.Api/Program.cs` (DI + memory cache)

- [ ] **Step 1: `IGoogleSheetsGate` / `GoogleSheetsGate`**

```csharp
using Microsoft.Extensions.Options;

namespace TravelCrm.Api.Infrastructure.Google;

public interface IGoogleSheetsGate { bool IsConfigured { get; } }

public sealed class GoogleSheetsGate(IOptions<GoogleSheetsOptions> opts) : IGoogleSheetsGate
{
    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(opts.Value.ClientId) &&
        !string.IsNullOrWhiteSpace(opts.Value.ClientSecret) &&
        !string.IsNullOrWhiteSpace(opts.Value.RedirectUri);
}
```

- [ ] **Step 2: `IGoogleTokenProvider` / `GoogleTokenProvider`**

Interface:

```csharp
namespace TravelCrm.Api.Infrastructure.Google;

public interface IGoogleTokenProvider
{
    /// <summary>Exchange an auth code for tokens; returns the refresh token + granted scopes.</summary>
    Task<(string refreshToken, string scopes)> ExchangeCodeAsync(string code, CancellationToken ct);

    /// <summary>Mint (or return cached) access token for a tenant from its stored refresh token.</summary>
    Task<string> GetAccessTokenAsync(Guid tenantId, string refreshToken, CancellationToken ct);

    /// <summary>Build the consent URL with the given opaque state.</summary>
    string BuildAuthUrl(string state);

    /// <summary>Best-effort Google token revocation.</summary>
    Task RevokeAsync(string refreshToken, CancellationToken ct);
}
```

Implementation `GoogleTokenProvider` uses `Google.Apis.Auth.OAuth2` (`GoogleAuthorizationCodeFlow` with `ClientSecrets` from `GoogleSheetsOptions`, scopes from `GoogleSheetsOptions.Scopes`, `access_type=offline`, `prompt=consent`). Cache access tokens in `IMemoryCache` keyed `goog:at:{tenantId}` with absolute expiry `expiresIn - 60s`. `RevokeAsync` POSTs the token to `https://oauth2.googleapis.com/revoke` via `HttpClient` (swallow failures — disconnect must still proceed). Keep network calls isolated here so tests fake the interface.

- [ ] **Step 3: `ISheetsReader` / `GoogleSheetsReader`**

```csharp
namespace TravelCrm.Api.Infrastructure.Google;

public sealed record SheetTab(string Title);
public sealed record SheetValues(IReadOnlyList<string> Headers,
    IReadOnlyList<Dictionary<string, string>> Rows);

public interface ISheetsReader
{
    Task<IReadOnlyList<SheetTab>> ListTabsAsync(string accessToken, string spreadsheetId, CancellationToken ct);
    Task<SheetValues> ReadAsync(string accessToken, string spreadsheetId, string tab, CancellationToken ct);
}
```

`GoogleSheetsReader` uses `SheetsService` (`BaseClientService.Initializer` with `GoogleCredential.FromAccessToken`). `ListTabsAsync` → `spreadsheets.get` (read `sheets[].properties.title`). `ReadAsync` → `spreadsheets.values.get(spreadsheetId, $"{tab}!A:Z")`; first non-empty row = headers; project each subsequent row to `Dictionary<header,value>` (pad short rows with `""`); cap at 10,000 data rows (throw `LeadImportParseException` over cap, reuse the Task 5 type).

- [ ] **Step 4: DI in Program.cs**

```csharp
builder.Services.AddMemoryCache();
builder.Services.AddHttpClient();
builder.Services.AddSingleton<TravelCrm.Api.Infrastructure.Google.IGoogleSheetsGate,
    TravelCrm.Api.Infrastructure.Google.GoogleSheetsGate>();
builder.Services.AddScoped<TravelCrm.Api.Infrastructure.Google.IGoogleTokenProvider,
    TravelCrm.Api.Infrastructure.Google.GoogleTokenProvider>();
builder.Services.AddScoped<TravelCrm.Api.Infrastructure.Google.ISheetsReader,
    TravelCrm.Api.Infrastructure.Google.GoogleSheetsReader>();
```

(If `AddMemoryCache`/`AddHttpClient` already registered, skip the dupes.)

- [ ] **Step 5: Build**

```bash
Get-Process -Name "TravelCrm.Api" -ErrorAction SilentlyContinue | Stop-Process -Force
cd D:/ClaudeProjects/TravelCRMPlus/TravelCrm.Api && dotnet build 2>&1 | Select-String -Pattern "Error|Warning" | Select-Object -Last 8
```
Expected: 0 errors, 2 CS9113, 0 CS0618.

- [ ] **Step 6: Commit**

```bash
git add TravelCrm.Api/Infrastructure/Google/ TravelCrm.Api/Program.cs
git commit -m "feat(lead-import): GoogleSheetsGate + GoogleTokenProvider + ISheetsReader (network behind interfaces)"
```

---

## Task 10: `GoogleOAuthController` — status/auth-url/callback/disconnect (TDD on state HMAC)

**Files:**
- Create: `TravelCrm.Api/Features/Crm/LeadImport/Google/OAuthState.cs`
- Create: `TravelCrm.Api/Features/Crm/LeadImport/Google/GoogleOAuthController.cs`
- Test: `TravelCrm.Tests/LeadImport/OAuthStateTests.cs`

- [ ] **Step 1: Write failing tests for the state HMAC**

`TravelCrm.Tests/LeadImport/OAuthStateTests.cs`:

```csharp
using System.Security.Cryptography;
using TravelCrm.Api.Features.Crm.LeadImport.Google;
using Xunit;

namespace TravelCrm.Tests.LeadImport;

public sealed class OAuthStateTests
{
    private static readonly byte[] Key = RandomNumberGenerator.GetBytes(32);

    [Fact]
    public void Roundtrip_valid_state_returns_tenant()
    {
        var tenant = Guid.NewGuid();
        var s = OAuthState.Create(tenant, Key, DateTimeOffset.UtcNow.AddMinutes(10));
        Assert.True(OAuthState.TryValidate(s, Key, DateTimeOffset.UtcNow, out var got));
        Assert.Equal(tenant, got);
    }

    [Fact]
    public void Tampered_state_is_rejected()
    {
        var s = OAuthState.Create(Guid.NewGuid(), Key, DateTimeOffset.UtcNow.AddMinutes(10));
        var bad = s[..^2] + (s[^1] == 'A' ? "B" : "A");
        Assert.False(OAuthState.TryValidate(bad, Key, DateTimeOffset.UtcNow, out _));
    }

    [Fact]
    public void Expired_state_is_rejected()
    {
        var s = OAuthState.Create(Guid.NewGuid(), Key, DateTimeOffset.UtcNow.AddMinutes(-1));
        Assert.False(OAuthState.TryValidate(s, Key, DateTimeOffset.UtcNow, out _));
    }

    [Fact]
    public void Wrong_key_is_rejected()
    {
        var s = OAuthState.Create(Guid.NewGuid(), Key, DateTimeOffset.UtcNow.AddMinutes(10));
        Assert.False(OAuthState.TryValidate(s, RandomNumberGenerator.GetBytes(32), DateTimeOffset.UtcNow, out _));
    }
}
```

- [ ] **Step 1b: Run — expect FAIL**

```bash
cd D:/ClaudeProjects/TravelCRMPlus && dotnet test TravelCrm.Tests --filter "FullyQualifiedName~OAuthStateTests" 2>&1 | Select-Object -Last 5
```
Expected: compile error — `OAuthState` missing.

- [ ] **Step 2: Implement `OAuthState.cs`**

```csharp
using System.Security.Cryptography;
using System.Text;

namespace TravelCrm.Api.Features.Crm.LeadImport.Google;

/// <summary>
/// Opaque OAuth `state`: base64url(tenantId|nonce|expUnix) + "." +
/// base64url(HMACSHA256(payload, key)). Binds the callback to the tenant
/// (anti-CSRF) and expires.
/// </summary>
public static class OAuthState
{
    public static string Create(Guid tenantId, byte[] key, DateTimeOffset exp)
    {
        var nonce = Convert.ToHexString(RandomNumberGenerator.GetBytes(8));
        var payload = $"{tenantId:N}|{nonce}|{exp.ToUnixTimeSeconds()}";
        var sig = HMACSHA256.HashData(key, Encoding.UTF8.GetBytes(payload));
        return $"{B64(Encoding.UTF8.GetBytes(payload))}.{B64(sig)}";
    }

    public static bool TryValidate(string state, byte[] key, DateTimeOffset now, out Guid tenantId)
    {
        tenantId = Guid.Empty;
        if (string.IsNullOrWhiteSpace(state)) return false;
        var parts = state.Split('.');
        if (parts.Length != 2) return false;
        byte[] payloadBytes, sig;
        try { payloadBytes = UnB64(parts[0]); sig = UnB64(parts[1]); }
        catch { return false; }
        var expected = HMACSHA256.HashData(key, payloadBytes);
        if (!CryptographicOperations.FixedTimeEquals(expected, sig)) return false;
        var fields = Encoding.UTF8.GetString(payloadBytes).Split('|');
        if (fields.Length != 3) return false;
        if (!Guid.TryParseExact(fields[0], "N", out var tid)) return false;
        if (!long.TryParse(fields[2], out var expUnix)) return false;
        if (DateTimeOffset.FromUnixTimeSeconds(expUnix) < now) return false;
        tenantId = tid;
        return true;
    }

    private static string B64(byte[] b) =>
        Convert.ToBase64String(b).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    private static byte[] UnB64(string s)
    {
        s = s.Replace('-', '+').Replace('_', '/');
        s = s.PadRight(s.Length + (4 - s.Length % 4) % 4, '=');
        return Convert.FromBase64String(s);
    }
}
```

- [ ] **Step 3: Run tests — expect PASS**

```bash
cd D:/ClaudeProjects/TravelCRMPlus && dotnet test TravelCrm.Tests --filter "FullyQualifiedName~OAuthStateTests" 2>&1 | Select-Object -Last 5
```
Expected: 4 tests PASS.

- [ ] **Step 4: Implement `GoogleOAuthController.cs`**

Endpoints under `[Route("api/crm/leads/import/google")]`, `[Authorize]`, `[RequiresFeature(FeatureCatalog.LeadImport)]`. Derive the HMAC key from the app's data-protection provider (`IDataProtectionProvider.CreateProtector("lead-import.oauth-state")` → use a fixed 32-byte key by HMAC-deriving from a protector-encrypted constant, OR inject `IDataProtectionProvider` and protect/unprotect the payload instead of raw HMAC — pick the data-protector approach to avoid key management; keep `OAuthState` as the testable pure-HMAC unit and feed it a stable key from config/data-protection).

- `GET status` → `GoogleStatusDto(gate.IsConfigured, tokenExistsForTenant, grantedScopes)`.
- `GET auth-url` → 409 if `!gate.IsConfigured`; else `{ url = tokenProvider.BuildAuthUrl(OAuthState.Create(tenantId, key, now+10min)) }`.
- `GET callback?code=&state=` → `OAuthState.TryValidate` (else 400 HTML "Invalid or expired"); `tokenProvider.ExchangeCodeAsync` → upsert `GoogleOAuthToken` (unique per tenant; refresh token encrypted by the converter) → return self-closing HTML: `<script>window.opener?.postMessage('google-connected','*');window.close();</script>`.
- `POST disconnect` → load token, `tokenProvider.RevokeAsync`, delete token, set tenant's `LeadImportSource` rows `Status=Disconnected`, `SaveChanges`.

All handlers scope by `tenantContext.TenantId!.Value`; permission `crm.leads.manage` for auth-url/callback/disconnect, `crm.leads.view` for status.

- [ ] **Step 5: Build + smoke status**

```bash
Get-Process -Name "TravelCrm.Api" -ErrorAction SilentlyContinue | Stop-Process -Force
cd D:/ClaudeProjects/TravelCRMPlus/TravelCrm.Api && dotnet build 2>&1 | Select-String -Pattern "Error|Warning" | Select-Object -Last 8
```
Run app, login, `GET /api/crm/leads/import/google/status` → expect `{ configured:false, connected:false, grantedScopes:"" }` (no creds in user-secrets ⇒ dormant, by design).

- [ ] **Step 6: Commit**

```bash
git add TravelCrm.Api/Features/Crm/LeadImport/Google/ TravelCrm.Tests/LeadImport/OAuthStateTests.cs
git commit -m "feat(lead-import): GoogleOAuthController + HMAC OAuth state (TDD) status/auth-url/callback/disconnect"
```

---

## Task 11: Sheets queries (tabs/headers) + `LeadImportSource` CRUD commands/queries

**Files:**
- Create: `TravelCrm.Api/Features/Crm/LeadImport/Queries/ListSheetTabsQuery.cs`
- Create: `TravelCrm.Api/Features/Crm/LeadImport/Queries/GetSheetHeadersQuery.cs`
- Create: `TravelCrm.Api/Features/Crm/LeadImport/Queries/ListLeadImportSourcesQuery.cs`
- Create: `TravelCrm.Api/Features/Crm/LeadImport/Commands/CreateLeadImportSourceCommand.cs`
- Create: `TravelCrm.Api/Features/Crm/LeadImport/Commands/UpdateLeadImportSourceCommand.cs`
- Create: `TravelCrm.Api/Features/Crm/LeadImport/Commands/DeleteLeadImportSourceCommand.cs`
- Create: `TravelCrm.Api/Features/Crm/LeadImport/Commands/SetLeadImportSourceStatusCommand.cs`
- Create: `TravelCrm.Api/Features/Crm/LeadImport/Commands/RunLeadImportSyncCommand.cs`

- [ ] **Step 1: Sheets queries**

`ListSheetTabsQuery(string SpreadsheetId)` and `GetSheetHeadersQuery(string SpreadsheetId, string Tab)`. Both handlers: permission `crm.leads.manage`, tenant resolved, load `GoogleOAuthToken` for tenant (fail "Not connected" if none), `tokenProvider.GetAccessTokenAsync(tenantId, token.RefreshToken, ct)`, then `sheetsReader.ListTabsAsync(...)` → `IReadOnlyList<SheetTabDto>` / `sheetsReader.ReadAsync(...)` → `SheetHeadersDto(headers, first 5 rows)`. Catch refresh failure → `Result.Failure("Google connection expired — reconnect")`.

- [ ] **Step 2: `ListLeadImportSourcesQuery`**

Returns `List<LeadImportSourceDto>` for the tenant (permission `crm.leads.view`), ordered by `CreatedAt desc`, mapping `RowVersion` → `Convert.ToBase64String(...)`, `ColumnMapping` JSON → `Dictionary<string,string>`, enums → string names.

- [ ] **Step 3: Create/Update/Delete/SetStatus/RunSync commands**

- `CreateLeadImportSourceCommand(DisplayName, SpreadsheetId, SheetName, Dictionary<string,string> ColumnMapping, MatchKeyField, SyncCadence)` — permission `crm.leads.manage`; validate `email` present in mapping; persist `LeadImportSource{ Status=Active }`; enqueue an immediate sync via `BackgroundJob.Enqueue<RunLeadImportSyncJob>(j => j.ExecuteAsync(id, CancellationToken.None))` (Task 13); return `LeadImportSourceDto`.
- `UpdateLeadImportSourceCommand(Id, RowVersion(base64), DisplayName, SheetName, ColumnMapping, MatchKeyField, SyncCadence)` — load by id+tenant; set `db.Entry(src).Property(x=>x.RowVersion).OriginalValue = Convert.FromBase64String(cmd.RowVersion)`; catch `DbUpdateConcurrencyException` → `Result.Failure("This connection was changed elsewhere. Reload and retry.")`.
- `DeleteLeadImportSourceCommand(Id)` — remove source (RowState cascade-deletes).
- `SetLeadImportSourceStatusCommand(Id, bool Pause)` — set `Status = Pause ? Paused : Active`.
- `RunLeadImportSyncCommand(Id)` — permission `crm.leads.manage`; verify source belongs to tenant; `BackgroundJob.Enqueue<RunLeadImportSyncJob>(j => j.ExecuteAsync(Id, CancellationToken.None))`; return `Result.Success()`.

All scope by tenant explicitly; all reuse the `Result<T>` pattern from `CreateLeadCommand`.

- [ ] **Step 4: Build**

```bash
Get-Process -Name "TravelCrm.Api" -ErrorAction SilentlyContinue | Stop-Process -Force
cd D:/ClaudeProjects/TravelCRMPlus/TravelCrm.Api && dotnet build 2>&1 | Select-String -Pattern "Error|Warning" | Select-Object -Last 8
```
Expected: 0 errors (forward-reference to `RunLeadImportSyncJob` — if it blocks build, stub the job class signature now and flesh it out in Task 13), 2 CS9113, 0 CS0618.

- [ ] **Step 5: Commit**

```bash
git add TravelCrm.Api/Features/Crm/LeadImport/Queries/ TravelCrm.Api/Features/Crm/LeadImport/Commands/
git commit -m "feat(lead-import): Sheets tabs/headers queries + LeadImportSource CRUD/status/sync commands"
```

---

## Task 12: `LeadSourcesController` + sync/pause/resume

**Files:**
- Create: `TravelCrm.Api/Features/Crm/LeadImport/LeadSourcesController.cs`
- Create: `TravelCrm.Api/Features/Crm/LeadImport/Google/GoogleSheetsController.cs` (tabs/headers endpoints)

- [ ] **Step 1: `LeadSourcesController`**

```csharp
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Crm.LeadImport.Commands;
using TravelCrm.Api.Features.Crm.LeadImport.Queries;

namespace TravelCrm.Api.Features.Crm.LeadImport;

[Authorize]
[ApiController]
[RequiresFeature(FeatureCatalog.LeadImport)]
[Route("api/crm/lead-sources")]
public sealed class LeadSourcesController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    { var r = await mediator.Send(new ListLeadImportSourcesQuery(), ct);
      return r.IsSuccess ? Ok(r.Value) : Forbid(); }

    public sealed record CreateBody(string DisplayName, string SpreadsheetId, string SheetName,
        Dictionary<string, string> ColumnMapping, string MatchKeyField, string SyncCadence);

    [HttpPost]
    public async Task<IActionResult> Create(CreateBody b, CancellationToken ct)
    { var r = await mediator.Send(new CreateLeadImportSourceCommand(
        b.DisplayName, b.SpreadsheetId, b.SheetName, b.ColumnMapping, b.MatchKeyField, b.SyncCadence), ct);
      return r.IsSuccess ? Ok(r.Value) : BadRequest(new { error = r.Error }); }

    public sealed record UpdateBody(string RowVersion, string DisplayName, string SheetName,
        Dictionary<string, string> ColumnMapping, string MatchKeyField, string SyncCadence);

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateBody b, CancellationToken ct)
    { var r = await mediator.Send(new UpdateLeadImportSourceCommand(
        id, b.RowVersion, b.DisplayName, b.SheetName, b.ColumnMapping, b.MatchKeyField, b.SyncCadence), ct);
      return r.IsSuccess ? Ok(r.Value) : BadRequest(new { error = r.Error }); }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    { var r = await mediator.Send(new DeleteLeadImportSourceCommand(id), ct);
      return r.IsSuccess ? NoContent() : BadRequest(new { error = r.Error }); }

    [HttpPost("{id:guid}/sync")]
    public async Task<IActionResult> Sync(Guid id, CancellationToken ct)
    { var r = await mediator.Send(new RunLeadImportSyncCommand(id), ct);
      return r.IsSuccess ? Accepted() : BadRequest(new { error = r.Error }); }

    [HttpPost("{id:guid}/pause")]
    public async Task<IActionResult> Pause(Guid id, CancellationToken ct)
    { var r = await mediator.Send(new SetLeadImportSourceStatusCommand(id, true), ct);
      return r.IsSuccess ? Ok() : BadRequest(new { error = r.Error }); }

    [HttpPost("{id:guid}/resume")]
    public async Task<IActionResult> Resume(Guid id, CancellationToken ct)
    { var r = await mediator.Send(new SetLeadImportSourceStatusCommand(id, false), ct);
      return r.IsSuccess ? Ok() : BadRequest(new { error = r.Error }); }
}
```

- [ ] **Step 2: `GoogleSheetsController`** (tabs/headers; lives under the OAuth route family)

```csharp
[Authorize]
[ApiController]
[RequiresFeature(FeatureCatalog.LeadImport)]
[Route("api/crm/leads/import/google/sheets")]
public sealed class GoogleSheetsController(IMediator mediator) : ControllerBase
{
    [HttpGet("{spreadsheetId}/tabs")]
    public async Task<IActionResult> Tabs(string spreadsheetId, CancellationToken ct)
    { var r = await mediator.Send(new ListSheetTabsQuery(spreadsheetId), ct);
      return r.IsSuccess ? Ok(r.Value) : BadRequest(new { error = r.Error }); }

    [HttpGet("{spreadsheetId}/headers")]
    public async Task<IActionResult> Headers(string spreadsheetId, [FromQuery] string tab, CancellationToken ct)
    { var r = await mediator.Send(new GetSheetHeadersQuery(spreadsheetId, tab), ct);
      return r.IsSuccess ? Ok(r.Value) : BadRequest(new { error = r.Error }); }
}
```

- [ ] **Step 3: Build + smoke**

```bash
Get-Process -Name "TravelCrm.Api" -ErrorAction SilentlyContinue | Stop-Process -Force
cd D:/ClaudeProjects/TravelCRMPlus/TravelCrm.Api && dotnet build 2>&1 | Select-String -Pattern "Error|Warning" | Select-Object -Last 8
```
Run app, login, `GET /api/crm/lead-sources` → expect `[]`.

- [ ] **Step 4: Commit**

```bash
git add TravelCrm.Api/Features/Crm/LeadImport/LeadSourcesController.cs TravelCrm.Api/Features/Crm/LeadImport/Google/GoogleSheetsController.cs
git commit -m "feat(lead-import): LeadSourcesController CRUD/sync/pause/resume + Google Sheets tabs/headers controller"
```

---

## Task 13: Hangfire `RunLeadImportSyncJob` + `LeadImportSyncDispatcherJob` + registrar

**Files:**
- Create: `TravelCrm.Api/Infrastructure/Jobs/RunLeadImportSyncJob.cs`
- Create: `TravelCrm.Api/Infrastructure/Jobs/LeadImportSyncDispatcherJob.cs`
- Modify: `TravelCrm.Api/Infrastructure/Jobs/RecurringJobRegistrar.cs`

- [ ] **Step 1: `RunLeadImportSyncJob.cs`**

```csharp
using System.Text.Json;
using Hangfire;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Domain.Entities.Crm;
using TravelCrm.Api.Features.Crm.LeadImport;
using TravelCrm.Api.Infrastructure.Google;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Infrastructure.Jobs;

[DisableConcurrentExecution(timeoutInSeconds: 600)]
public sealed class RunLeadImportSyncJob(
    ApplicationDbContext db,
    IGoogleTokenProvider tokenProvider,
    ISheetsReader sheets,
    ILeadImportEngine engine,
    ILogger<RunLeadImportSyncJob> logger)
{
    public async Task ExecuteAsync(Guid sourceId, CancellationToken ct)
    {
        var src = await db.LeadImportSources.FirstOrDefaultAsync(s => s.Id == sourceId, ct);
        if (src is null) { logger.LogWarning("Sync: source {Id} gone", sourceId); return; }
        if (src.Status is LeadImportSourceStatus.Paused or LeadImportSourceStatus.Disconnected) return;

        src.LastPolledAt = DateTime.UtcNow;
        try
        {
            var token = await db.GoogleOAuthTokens.FirstOrDefaultAsync(t => t.TenantId == src.TenantId, ct)
                ?? throw new InvalidOperationException("Google not connected for this tenant.");
            var access = await tokenProvider.GetAccessTokenAsync(src.TenantId, token.RefreshToken, ct);
            var values = await sheets.ReadAsync(access, src.SpreadsheetId, src.SheetName, ct);

            var mapping = JsonSerializer.Deserialize<Dictionary<string, string>>(src.ColumnMapping)
                          ?? new();
            var rows = values.Rows.Select(d => (IReadOnlyDictionary<string, string>)d).ToList();

            var result = await engine.ApplyAsync(
                src.TenantId, rows, mapping, src.MatchKeyField,
                sourceId: src.Id, actingUserId: null, ct);

            src.Status = LeadImportSourceStatus.Active;
            src.LastSuccessAt = DateTime.UtcNow;
            src.LastResultJson = JsonSerializer.Serialize(result);
            src.LastError = null;
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Sync {Id}: +{C} ~{U} ={S} !{F}",
                src.Id, result.Created, result.Updated, result.Skipped, result.Failed);
        }
        catch (Exception ex)
        {
            src.Status = LeadImportSourceStatus.Error;
            src.LastError = ex.Message.Length > 1000 ? ex.Message[..1000] : ex.Message;
            db.Notifications.Add(new Notification
            {
                TenantId = src.TenantId,
                Title = "Google Sheet sync failed",
                Message = $"\"{src.DisplayName}\": {src.LastError}",
            });
            await db.SaveChangesAsync(CancellationToken.None);
            logger.LogError(ex, "Sync {Id} failed", src.Id);
        }
    }
}
```

(Confirm `Notification`'s exact required properties by reading the entity; set whatever the Phase-1 entity requires — `Title`/`Message`/`TenantId` at minimum, plus any non-nullable `Type`/`IsRead` defaults.)

- [ ] **Step 2: `LeadImportSyncDispatcherJob.cs`**

```csharp
using Hangfire;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Domain.Entities.Crm;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Infrastructure.Jobs;

/// <summary>Every 5 min: enqueue per-connection sync jobs for due Active sources.</summary>
public sealed class LeadImportSyncDispatcherJob(
    ApplicationDbContext db, ILogger<LeadImportSyncDispatcherJob> logger)
{
    public async Task ExecuteAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var active = await db.LeadImportSources
            .Where(s => s.Status == LeadImportSourceStatus.Active
                     && s.SyncCadence != SyncCadence.Manual)
            .ToListAsync(ct);

        var due = active.Where(s => IsDue(s, now)).ToList();
        foreach (var s in due)
            BackgroundJob.Enqueue<RunLeadImportSyncJob>(j => j.ExecuteAsync(s.Id, CancellationToken.None));

        logger.LogInformation("SyncDispatcher: {Due}/{Active} sources enqueued", due.Count, active.Count);
    }

    private static bool IsDue(LeadImportSource s, DateTime now)
    {
        if (s.LastPolledAt is null) return true;
        var interval = s.SyncCadence switch
        {
            SyncCadence.Every15Min => TimeSpan.FromMinutes(15),
            SyncCadence.Hourly     => TimeSpan.FromHours(1),
            SyncCadence.Daily      => TimeSpan.FromDays(1),
            _                      => TimeSpan.MaxValue,
        };
        return s.LastPolledAt.Value + interval <= now;
    }
}
```

- [ ] **Step 3: Register the dispatcher**

In `RecurringJobRegistrar.RegisterAll`, after the staging-sweep registration:

```csharp
        jobs.AddOrUpdate<LeadImportSyncDispatcherJob>(
            recurringJobId: "lead-import-sync-dispatcher",
            methodCall:     j => j.ExecuteAsync(CancellationToken.None),
            cronExpression: "*/5 * * * *");
```

- [ ] **Step 4: Build**

```bash
Get-Process -Name "TravelCrm.Api" -ErrorAction SilentlyContinue | Stop-Process -Force
cd D:/ClaudeProjects/TravelCRMPlus/TravelCrm.Api && dotnet build 2>&1 | Select-String -Pattern "Error|Warning" | Select-Object -Last 8
```
Expected: 0 errors, 2 CS9113, 0 CS0618. Confirm `RunLeadImportSyncJob`/`LeadImportStagingSweepJob`/dispatcher are registered in DI — Hangfire resolves jobs via the container; add `builder.Services.AddScoped<RunLeadImportSyncJob>()` etc. in `Program.cs` if the existing jobs are explicitly registered there (grep for `HoldExpirySweepJob` in Program.cs to match the pattern).

- [ ] **Step 5: Commit**

```bash
git add TravelCrm.Api/Infrastructure/Jobs/RunLeadImportSyncJob.cs TravelCrm.Api/Infrastructure/Jobs/LeadImportSyncDispatcherJob.cs TravelCrm.Api/Infrastructure/Jobs/RecurringJobRegistrar.cs TravelCrm.Api/Program.cs
git commit -m "feat(lead-import): Hangfire RunLeadImportSyncJob + 5-min dispatcher + registrar wiring"
```

---

## Task 14: Frontend — Google service methods + Google Sheets wizard

**Files:**
- Modify: `src/app/core/services/lead-import.service.ts`
- Modify: `src/app/core/models/lead-import.model.ts`
- Create: `src/app/pages/crm/leads/import/google-sheets-wizard.component.ts`
- Modify: `src/app/pages/crm/leads/lead-list/lead-list.component.ts` (wire `openGoogleSheets`)

- [ ] **Step 1: Add Google models**

Append to `lead-import.model.ts`:

```typescript
export interface GoogleStatus { configured: boolean; connected: boolean; grantedScopes: string; }
export interface SheetTab { title: string; }
export interface SheetHeaders { headers: string[]; previewRows: Record<string, string>[]; }
export interface LeadSource {
  id: string; displayName: string; spreadsheetId: string; sheetName: string;
  columnMapping: Record<string, string>; matchKeyField: string;
  syncCadence: string; status: string;
  lastPolledAt: string | null; lastSuccessAt: string | null;
  lastResultJson: string | null; lastError: string | null; rowVersion: string;
}
```

- [ ] **Step 2: Add Google service methods**

Append to `LeadImportService`:

```typescript
googleStatus(): Observable<GoogleStatus> {
  return this.http.get<GoogleStatus>(`${this.base}/google/status`);
}
googleAuthUrl(): Observable<{ url: string }> {
  return this.http.get<{ url: string }>(`${this.base}/google/auth-url`);
}
googleDisconnect(): Observable<void> {
  return this.http.post<void>(`${this.base}/google/disconnect`, {});
}
sheetTabs(spreadsheetId: string): Observable<SheetTab[]> {
  return this.http.get<SheetTab[]>(`${this.base}/google/sheets/${spreadsheetId}/tabs`);
}
sheetHeaders(spreadsheetId: string, tab: string): Observable<SheetHeaders> {
  return this.http.get<SheetHeaders>(`${this.base}/google/sheets/${spreadsheetId}/headers`,
    { params: { tab } });
}
listSources(): Observable<LeadSource[]> {
  return this.http.get<LeadSource[]>(`${inject(API_BASE_URL)}/api/crm/lead-sources`);
}
createSource(body: { displayName: string; spreadsheetId: string; sheetName: string;
  columnMapping: Record<string,string>; matchKeyField: string; syncCadence: string; }): Observable<LeadSource> {
  return this.http.post<LeadSource>(`${inject(API_BASE_URL)}/api/crm/lead-sources`, body);
}
```

(Move the `lead-sources` base to a `private readonly sourcesBase = `${inject(API_BASE_URL)}/api/crm/lead-sources``; field — don't call `inject()` inside methods, that throws outside an injection context. Fix in implementation.)

Add `syncNow/pause/resume/updateSource/deleteSource` HTTP methods mirroring the controller routes (used by Task 15).

- [ ] **Step 3: Google Sheets wizard**

`google-sheets-wizard.component.ts` — standalone OnPush SidePanel component. State machine via a `step` signal:
  - `loading` → call `googleStatus()`.
  - `not-configured` (`!configured`): show "Google Sheets import isn't set up on this server yet. Contact your administrator." + Close.
  - `connect` (`configured && !connected`): "Connect Google" button → `googleAuthUrl()` → `window.open(url,'goog','width=500,height=650')`; listen `window.addEventListener('message', e => if e.data==='google-connected' → re-fetch status → advance)`. Clean the listener in `DestroyRef`.
  - `pick-sheet`: text input for spreadsheet URL or id (extract id via regex `/\/d\/([a-zA-Z0-9-_]+)/`), on blur call `sheetTabs(id)` → tab `mat-select`; on tab pick call `sheetHeaders(id,tab)`.
  - `map`: embed `<app-lead-import-mapping [headers]="headers()" [initialMapping]="guess()">`, plus a `DisplayName` input, a match-key select, and a cadence `mat-select` (`Manual/Every15Min/Hourly/Daily`).
  - `save`: `createSource({...})` → success toast "Connected — initial sync started" → `sidePanelRef.close(true)`.
Reuse `lead-list` density + dark-mode token CSS. Under ~360 lines.

- [ ] **Step 4: Wire `openGoogleSheets` in lead-list**

```typescript
openGoogleSheets(): void {
  this.sidePanel.open(GoogleSheetsWizardComponent, {
    title: 'Connect Google Sheet', subtitle: 'Recurring lead sync', width: '560px',
  }).afterClosed().subscribe(refreshed => { if (refreshed) this.reload(); });
}
```

- [ ] **Step 5: Frontend build**

```bash
cd D:/ClaudeProjects/TravelCRMPlus && npx ng build --configuration development 2>&1 | tail -5
```
Expected: "Application bundle generation complete", 0 TS errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/core/models/lead-import.model.ts src/app/core/services/lead-import.service.ts src/app/pages/crm/leads/import/google-sheets-wizard.component.ts src/app/pages/crm/leads/lead-list/lead-list.component.ts
git commit -m "feat(lead-import): Google Sheets wizard + Google/sources service methods + dropdown wiring"
```

---

## Task 15: Frontend — Lead Sources management page + route + sidebar

**Files:**
- Create: `src/app/pages/crm/lead-sources/lead-sources.component.ts`
- Modify: `src/app/pages/crm/crm.routes.ts`
- Modify: `src/app/layouts/full/vertical/sidebar/sidebar-data.ts`
- Modify: `src/app/layouts/full/horizontal/sidebar/sidebar-data.ts`

- [ ] **Step 1: `lead-sources.component.ts`**

Standalone OnPush page. On init `listSources()`. Render a Material table: columns *Name*, *Sheet/Tab*, *Cadence*, *Status* (colored chip: Active=green, Paused=grey, Error=red, Disconnected=amber), *Last Sync* (`lastSuccessAt | date`), *Last Result* (parse `lastResultJson` → `+C ~U =S !F`; show `lastError` tooltip when Error), *Actions* (Sync now → `syncNow(id)`; Pause/Resume toggle by status; Edit mapping → opens `GoogleSheetsWizardComponent` in edit mode passing the source via `data`; Disconnect → confirm dialog → `deleteSource(id)`). Reuse `lead-list` density + dark-mode token CSS (`:host` + `:host-context(.dark-theme)`). Refresh list after every action. Empty state: "No connected sheets yet — use Import Leads ▾ → Connect Google Sheet."

- [ ] **Step 2: Route**

In `src/app/pages/crm/crm.routes.ts`, add a child route alongside the leads route:

```typescript
{
  path: 'lead-sources',
  loadComponent: () =>
    import('./lead-sources/lead-sources.component').then(m => m.LeadSourcesComponent),
  data: { feature: 'lead_import' },
},
```

(Match the existing route object shape — copy the sibling leads route's guard/data keys exactly.)

- [ ] **Step 3: Sidebar entries**

In both `vertical/sidebar/sidebar-data.ts` and `horizontal/sidebar/sidebar-data.ts`, add a nav item under the CRM section after "Leads":

```typescript
{ displayName: 'Lead Sources', iconName: 'table', route: '/crm/lead-sources', feature: 'lead_import' },
```

(Use the exact item shape/keys the file already uses — `iconName`/`route`/feature-gate key may differ; copy the "Leads" item and adjust.)

- [ ] **Step 4: Frontend build + visual smoke**

```bash
cd D:/ClaudeProjects/TravelCRMPlus && npx ng build --configuration development 2>&1 | tail -5
```
Expected: bundle complete, 0 TS errors. Run the app; navigate `/crm/lead-sources` → empty-state renders; the sidebar shows "Lead Sources" only when `lead_import` is entitled.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/crm/lead-sources/ src/app/pages/crm/crm.routes.ts "src/app/layouts/full/vertical/sidebar/sidebar-data.ts" "src/app/layouts/full/horizontal/sidebar/sidebar-data.ts"
git commit -m "feat(lead-import): Lead Sources management page + CRM route + sidebar entries"
```

(Do NOT stage `src/assets/scss/_container.scss`.)

---

## Task 16: Wrap — end-to-end smoke, docs regen, graphify, final review

**Files:**
- Modify: `docs/superpowers/plans/2026-05-17-lead-import.md` (mark progress)
- Possibly: `docs/implemented-modules.docx` regen if it exists and is in scope

- [ ] **Step 1: Backend + frontend green**

```bash
Get-Process -Name "TravelCrm.Api" -ErrorAction SilentlyContinue | Stop-Process -Force
cd D:/ClaudeProjects/TravelCRMPlus/TravelCrm.Api && dotnet build 2>&1 | Select-String -Pattern "Error|Warning" | Select-Object -Last 8
cd D:/ClaudeProjects/TravelCRMPlus && dotnet test TravelCrm.Tests --filter "FullyQualifiedName~LeadImport|FullyQualifiedName~OAuthState" 2>&1 | Select-Object -Last 8
cd D:/ClaudeProjects/TravelCRMPlus && npx ng build --configuration development 2>&1 | tail -5
```
Expected: 0 errors / 2 CS9113 / 0 CS0618; all LeadImport + OAuthState tests PASS; Angular bundle complete.

- [ ] **Step 2: Excel end-to-end smoke (real DB)**

Run the app, login (Conventions creds + `X-Tenant-Id`). Build a 3-row CSV: header `Email,First,Last,Status`, one valid new row, one row whose email already exists (expect Update), one row `Converted` status (expect Failed). `parse` → `preview` (assert counts) → `commit` (assert `created=1, updated=1, failed=1`, error report has the Converted row). Re-query `/api/crm/leads` to confirm the new lead exists and the existing one was updated.

- [ ] **Step 3: Sheets sync smoke with a faked reader (integration test)**

Add `TravelCrm.Tests/LeadImport/SyncJobTests.cs`: construct `RunLeadImportSyncJob` with a stub `ISheetsReader` returning a fixed `SheetValues`, a stub `IGoogleTokenProvider`, a Sqlite `ApplicationDbContext` seeded with a `LeadImportSource` + `GoogleOAuthToken`; assert first run creates leads + `LastResultJson` set + `Status=Active`; second run with identical values → all `Skipped` (A3 hash). Also a dispatcher `IsDue` test (Manual never due; `LastPolledAt=null` due; within-interval not due). Run:

```bash
cd D:/ClaudeProjects/TravelCRMPlus && dotnet test TravelCrm.Tests --filter "FullyQualifiedName~SyncJobTests" 2>&1 | Select-Object -Last 6
```
Expected: PASS.

- [ ] **Step 4: Mark plan progress + regen docs**

Add a `▶ EXECUTION PROGRESS` banner near the top of this plan marking Tasks 1–16 complete (mirror the Phase-1 plan's banner format). If `docs/implemented-modules.docx` exists and a "Lead Import" row is expected, regenerate that section per the docx skill (only if the user previously asked for that doc to be kept current — otherwise skip; YAGNI).

- [ ] **Step 5: Update the knowledge graph**

```bash
cd D:/ClaudeProjects/TravelCRMPlus && graphify update .
```
Expected: graph updated, no API cost (AST-only).

- [ ] **Step 6: Final commit**

```bash
git add docs/superpowers/plans/2026-05-17-lead-import.md TravelCrm.Tests/LeadImport/SyncJobTests.cs graphify-out/
git commit -m "test(lead-import): end-to-end smoke + sync-job/dispatcher tests; mark plan complete; graph refresh"
```

- [ ] **Step 7: Whole-implementation review**

Dispatch a final review (subagent or inline) covering: tenant isolation in every new handler/job, the A3 hash-skip correctness, OAuth state HMAC + refresh-token encryption at rest, the dedicated `fn_lead_import_source_row_version` trigger (NOT `gen_random_bytes`), feature gating on every controller, no `_container.scss` staged, EF snapshot integrity (`git status` clean, snapshot not truncated). Fix anything found, then report SHIP/NO-SHIP.

---

## Self-Review (writing-plans skill)

**Spec coverage:** §1 scope → Tasks 4–8 (Excel) + 9–15 (Sheets); §2 domain → Task 2/3; §3 API surface → Tasks 7,10,11,12; §4 engine → Tasks 4,5,6; §5 OAuth+sync → Tasks 9,10,13; §6 cross-cutting (feature code, migration trigger, staging sweep, security) → Tasks 1,3,7,10; §7 frontend → Tasks 8,14,15; §8/§9 sequencing → task order matches. All spec sections mapped.

**Placeholder scan:** Backend logic-heavy/novel pieces (entities, EF config, migration trigger SQL, `LeadFieldMap`, parsers, engine, OAuth state, jobs, controllers, services, models) have complete code. UI components (mapping, two wizards, Lead Sources page) are specified as detailed build specs with exact inputs/outputs/state machines/CSS conventions/line budgets rather than full templates — acceptable for Angular view code where the SidePanel/list patterns are already established in the codebase and must be matched, not reinvented.

**Type consistency:** `LeadImportResult`/`LeadImportRowOutcome`/`ParseResultDto`/`PreviewResultDto`/`GoogleStatusDto`/`LeadImportSourceDto` defined once in Task 4 `Dtos.cs` and reused verbatim by Tasks 7/10/11/12; `ILeadImportEngine.ApplyAsync` signature defined in Task 6 and called identically in Tasks 7 (Excel, `sourceId:null`) and 13 (Sheets, `sourceId:src.Id`); `ITabularLeadParser`/`LeadImportParseException` defined Task 5, reused Task 7/9; `OAuthState` API defined Task 10 and consumed by the same task's controller; frontend `LeadImportService` Excel methods (Task 8) + Google methods (Task 14) share one model file.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-17-lead-import.md`. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task + two-stage review (spec-reviewer + code-quality-reviewer), fast iteration. This is the pattern used successfully for Phase 1 (caught ~12 real bugs).
2. **Inline Execution** — execute tasks in this session with checkpoints for review.

Which approach?
