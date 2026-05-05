# TravelCRM Style Guide

This file codifies conventions the code review wants enforced. When in doubt, read existing features (e.g. `Features/Identity`) and match the pattern.

## Architectural rules

| # | Rule | Mechanism |
|---|------|-----------|
| 1 | Clean architecture layering: `Domain → Features → Infrastructure → Controllers` | NetArchTest (`Tests/Architecture/ArchitectureTests.cs`) |
| 2 | CQRS via MediatR — every write/read is a `Command` or `Query` | One request per file |
| 3 | All handler results wrap in `Result` / `Result<T>` — never throw for expected failure | `TravelCrm.Api.Common.Result` |
| 4 | Controllers are thin: parse → `mediator.Send` → return | NetArchTest forbids `DbContext` in `Controllers` |
| 5 | FluentValidation runs via MediatR pipeline behavior | Auto-scan |
| 6 | UTC everywhere — `DateTime.UtcNow`, never `DateTime.Now` | grep/CR |
| 7 | Resource-based authorization via `IAuthorizationService` + `SameTenantRequirement` for cross-tenant guards | `Infrastructure/Authorization/SameTenantRequirement.cs` |
| 8 | Compliance diff → `AuditSaveChangesInterceptor` (opt-in via `IAuditableEntity`). User-facing activity feed → `IIdentityActivityWriter.Record(...)` (explicit) | Distinct concerns — don't conflate |
| 9 | API responses wrapped in `ApiEnvelope<T>` `{success, data, meta, error, errors, correlationId}` | `ApiEnvelopeFilter` + Angular `EnvelopeInterceptor` |
| 10 | Correlation id: `X-Correlation-Id` header flows in/out; pushed to `LogContext` | `CorrelationIdMiddleware` |
| 11 | No secrets in `appsettings.json`. Dev uses `dotnet user-secrets`; prod uses env vars with prefix `TRAVELCRM_` | Fail-fast in `Program.cs` |
| 12 | Outbound HTTP uses `IHttpClientFactory` — never `new HttpClient()` | Named clients in `Program.cs` |
| 13 | Multi-tenant: every tenant-owned entity has `TenantId`; scoped via `ApplicationDbContext` global filters; handlers still filter explicitly | `BaseEntity.TenantId` |

## File layout: one-file-per-feature

A feature lives under `Features/{Area}/` and follows:

```
Features/Identity/
  Commands/
    CreateUserCommand.cs      ← record + validator + handler in ONE file
    UpdateUserCommand.cs
    DeleteUserCommand.cs
  Queries/
    GetUsersQuery.cs
    GetUserByIdQuery.cs
  DTOs/
    UserDto.cs
  Events/                     ← domain events + handlers
    UserCreatedEvent.cs
    SendAccountCreatedEmailHandler.cs
```

- **One command/query per file.** The file name matches the type name. Keep the `record`, `AbstractValidator`, and `IRequestHandler` together — it's easier to audit and easier to move.
- **Handlers are `sealed`** (enforced by NetArchTest).
- **DTOs are `record`s** — immutable, value-equality.
- **Never reference `HttpContext` in a handler** — inject `ICurrentUser` / `ITenantContext` instead.

## Naming

- Commands: past-tense intent — `CreateUserCommand`, `ToggleUserStatusCommand`.
- Queries: `Get...Query` (single) or `Get...sQuery` (list).
- Events: past-tense fact — `UserCreatedEvent`, `InviteSentEvent`.
- Permissions: dot-slug, plural resource — `admin.users.create`, `admin.users.reset_password`.

## Angular

- Standalone components; no `NgModules`.
- Services return **already-unwrapped** DTOs — the `EnvelopeInterceptor` peels `{success, data}` before it reaches your feature code.
- Guards/directives read permissions through `AuthService.hasPermission(slug)` — never decode the JWT inline.
- Signals for local component state; RxJS only for HTTP and cross-component streams.
- Search boxes use `debounceTime(250) + distinctUntilChanged()` before hitting the API.

## Tests

- Unit tests for handlers go under `TravelCrm.Tests/{Area}/`. Use EF Core `UseInMemoryDatabase` + fakes (`TestFakes.cs`).
- Architecture tests under `TravelCrm.Tests/Architecture/` guard the rules above.
- Run `dotnet test` from the solution root before opening a PR.
