# Lead Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a fully-wired Lead Management module — backend CRUD + Convert with CQRS, EF entity/migration, tests, and Angular list/form components backed by the real API.

**Architecture:** Standard CQRS-over-MediatR stack matching existing Reminders/Settings patterns. Lead entity lives in `Domain/Entities`, feature handlers in `Features/Leads/`, controller at `api/crm/leads`. Angular standalone components use `LeadsService` (injected `API_BASE_URL` token) with signals + `ChangeDetectionStrategy.OnPush`; the form is a separate lazy-loaded component at `/crm/leads/new` and `/crm/leads/:id`. C# enum `.ToString()` names match Angular form values (e.g. `SocialMedia`); the mapper adds spaces for display DTOs.

**Tech Stack:** ASP.NET Core 8, MediatR 12, FluentValidation, EF Core 8 + PostgreSQL (InMemory for tests), xUnit + FluentAssertions; Angular 21, standalone components, Reactive Forms, Angular Material.

---

### Task 1: Lead entity + DbContext + EF migration

**Files:**
- Create: `TravelCrm.Api/Domain/Entities/Lead.cs`
- Modify: `TravelCrm.Api/Infrastructure/Persistence/ApplicationDbContext.cs`

- [ ] **Step 1: Create the Lead entity**

```csharp
// TravelCrm.Api/Domain/Entities/Lead.cs
namespace TravelCrm.Api.Domain.Entities;

public enum LeadStatus
{
    New         = 1,
    Contacted   = 2,
    Qualified   = 3,
    Unqualified = 4,
    Converted   = 5,
}

public enum LeadSource
{
    Website       = 1,
    Referral      = 2,
    SocialMedia   = 3,
    EmailCampaign = 4,
    TradeShow     = 5,
    ColdCall      = 6,
    Partner       = 7,
    Other         = 8,
}

public sealed class Lead : IAuditableEntity
{
    public Guid         Id             { get; set; }
    public Guid         TenantId       { get; set; }
    public string       FirstName      { get; set; } = string.Empty;
    public string       LastName       { get; set; } = string.Empty;
    public string       Email          { get; set; } = string.Empty;
    public string       Phone          { get; set; } = string.Empty;
    public string       Company        { get; set; } = string.Empty;
    public string       JobTitle       { get; set; } = string.Empty;
    public LeadStatus   Status         { get; set; } = LeadStatus.New;
    public LeadSource   Source         { get; set; } = LeadSource.Other;
    public int          Score          { get; set; }
    public string       AssignedTo     { get; set; } = string.Empty;
    public List<string> Tags           { get; set; } = new();
    public string       Notes          { get; set; } = string.Empty;
    public decimal?     EstimatedValue { get; set; }
    public DateTime     CreatedAt      { get; set; }
    public DateTime?    UpdatedAt      { get; set; }
    public Guid?        CreatedBy      { get; set; }
}
```

- [ ] **Step 2: Add DbSet + EF configuration in ApplicationDbContext**

After the `Reminders` DbSet line add:
```csharp
// ── CRM ───────────────────────────────────────────────────────────────────────
public DbSet<Lead> Leads => Set<Lead>();
```

Inside `OnModelCreating`, after the Reminder config block add:
```csharp
builder.Entity<Lead>(b =>
{
    b.HasKey(l => l.Id);
    b.Property(l => l.FirstName).HasMaxLength(100).IsRequired();
    b.Property(l => l.LastName).HasMaxLength(100).IsRequired();
    b.Property(l => l.Email).HasMaxLength(256).IsRequired();
    b.Property(l => l.Phone).HasMaxLength(50);
    b.Property(l => l.Company).HasMaxLength(200);
    b.Property(l => l.JobTitle).HasMaxLength(200);
    b.Property(l => l.Status).HasConversion<int>();
    b.Property(l => l.Source).HasConversion<int>();
    b.Property(l => l.Score).HasDefaultValue(0);
    b.Property(l => l.AssignedTo).HasMaxLength(200);
    b.Property(l => l.Tags)
        .HasConversion(
            v => string.Join(',', v),
            v => v.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList())
        .HasMaxLength(1000);
    b.Property(l => l.Notes).HasMaxLength(4000);
    b.Property(l => l.EstimatedValue).HasColumnType("numeric(18,2)");
    b.HasIndex(l => l.TenantId);
});
```

- [ ] **Step 3: Create EF migration**

```
cd D:\ClaudeProjects\TravelCRMPlus\TravelCrm.Api
dotnet ef migrations add AddLeads --project TravelCrm.Api.csproj
```

Expected: new file `Migrations/YYYYMMDDHHMMSS_AddLeads.cs` created.

- [ ] **Step 4: Commit**

```
git add TravelCrm.Api/Domain/Entities/Lead.cs TravelCrm.Api/Infrastructure/Persistence/ApplicationDbContext.cs TravelCrm.Api/Migrations/
git commit -m "feat: add Lead entity, DbSet, and EF migration"
```

---

### Task 2: LeadDto + ListLeadsQuery + GetLeadQuery + tests

**Files:**
- Create: `TravelCrm.Api/Features/Leads/DTOs/LeadDto.cs`
- Create: `TravelCrm.Api/Features/Leads/Queries/ListLeadsQuery.cs`
- Create: `TravelCrm.Api/Features/Leads/Queries/GetLeadQuery.cs`
- Create: `TravelCrm.Tests/Leads/LeadQueryHandlersTests.cs`

- [ ] **Step 1: Write the failing tests**

```csharp
// TravelCrm.Tests/Leads/LeadQueryHandlersTests.cs
using FluentAssertions;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Leads.Queries;

namespace TravelCrm.Tests.Leads;

public class LeadQueryHandlersTests
{
    [Fact]
    public async Task List_rejects_caller_without_permission()
    {
        var (db, tenant, _) = TestDb.New();
        var h = new ListLeadsQueryHandler(db, tenant,
            new FakeCurrentUser(Guid.NewGuid(), hasPermission: false));

        var r = await h.Handle(new ListLeadsQuery(), default);

        r.IsSuccess.Should().BeFalse();
        r.Error.Should().Contain("permission");
    }

    [Fact]
    public async Task List_returns_only_tenant_leads()
    {
        var (db, tenant, tenantId) = TestDb.New();
        db.Leads.AddRange(
            new Lead { Id = Guid.NewGuid(), TenantId = tenantId,      FirstName = "Alice", LastName = "A", Email = "a@a.com", Status = LeadStatus.New, Source = LeadSource.Website },
            new Lead { Id = Guid.NewGuid(), TenantId = Guid.NewGuid(), FirstName = "Bob",   LastName = "B", Email = "b@b.com", Status = LeadStatus.New, Source = LeadSource.Website });
        await db.SaveChangesAsync();

        var h = new ListLeadsQueryHandler(db, tenant, new FakeCurrentUser(Guid.NewGuid()));
        var r = await h.Handle(new ListLeadsQuery(), default);

        r.IsSuccess.Should().BeTrue();
        r.Value!.Should().ContainSingle().Which.FirstName.Should().Be("Alice");
    }

    [Fact]
    public async Task Get_returns_failure_when_not_found()
    {
        var (db, tenant, _) = TestDb.New();
        var h = new GetLeadQueryHandler(db, tenant, new FakeCurrentUser(Guid.NewGuid()));

        var r = await h.Handle(new GetLeadQuery(Guid.NewGuid()), default);

        r.IsSuccess.Should().BeFalse();
        r.Error.Should().Contain("not found");
    }

    [Fact]
    public async Task Get_returns_lead_for_correct_tenant()
    {
        var (db, tenant, tenantId) = TestDb.New();
        var id = Guid.NewGuid();
        db.Leads.Add(new Lead { Id = id, TenantId = tenantId, FirstName = "Carol", LastName = "C",
            Email = "c@c.com", Status = LeadStatus.Qualified, Source = LeadSource.Referral });
        await db.SaveChangesAsync();

        var h = new GetLeadQueryHandler(db, tenant, new FakeCurrentUser(Guid.NewGuid()));
        var r = await h.Handle(new GetLeadQuery(id), default);

        r.IsSuccess.Should().BeTrue();
        r.Value!.FirstName.Should().Be("Carol");
    }
}
```

- [ ] **Step 2: Run tests — expect build failure**

```
cd D:\ClaudeProjects\TravelCRMPlus
dotnet test TravelCrm.Tests --filter "FullyQualifiedName~LeadQueryHandlersTests"
```

Expected: BUILD ERROR — handlers not yet defined.

- [ ] **Step 3: Create LeadDto**

```csharp
// TravelCrm.Api/Features/Leads/DTOs/LeadDto.cs
namespace TravelCrm.Api.Features.Leads.DTOs;

public sealed record LeadDto(
    Guid                  Id,
    Guid                  TenantId,
    string                FirstName,
    string                LastName,
    string                Email,
    string                Phone,
    string                Company,
    string                JobTitle,
    string                Status,
    string                Source,
    int                   Score,
    string                AssignedTo,
    IReadOnlyList<string> Tags,
    string                Notes,
    decimal?              EstimatedValue,
    DateTime              CreatedAt,
    DateTime?             UpdatedAt
);
```

- [ ] **Step 4: Create ListLeadsQuery (includes LeadMapper)**

```csharp
// TravelCrm.Api/Features/Leads/Queries/ListLeadsQuery.cs
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Leads.DTOs;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Leads.Queries;

public sealed record ListLeadsQuery : IRequest<Result<IReadOnlyList<LeadDto>>>;

public sealed class ListLeadsQueryHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<ListLeadsQuery, Result<IReadOnlyList<LeadDto>>>
{
    public async Task<Result<IReadOnlyList<LeadDto>>> Handle(
        ListLeadsQuery _, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.leads.view"))
            return Result.Failure<IReadOnlyList<LeadDto>>("You don't have permission to view leads.");

        var tenantId = tenantContext.TenantId;
        var rows = await db.Leads
            .AsNoTracking()
            .Where(l => l.TenantId == tenantId)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<LeadDto>>(rows.Select(LeadMapper.ToDto).ToList());
    }
}

internal static class LeadMapper
{
    internal static LeadDto ToDto(Lead l) => new(
        l.Id, l.TenantId, l.FirstName, l.LastName, l.Email, l.Phone,
        l.Company, l.JobTitle,
        l.Status.ToString(),
        l.Source switch
        {
            LeadSource.SocialMedia   => "Social Media",
            LeadSource.EmailCampaign => "Email Campaign",
            LeadSource.TradeShow     => "Trade Show",
            LeadSource.ColdCall      => "Cold Call",
            _                        => l.Source.ToString(),
        },
        l.Score, l.AssignedTo, l.Tags.AsReadOnly(), l.Notes,
        l.EstimatedValue, l.CreatedAt, l.UpdatedAt);
}
```

- [ ] **Step 5: Create GetLeadQuery**

```csharp
// TravelCrm.Api/Features/Leads/Queries/GetLeadQuery.cs
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Leads.DTOs;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Leads.Queries;

public sealed record GetLeadQuery(Guid Id) : IRequest<Result<LeadDto>>;

public sealed class GetLeadQueryHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<GetLeadQuery, Result<LeadDto>>
{
    public async Task<Result<LeadDto>> Handle(GetLeadQuery query, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.leads.view"))
            return Result.Failure<LeadDto>("You don't have permission to view leads.");

        var tenantId = tenantContext.TenantId;
        var row = await db.Leads
            .AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == query.Id && l.TenantId == tenantId, ct);

        if (row is null) return Result.Failure<LeadDto>("Lead not found.");
        return Result.Success(LeadMapper.ToDto(row));
    }
}
```

- [ ] **Step 6: Run tests — expect 4 PASS**

```
dotnet test TravelCrm.Tests --filter "FullyQualifiedName~LeadQueryHandlersTests"
```

Expected: 4 tests PASS.

- [ ] **Step 7: Commit**

```
git add TravelCrm.Api/Features/Leads/ TravelCrm.Tests/Leads/
git commit -m "feat: add LeadDto, ListLeadsQuery, GetLeadQuery with tests"
```

---

### Task 3: CreateLeadCommand + UpdateLeadCommand + tests

**Files:**
- Create: `TravelCrm.Api/Features/Leads/Commands/CreateLeadCommand.cs`
- Create: `TravelCrm.Api/Features/Leads/Commands/UpdateLeadCommand.cs`
- Create: `TravelCrm.Tests/Leads/LeadCommandHandlersTests.cs`

- [ ] **Step 1: Write the failing tests**

```csharp
// TravelCrm.Tests/Leads/LeadCommandHandlersTests.cs
using FluentAssertions;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Leads.Commands;

namespace TravelCrm.Tests.Leads;

public class LeadCommandHandlersTests
{
    [Fact]
    public async Task Create_rejects_caller_without_permission()
    {
        var (db, tenant, _) = TestDb.New();
        var h = new CreateLeadCommandHandler(db, tenant,
            new FakeCurrentUser(Guid.NewGuid(), hasPermission: false));

        var r = await h.Handle(new CreateLeadCommand(
            "Jane", "Doe", "jane@doe.com", "+1555", "Corp", "CEO",
            LeadStatus.New, LeadSource.Website, 50, "Alice",
            new[] { "VIP" }, "", 10_000m), default);

        r.IsSuccess.Should().BeFalse();
        r.Error.Should().Contain("permission");
    }

    [Fact]
    public async Task Create_persists_lead_and_returns_dto()
    {
        var (db, tenant, tenantId) = TestDb.New();
        var h = new CreateLeadCommandHandler(db, tenant, new FakeCurrentUser(Guid.NewGuid()));

        var r = await h.Handle(new CreateLeadCommand(
            "Jane", "Doe", "jane@doe.com", "+1555", "Corp", "CEO",
            LeadStatus.New, LeadSource.Website, 50, "Alice",
            new[] { "VIP" }, "Looks good", 10_000m), default);

        r.IsSuccess.Should().BeTrue();
        r.Value!.FirstName.Should().Be("Jane");
        r.Value.TenantId.Should().Be(tenantId);
        db.Leads.Should().HaveCount(1);
    }

    [Fact]
    public async Task Update_rejects_caller_without_permission()
    {
        var (db, tenant, tenantId) = TestDb.New();
        var id = Guid.NewGuid();
        db.Leads.Add(new Lead { Id = id, TenantId = tenantId, FirstName = "X", LastName = "Y",
            Email = "x@y.com", Status = LeadStatus.New, Source = LeadSource.Other });
        await db.SaveChangesAsync();

        var h = new UpdateLeadCommandHandler(db, tenant,
            new FakeCurrentUser(Guid.NewGuid(), hasPermission: false));
        var r = await h.Handle(new UpdateLeadCommand(id,
            "X", "Y", "x@y.com", "", "", "", LeadStatus.Contacted,
            LeadSource.Other, 50, "Alice", Array.Empty<string>(), "", null), default);

        r.IsSuccess.Should().BeFalse();
        r.Error.Should().Contain("permission");
    }

    [Fact]
    public async Task Update_returns_failure_for_wrong_tenant()
    {
        var (db, tenant, _) = TestDb.New();
        var id = Guid.NewGuid();
        db.Leads.Add(new Lead { Id = id, TenantId = Guid.NewGuid(), FirstName = "X", LastName = "Y",
            Email = "x@y.com", Status = LeadStatus.New, Source = LeadSource.Other });
        await db.SaveChangesAsync();

        var h = new UpdateLeadCommandHandler(db, tenant, new FakeCurrentUser(Guid.NewGuid()));
        var r = await h.Handle(new UpdateLeadCommand(id,
            "X", "Y", "x@y.com", "", "", "", LeadStatus.Contacted,
            LeadSource.Other, 50, "Alice", Array.Empty<string>(), "", null), default);

        r.IsSuccess.Should().BeFalse();
        r.Error.Should().Contain("not found");
    }

    [Fact]
    public async Task Update_persists_changes()
    {
        var (db, tenant, tenantId) = TestDb.New();
        var id = Guid.NewGuid();
        db.Leads.Add(new Lead { Id = id, TenantId = tenantId, FirstName = "Old", LastName = "Name",
            Email = "old@test.com", Status = LeadStatus.New, Source = LeadSource.Website });
        await db.SaveChangesAsync();

        var h = new UpdateLeadCommandHandler(db, tenant, new FakeCurrentUser(Guid.NewGuid()));
        var r = await h.Handle(new UpdateLeadCommand(id,
            "New", "Name", "old@test.com", "", "BigCo", "CTO",
            LeadStatus.Qualified, LeadSource.Referral, 80, "Bob",
            new[] { "Enterprise" }, "Big deal", 500_000m), default);

        r.IsSuccess.Should().BeTrue();
        r.Value!.FirstName.Should().Be("New");
        r.Value.Status.Should().Be("Qualified");
        r.Value.Score.Should().Be(80);
    }
}
```

- [ ] **Step 2: Run tests — expect build failure**

```
dotnet test TravelCrm.Tests --filter "FullyQualifiedName~LeadCommandHandlersTests"
```

Expected: BUILD ERROR.

- [ ] **Step 3: Create CreateLeadCommand**

```csharp
// TravelCrm.Api/Features/Leads/Commands/CreateLeadCommand.cs
using FluentValidation;
using MediatR;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Leads.DTOs;
using TravelCrm.Api.Features.Leads.Queries;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Leads.Commands;

public sealed record CreateLeadCommand(
    string              FirstName,
    string              LastName,
    string              Email,
    string              Phone,
    string              Company,
    string              JobTitle,
    LeadStatus          Status,
    LeadSource          Source,
    int                 Score,
    string              AssignedTo,
    IEnumerable<string> Tags,
    string              Notes,
    decimal?            EstimatedValue
) : IRequest<Result<LeadDto>>;

public sealed class CreateLeadCommandValidator : AbstractValidator<CreateLeadCommand>
{
    public CreateLeadCommandValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.Score).InclusiveBetween(0, 100);
        RuleFor(x => x.EstimatedValue).GreaterThanOrEqualTo(0).When(x => x.EstimatedValue.HasValue);
    }
}

public sealed class CreateLeadCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<CreateLeadCommand, Result<LeadDto>>
{
    public async Task<Result<LeadDto>> Handle(CreateLeadCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure<LeadDto>("Tenant context not resolved.");
        if (!currentUser.HasPermission("crm.leads.manage"))
            return Result.Failure<LeadDto>("You don't have permission to manage leads.");

        var row = new Lead
        {
            Id             = Guid.NewGuid(),
            TenantId       = tenantId.Value,
            FirstName      = cmd.FirstName,
            LastName       = cmd.LastName,
            Email          = cmd.Email,
            Phone          = cmd.Phone ?? string.Empty,
            Company        = cmd.Company ?? string.Empty,
            JobTitle       = cmd.JobTitle ?? string.Empty,
            Status         = cmd.Status,
            Source         = cmd.Source,
            Score          = cmd.Score,
            AssignedTo     = cmd.AssignedTo ?? string.Empty,
            Tags           = cmd.Tags?.ToList() ?? new(),
            Notes          = cmd.Notes ?? string.Empty,
            EstimatedValue = cmd.EstimatedValue,
            CreatedAt      = DateTime.UtcNow,
            CreatedBy      = currentUser.UserId == Guid.Empty ? (Guid?)null : currentUser.UserId,
        };

        db.Leads.Add(row);
        await db.SaveChangesAsync(ct);
        return Result.Success(LeadMapper.ToDto(row));
    }
}
```

- [ ] **Step 4: Create UpdateLeadCommand**

```csharp
// TravelCrm.Api/Features/Leads/Commands/UpdateLeadCommand.cs
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Leads.DTOs;
using TravelCrm.Api.Features.Leads.Queries;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Leads.Commands;

public sealed record UpdateLeadCommand(
    Guid                Id,
    string              FirstName,
    string              LastName,
    string              Email,
    string              Phone,
    string              Company,
    string              JobTitle,
    LeadStatus          Status,
    LeadSource          Source,
    int                 Score,
    string              AssignedTo,
    IEnumerable<string> Tags,
    string              Notes,
    decimal?            EstimatedValue
) : IRequest<Result<LeadDto>>;

public sealed class UpdateLeadCommandValidator : AbstractValidator<UpdateLeadCommand>
{
    public UpdateLeadCommandValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.Score).InclusiveBetween(0, 100);
        RuleFor(x => x.EstimatedValue).GreaterThanOrEqualTo(0).When(x => x.EstimatedValue.HasValue);
    }
}

public sealed class UpdateLeadCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<UpdateLeadCommand, Result<LeadDto>>
{
    public async Task<Result<LeadDto>> Handle(UpdateLeadCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure<LeadDto>("Tenant context not resolved.");
        if (!currentUser.HasPermission("crm.leads.manage"))
            return Result.Failure<LeadDto>("You don't have permission to manage leads.");

        var row = await db.Leads
            .FirstOrDefaultAsync(l => l.Id == cmd.Id && l.TenantId == tenantId, ct);
        if (row is null) return Result.Failure<LeadDto>("Lead not found.");

        row.FirstName      = cmd.FirstName;
        row.LastName       = cmd.LastName;
        row.Email          = cmd.Email;
        row.Phone          = cmd.Phone ?? string.Empty;
        row.Company        = cmd.Company ?? string.Empty;
        row.JobTitle       = cmd.JobTitle ?? string.Empty;
        row.Status         = cmd.Status;
        row.Source         = cmd.Source;
        row.Score          = cmd.Score;
        row.AssignedTo     = cmd.AssignedTo ?? string.Empty;
        row.Tags           = cmd.Tags?.ToList() ?? new();
        row.Notes          = cmd.Notes ?? string.Empty;
        row.EstimatedValue = cmd.EstimatedValue;
        row.UpdatedAt      = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        return Result.Success(LeadMapper.ToDto(row));
    }
}
```

- [ ] **Step 5: Run tests — expect 5 PASS**

```
dotnet test TravelCrm.Tests --filter "FullyQualifiedName~LeadCommandHandlersTests"
```

- [ ] **Step 6: Commit**

```
git add TravelCrm.Api/Features/Leads/Commands/ TravelCrm.Tests/Leads/
git commit -m "feat: add CreateLeadCommand, UpdateLeadCommand with tests"
```

---

### Task 4: DeleteLeadCommand + ConvertLeadCommand + tests

**Files:**
- Create: `TravelCrm.Api/Features/Leads/Commands/DeleteLeadCommand.cs`
- Create: `TravelCrm.Api/Features/Leads/Commands/ConvertLeadCommand.cs`
- Modify: `TravelCrm.Tests/Leads/LeadCommandHandlersTests.cs`

- [ ] **Step 1: Append these 3 test methods inside `LeadCommandHandlersTests`**

```csharp
[Fact]
public async Task Delete_removes_lead()
{
    var (db, tenant, tenantId) = TestDb.New();
    var id = Guid.NewGuid();
    db.Leads.Add(new Lead { Id = id, TenantId = tenantId, FirstName = "Del", LastName = "Me",
        Email = "del@me.com", Status = LeadStatus.New, Source = LeadSource.Other });
    await db.SaveChangesAsync();

    var h = new DeleteLeadCommandHandler(db, tenant, new FakeCurrentUser(Guid.NewGuid()));
    var r = await h.Handle(new DeleteLeadCommand(id), default);

    r.IsSuccess.Should().BeTrue();
    db.Leads.Should().BeEmpty();
}

[Fact]
public async Task Delete_returns_failure_for_wrong_tenant()
{
    var (db, tenant, _) = TestDb.New();
    var id = Guid.NewGuid();
    db.Leads.Add(new Lead { Id = id, TenantId = Guid.NewGuid(), FirstName = "X", LastName = "Y",
        Email = "x@y.com", Status = LeadStatus.New, Source = LeadSource.Other });
    await db.SaveChangesAsync();

    var h = new DeleteLeadCommandHandler(db, tenant, new FakeCurrentUser(Guid.NewGuid()));
    var r = await h.Handle(new DeleteLeadCommand(id), default);

    r.IsSuccess.Should().BeFalse();
    r.Error.Should().Contain("not found");
}

[Fact]
public async Task Convert_sets_status_to_Converted()
{
    var (db, tenant, tenantId) = TestDb.New();
    var id = Guid.NewGuid();
    db.Leads.Add(new Lead { Id = id, TenantId = tenantId, FirstName = "Conv", LastName = "Me",
        Email = "conv@me.com", Status = LeadStatus.Qualified, Source = LeadSource.Referral });
    await db.SaveChangesAsync();

    var h = new ConvertLeadCommandHandler(db, tenant, new FakeCurrentUser(Guid.NewGuid()));
    var r = await h.Handle(new ConvertLeadCommand(id), default);

    r.IsSuccess.Should().BeTrue();
    r.Value!.Status.Should().Be("Converted");
}
```

- [ ] **Step 2: Run tests — expect build failure**

```
dotnet test TravelCrm.Tests --filter "FullyQualifiedName~LeadCommandHandlersTests"
```

- [ ] **Step 3: Create DeleteLeadCommand**

```csharp
// TravelCrm.Api/Features/Leads/Commands/DeleteLeadCommand.cs
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Leads.Commands;

public sealed record DeleteLeadCommand(Guid Id) : IRequest<Result>;

public sealed class DeleteLeadCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<DeleteLeadCommand, Result>
{
    public async Task<Result> Handle(DeleteLeadCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure("Tenant context not resolved.");
        if (!currentUser.HasPermission("crm.leads.manage"))
            return Result.Failure("You don't have permission to manage leads.");

        var row = await db.Leads
            .FirstOrDefaultAsync(l => l.Id == cmd.Id && l.TenantId == tenantId, ct);
        if (row is null) return Result.Failure("Lead not found.");

        db.Leads.Remove(row);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
```

- [ ] **Step 4: Create ConvertLeadCommand**

```csharp
// TravelCrm.Api/Features/Leads/Commands/ConvertLeadCommand.cs
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Leads.DTOs;
using TravelCrm.Api.Features.Leads.Queries;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Leads.Commands;

public sealed record ConvertLeadCommand(Guid Id) : IRequest<Result<LeadDto>>;

public sealed class ConvertLeadCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<ConvertLeadCommand, Result<LeadDto>>
{
    public async Task<Result<LeadDto>> Handle(ConvertLeadCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure<LeadDto>("Tenant context not resolved.");
        if (!currentUser.HasPermission("crm.leads.manage"))
            return Result.Failure<LeadDto>("You don't have permission to manage leads.");

        var row = await db.Leads
            .FirstOrDefaultAsync(l => l.Id == cmd.Id && l.TenantId == tenantId, ct);
        if (row is null) return Result.Failure<LeadDto>("Lead not found.");
        if (row.Status == LeadStatus.Converted)
            return Result.Failure<LeadDto>("Lead is already converted.");

        row.Status    = LeadStatus.Converted;
        row.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        return Result.Success(LeadMapper.ToDto(row));
    }
}
```

- [ ] **Step 5: Run all command tests — expect 8 PASS**

```
dotnet test TravelCrm.Tests --filter "FullyQualifiedName~LeadCommandHandlersTests"
```

- [ ] **Step 6: Run full suite — expect all tests pass**

```
dotnet test TravelCrm.Tests
```

Expected: 36 pre-existing + 4 query + 8 command = 48 total, all PASS.

- [ ] **Step 7: Commit**

```
git add TravelCrm.Api/Features/Leads/Commands/ TravelCrm.Tests/Leads/
git commit -m "feat: add DeleteLeadCommand, ConvertLeadCommand with tests"
```

---

### Task 5: LeadsController

**Files:**
- Create: `TravelCrm.Api/Features/Leads/LeadsController.cs`

- [ ] **Step 1: Create the controller**

```csharp
// TravelCrm.Api/Features/Leads/LeadsController.cs
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Leads.Commands;
using TravelCrm.Api.Features.Leads.Queries;

namespace TravelCrm.Api.Features.Leads;

[Authorize]
[ApiController]
[Route("api/crm/leads")]
public sealed class LeadsController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var r = await mediator.Send(new ListLeadsQuery(), ct);
        return r.IsSuccess ? Ok(r.Value) : Forbid();
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var r = await mediator.Send(new GetLeadQuery(id), ct);
        if (!r.IsSuccess)
            return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
                ? NotFound(new { error = r.Error })
                : Forbid();
        return Ok(r.Value);
    }

    [HttpPost]
    public async Task<IActionResult> Create(LeadUpsertRequest body, CancellationToken ct)
    {
        var r = await mediator.Send(new CreateLeadCommand(
            body.FirstName, body.LastName, body.Email,
            body.Phone ?? string.Empty, body.Company ?? string.Empty,
            body.JobTitle ?? string.Empty, body.Status, body.Source,
            body.Score, body.AssignedTo ?? string.Empty,
            body.Tags ?? Enumerable.Empty<string>(),
            body.Notes ?? string.Empty, body.EstimatedValue), ct);

        return r.IsSuccess
            ? CreatedAtAction(nameof(Get), new { id = r.Value!.Id }, r.Value)
            : BadRequest(new { error = r.Error });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, LeadUpsertRequest body, CancellationToken ct)
    {
        var r = await mediator.Send(new UpdateLeadCommand(
            id, body.FirstName, body.LastName, body.Email,
            body.Phone ?? string.Empty, body.Company ?? string.Empty,
            body.JobTitle ?? string.Empty, body.Status, body.Source,
            body.Score, body.AssignedTo ?? string.Empty,
            body.Tags ?? Enumerable.Empty<string>(),
            body.Notes ?? string.Empty, body.EstimatedValue), ct);

        if (!r.IsSuccess)
            return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
                ? NotFound(new { error = r.Error })
                : BadRequest(new { error = r.Error });
        return Ok(r.Value);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var r = await mediator.Send(new DeleteLeadCommand(id), ct);
        if (!r.IsSuccess)
            return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
                ? NotFound(new { error = r.Error })
                : BadRequest(new { error = r.Error });
        return NoContent();
    }

    [HttpPost("{id:guid}/convert")]
    public async Task<IActionResult> Convert(Guid id, CancellationToken ct)
    {
        var r = await mediator.Send(new ConvertLeadCommand(id), ct);
        if (!r.IsSuccess)
            return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
                ? NotFound(new { error = r.Error })
                : BadRequest(new { error = r.Error });
        return Ok(r.Value);
    }
}

public sealed record LeadUpsertRequest(
    string               FirstName,
    string               LastName,
    string               Email,
    string?              Phone,
    string?              Company,
    string?              JobTitle,
    LeadStatus           Status,
    LeadSource           Source,
    int                  Score,
    string?              AssignedTo,
    IEnumerable<string>? Tags,
    string?              Notes,
    decimal?             EstimatedValue
);
```

- [ ] **Step 2: Build to verify**

```
cd D:\ClaudeProjects\TravelCRMPlus\TravelCrm.Api
dotnet build
```

Expected: Build succeeded, 0 errors.

- [ ] **Step 3: Commit**

```
git add TravelCrm.Api/Features/Leads/LeadsController.cs
git commit -m "feat: add LeadsController (CRUD + Convert at api/crm/leads)"
```

---

### Task 6: Angular service + Lead.id type update

**Files:**
- Modify: `src/app/core/models/crm.models.ts`
- Create: `src/app/core/services/leads.service.ts`

- [ ] **Step 1: Find the API_BASE_URL token path**

```
grep -r "export.*API_BASE_URL" src/app/core --include="*.ts" -l
```

Note the path — use it in the import in Step 3.

- [ ] **Step 2: Update Lead.id to string in crm.models.ts**

In `src/app/core/models/crm.models.ts` change only:

```typescript
// Before:
export interface Lead {
  id: number;

// After:
export interface Lead {
  id: string;
```

Also update `LeadSource` to include the enum-name variants the API returns for compound names:

```typescript
// Before:
export type LeadSource = 'Website' | 'Referral' | 'Social Media' | 'Email Campaign' | 'Trade Show' | 'Cold Call' | 'Partner' | 'Other';

// After (API returns display strings via the mapper's switch expression):
export type LeadSource = 'Website' | 'Referral' | 'Social Media' | 'Email Campaign' | 'Trade Show' | 'Cold Call' | 'Partner' | 'Other';
```

No change needed — the C# mapper already converts `SocialMedia` → `"Social Media"` etc., so the Angular type stays as-is.

- [ ] **Step 3: Create leads.service.ts**

Replace `<TOKEN_PATH>` with the path found in Step 1 (e.g. `../tokens/api-base-url.token`):

```typescript
// src/app/core/services/leads.service.ts
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '<TOKEN_PATH>';
import { LeadStatus, LeadSource } from '../models/crm.models';

export interface LeadDto {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  jobTitle: string;
  status: string;
  source: string;
  score: number;
  assignedTo: string;
  tags: string[];
  notes: string;
  estimatedValue?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface LeadWriteBody {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  jobTitle: string;
  status: LeadStatus;
  source: LeadSource;
  score: number;
  assignedTo: string;
  tags: string[];
  notes: string;
  estimatedValue?: number;
}

@Injectable({ providedIn: 'root' })
export class LeadsService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly url  = `${this.base}/crm/leads`;

  list():                          Observable<LeadDto[]>  { return this.http.get<LeadDto[]>(this.url); }
  get(id: string):                 Observable<LeadDto>    { return this.http.get<LeadDto>(`${this.url}/${id}`); }
  create(body: LeadWriteBody):     Observable<LeadDto>    { return this.http.post<LeadDto>(this.url, body); }
  update(id: string, b: LeadWriteBody): Observable<LeadDto> { return this.http.put<LeadDto>(`${this.url}/${id}`, b); }
  delete(id: string):              Observable<void>       { return this.http.delete<void>(`${this.url}/${id}`); }
  convert(id: string):             Observable<LeadDto>    { return this.http.post<LeadDto>(`${this.url}/${id}/convert`, {}); }
}
```

- [ ] **Step 4: Commit**

```
git add src/app/core/models/crm.models.ts src/app/core/services/leads.service.ts
git commit -m "feat: add LeadsService wired to API_BASE_URL token"
```

---

### Task 7: Update lead-list.component.ts — real API + live KPIs + wired actions

**Files:**
- Modify: `src/app/pages/crm/leads/lead-list/lead-list.component.ts`

- [ ] **Step 1: Replace the entire component**

Full replacement for `src/app/pages/crm/leads/lead-list/lead-list.component.ts`:

```typescript
import {
  Component, ChangeDetectionStrategy, inject, OnInit, signal,
  computed, ViewChild, AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TablerIconsModule } from 'angular-tabler-icons';
import { LeadsService, LeadDto } from '../../../../core/services/leads.service';
import { LeadStatus, LeadSource } from '../../../../core/models/crm.models';

@Component({
  selector: 'app-lead-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterModule, FormsModule,
    MatTableModule, MatPaginatorModule, MatSortModule,
    MatInputModule, MatFormFieldModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatChipsModule,
    MatTooltipModule, MatMenuModule, MatProgressBarModule,
    MatProgressSpinnerModule, MatCardModule, MatSnackBarModule,
    TablerIconsModule,
  ],
  template: `
    <div class="crm-page">
      <div class="page-header">
        <div class="page-title">
          <h2>Leads</h2>
          <span class="subtitle">Track and manage potential customers</span>
        </div>
        <div class="page-actions">
          <button mat-flat-button color="primary" [routerLink]="['/crm/leads/new']">
            <i-tabler name="plus" class="icon-sm mr-1"></i-tabler> Add Lead
          </button>
        </div>
      </div>

      <!-- KPI Cards -->
      <div class="kpi-grid">
        <mat-card class="kpi-card">
          <mat-card-content>
            <div class="kpi-inner">
              <div class="kpi-icon" style="background:#e8f0fe">
                <i-tabler name="users" style="color:#1a73e8" class="icon-md"></i-tabler>
              </div>
              <div class="kpi-data">
                <span class="kpi-value">{{ totalLeads() }}</span>
                <span class="kpi-label">Total Leads</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="kpi-card">
          <mat-card-content>
            <div class="kpi-inner">
              <div class="kpi-icon" style="background:#ccfbf1">
                <i-tabler name="user-plus" style="color:#0d9488" class="icon-md"></i-tabler>
              </div>
              <div class="kpi-data">
                <span class="kpi-value">{{ newLeads() }}</span>
                <span class="kpi-label">New</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="kpi-card">
          <mat-card-content>
            <div class="kpi-inner">
              <div class="kpi-icon" style="background:#ede9fe">
                <i-tabler name="check-circle" style="color:#7c3aed" class="icon-md"></i-tabler>
              </div>
              <div class="kpi-data">
                <span class="kpi-value">{{ qualifiedLeads() }}</span>
                <span class="kpi-label">Qualified</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="kpi-card">
          <mat-card-content>
            <div class="kpi-inner">
              <div class="kpi-icon" style="background:#ffedd5">
                <i-tabler name="arrow-right-circle" style="color:#ea580c" class="icon-md"></i-tabler>
              </div>
              <div class="kpi-data">
                <span class="kpi-value">{{ convertedLeads() }}</span>
                <span class="kpi-label">Converted</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="40"></mat-spinner></div>
      }

      @if (!loading()) {
        <mat-card class="filter-card">
          <mat-card-content>
            <div class="filter-row">
              <mat-form-field appearance="outline" class="filter-search">
                <mat-label>Search leads</mat-label>
                <input matInput (keyup)="applyFilter($event)" placeholder="Name, email, company">
                <mat-icon matSuffix>search</mat-icon>
              </mat-form-field>
              <mat-form-field appearance="outline" class="filter-select">
                <mat-label>Status</mat-label>
                <mat-select [(ngModel)]="statusFilter" (ngModelChange)="filterByDropdown()">
                  <mat-option value="">All</mat-option>
                  <mat-option *ngFor="let s of statuses" [value]="s">{{ s }}</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline" class="filter-select">
                <mat-label>Source</mat-label>
                <mat-select [(ngModel)]="sourceFilter" (ngModelChange)="filterByDropdown()">
                  <mat-option value="">All</mat-option>
                  <mat-option *ngFor="let s of sources" [value]="s">{{ s }}</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="table-card">
          <mat-card-content>
            <div class="table-wrapper">
              <table mat-table [dataSource]="dataSource" matSort class="crm-table">
                <ng-container matColumnDef="name">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>Name</th>
                  <td mat-cell *matCellDef="let row">
                    <div class="lead-name">
                      <div class="avatar" [style.background]="getAvatarColor(row.firstName)">
                        {{ row.firstName[0] }}{{ row.lastName[0] }}
                      </div>
                      <div>
                        <strong>{{ row.firstName }} {{ row.lastName }}</strong>
                        <div class="sub-text">{{ row.jobTitle }}</div>
                      </div>
                    </div>
                  </td>
                </ng-container>
                <ng-container matColumnDef="company">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>Company</th>
                  <td mat-cell *matCellDef="let row">
                    <div class="company-cell">
                      <i-tabler name="building" class="icon-xs text-muted mr-1"></i-tabler>
                      {{ row.company }}
                    </div>
                  </td>
                </ng-container>
                <ng-container matColumnDef="status">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>Status</th>
                  <td mat-cell *matCellDef="let row">
                    <span class="status-badge" [ngClass]="getStatusClass(row.status)">{{ row.status }}</span>
                  </td>
                </ng-container>
                <ng-container matColumnDef="score">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>Score</th>
                  <td mat-cell *matCellDef="let row">
                    <div class="score-cell">
                      <span class="score-num" [ngClass]="getScoreClass(row.score)">{{ row.score }}</span>
                      <mat-progress-bar mode="determinate" [value]="row.score"
                        [ngClass]="getScoreBarClass(row.score)" class="score-bar"></mat-progress-bar>
                    </div>
                  </td>
                </ng-container>
                <ng-container matColumnDef="source">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>Source</th>
                  <td mat-cell *matCellDef="let row">{{ row.source }}</td>
                </ng-container>
                <ng-container matColumnDef="estimatedValue">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>Est. Value</th>
                  <td mat-cell *matCellDef="let row">
                    <strong>{{ row.estimatedValue | currency:'USD':'symbol':'1.0-0' }}</strong>
                  </td>
                </ng-container>
                <ng-container matColumnDef="assignedTo">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>Assigned To</th>
                  <td mat-cell *matCellDef="let row">{{ row.assignedTo }}</td>
                </ng-container>
                <ng-container matColumnDef="createdAt">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>Created</th>
                  <td mat-cell *matCellDef="let row">{{ row.createdAt | date:'mediumDate' }}</td>
                </ng-container>
                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef></th>
                  <td mat-cell *matCellDef="let row">
                    <button mat-icon-button [matMenuTriggerFor]="menu">
                      <i-tabler name="dots-vertical" class="icon-sm"></i-tabler>
                    </button>
                    <mat-menu #menu="matMenu">
                      <button mat-menu-item [routerLink]="['/crm/leads', row.id]">
                        <i-tabler name="edit" class="icon-xs mr-1"></i-tabler> Edit
                      </button>
                      <button mat-menu-item (click)="convertLead(row)"
                              [disabled]="row.status === 'Converted'">
                        <i-tabler name="arrow-right" class="icon-xs mr-1"></i-tabler> Convert
                      </button>
                      <button mat-menu-item (click)="deleteLead(row)" class="text-error">
                        <i-tabler name="trash" class="icon-xs mr-1"></i-tabler> Delete
                      </button>
                    </mat-menu>
                  </td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="table-row"></tr>
              </table>
            </div>
            <mat-paginator [pageSizeOptions]="[10, 25, 50]" showFirstLastButtons></mat-paginator>
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
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .kpi-card mat-card-content { padding: 16px; }
    .kpi-inner { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    .kpi-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
    .kpi-data { display: flex; flex-direction: column; }
    .kpi-value { font-size: 24px; font-weight: 700; line-height: 1; }
    .kpi-label { font-size: 13px; color: #6c757d; margin-top: 4px; }
    .loading-center { display: flex; justify-content: center; padding: 40px; }
    .filter-card { margin-bottom: 20px; }
    .filter-card mat-card-content { padding: 16px; }
    .filter-row { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
    .filter-search { flex: 1; min-width: 200px; }
    .filter-select { width: 160px; }
    .table-card mat-card-content { padding: 0; }
    .table-wrapper { overflow-x: auto; }
    .crm-table { width: 100%; }
    .lead-name { display: flex; align-items: center; gap: 10px; padding: 8px 0; }
    .avatar { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; color: white; flex-shrink: 0; }
    .sub-text { font-size: 12px; color: #6c757d; }
    .company-cell { display: flex; align-items: center; }
    .text-muted { color: #6c757d; }
    .mr-1 { margin-right: 4px; }
    .status-badge { padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .status-new { background: #e3f2fd; color: #1565c0; }
    .status-contacted { background: #fff3e0; color: #e65100; }
    .status-qualified { background: #e8f5e9; color: #2e7d32; }
    .status-unqualified { background: #fce4ec; color: #c62828; }
    .status-converted { background: #f3e5f5; color: #6a1b9a; }
    .score-cell { display: flex; flex-direction: column; gap: 4px; min-width: 80px; }
    .score-num { font-weight: 700; font-size: 14px; }
    .score-bar { height: 4px; border-radius: 2px; }
    .score-high { color: #28a745; }
    .score-mid { color: #fd7e14; }
    .score-low { color: #dc3545; }
    .text-error { color: #dc3545; }
    .table-row:hover { background: rgba(0,0,0,0.02); cursor: pointer; }
    .icon-xs { font-size: 14px; width: 14px; height: 14px; }
    .icon-sm { font-size: 18px; width: 18px; height: 18px; }
    .icon-md { font-size: 24px; width: 24px; height: 24px; }
    @media (max-width: 768px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
  `],
})
export class LeadListComponent implements OnInit, AfterViewInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort)      sort!: MatSort;

  private readonly api   = inject(LeadsService);
  private readonly snack = inject(MatSnackBar);

  readonly loading        = signal(true);
  private readonly leads$ = signal<LeadDto[]>([]);

  readonly totalLeads     = computed(() => this.leads$().length);
  readonly newLeads       = computed(() => this.leads$().filter(l => l.status === 'New').length);
  readonly qualifiedLeads = computed(() => this.leads$().filter(l => l.status === 'Qualified').length);
  readonly convertedLeads = computed(() => this.leads$().filter(l => l.status === 'Converted').length);

  displayedColumns = ['name','company','status','score','source','estimatedValue','assignedTo','createdAt','actions'];
  dataSource = new MatTableDataSource<LeadDto>([]);

  statusFilter = '';
  sourceFilter = '';

  statuses: LeadStatus[] = ['New','Contacted','Qualified','Unqualified','Converted'];
  sources: LeadSource[]  = ['Website','Referral','Social Media','Email Campaign','Trade Show','Cold Call','Partner','Other'];

  ngOnInit(): void { this.load(); }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort      = this.sort;
    this.dataSource.filterPredicate = (data: LeadDto, filter: string) => {
      const f = JSON.parse(filter || '{}');
      const t = f.text || '';
      return (!t || `${data.firstName} ${data.lastName} ${data.email} ${data.company}`.toLowerCase().includes(t))
          && (!f.status || data.status === f.status)
          && (!f.source || data.source === f.source);
    };
  }

  private load(): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: rows => {
        this.leads$.set(rows);
        this.dataSource.data = rows;
        this.loading.set(false);
      },
      error: () => {
        this.snack.open('Failed to load leads.', 'Close', { duration: 3500 });
        this.loading.set(false);
      },
    });
  }

  applyFilter(e: Event): void {
    const text = (e.target as HTMLInputElement).value.trim().toLowerCase();
    this.dataSource.filter = JSON.stringify({ text, status: this.statusFilter, source: this.sourceFilter });
  }

  filterByDropdown(): void {
    this.dataSource.filter = JSON.stringify({ text: '', status: this.statusFilter, source: this.sourceFilter });
  }

  convertLead(row: LeadDto): void {
    if (!confirm(`Convert "${row.firstName} ${row.lastName}" to a customer?`)) return;
    this.api.convert(row.id).subscribe({
      next: updated => {
        this.snack.open('Lead converted.', 'Close', { duration: 2500 });
        const next = this.dataSource.data.map(l => l.id === updated.id ? updated : l);
        this.dataSource.data = next;
        this.leads$.set(next);
      },
      error: err => this.snack.open(err?.error?.error ?? 'Convert failed.', 'Close', { duration: 3500 }),
    });
  }

  deleteLead(row: LeadDto): void {
    if (!confirm(`Delete "${row.firstName} ${row.lastName}"?`)) return;
    this.api.delete(row.id).subscribe({
      next: () => {
        this.snack.open('Lead deleted.', 'Close', { duration: 2500 });
        const next = this.dataSource.data.filter(l => l.id !== row.id);
        this.dataSource.data = next;
        this.leads$.set(next);
      },
      error: err => this.snack.open(err?.error?.error ?? 'Delete failed.', 'Close', { duration: 3500 }),
    });
  }

  getStatusClass(s: string) {
    return {
      'status-new': s==='New', 'status-contacted': s==='Contacted',
      'status-qualified': s==='Qualified', 'status-unqualified': s==='Unqualified',
      'status-converted': s==='Converted',
    };
  }
  getScoreClass(n: number)    { return n>=75 ? 'score-high' : n>=50 ? 'score-mid' : 'score-low'; }
  getScoreBarClass(n: number) { return n>=75 ? 'bar-success' : n>=50 ? 'bar-warn' : 'bar-danger'; }
  getAvatarColor(name: string) {
    const c = ['#1a73e8','#0d9488','#7c3aed','#ea580c','#db2777','#16a34a'];
    return c[(name?.charCodeAt(0) ?? 0) % c.length];
  }
}
```

- [ ] **Step 2: Commit**

```
git add src/app/pages/crm/leads/lead-list/lead-list.component.ts
git commit -m "feat: wire lead-list to real API with signals, live KPIs, and actions"
```

---

### Task 8: lead-form component + route update

**Files:**
- Create: `src/app/pages/crm/leads/lead-form/lead-form.component.ts`
- Modify: `src/app/pages/crm/crm.routes.ts`

- [ ] **Step 1: Create lead-form component**

```typescript
// src/app/pages/crm/leads/lead-form/lead-form.component.ts
import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { LeadsService, LeadWriteBody } from '../../../../core/services/leads.service';
import { LeadStatus, LeadSource } from '../../../../core/models/crm.models';

@Component({
  selector: 'app-lead-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatSnackBarModule, MatDividerModule,
  ],
  template: `
    <div class="page-header m-b-24 d-flex align-items-center gap-8">
      <a mat-icon-button routerLink="/crm/leads"><mat-icon>arrow_back</mat-icon></a>
      <h2 class="f-s-24 f-w-700 m-0">{{ isNew() ? 'New Lead' : 'Edit Lead' }}</h2>
    </div>

    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-card class="cardWithShadow m-b-24">
        <mat-card-content class="p-24">
          <mat-card-title class="m-b-16">Contact Details</mat-card-title>
          <div class="row">
            <div class="col-md-4 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>First Name</mat-label>
                <input matInput formControlName="firstName" />
              </mat-form-field>
            </div>
            <div class="col-md-4 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Last Name</mat-label>
                <input matInput formControlName="lastName" />
              </mat-form-field>
            </div>
            <div class="col-md-4 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Email</mat-label>
                <input matInput type="email" formControlName="email" />
              </mat-form-field>
            </div>
            <div class="col-md-4 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Phone</mat-label>
                <input matInput formControlName="phone" />
              </mat-form-field>
            </div>
            <div class="col-md-4 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Company</mat-label>
                <input matInput formControlName="company" />
              </mat-form-field>
            </div>
            <div class="col-md-4 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Job Title</mat-label>
                <input matInput formControlName="jobTitle" />
              </mat-form-field>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="cardWithShadow m-b-24">
        <mat-card-content class="p-24">
          <mat-card-title class="m-b-16">Lead Details</mat-card-title>
          <div class="row">
            <div class="col-md-3 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Status</mat-label>
                <mat-select formControlName="status">
                  <mat-option value="New">New</mat-option>
                  <mat-option value="Contacted">Contacted</mat-option>
                  <mat-option value="Qualified">Qualified</mat-option>
                  <mat-option value="Unqualified">Unqualified</mat-option>
                  <mat-option value="Converted">Converted</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
            <div class="col-md-3 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Source</mat-label>
                <mat-select formControlName="source">
                  <mat-option value="Website">Website</mat-option>
                  <mat-option value="Referral">Referral</mat-option>
                  <mat-option value="SocialMedia">Social Media</mat-option>
                  <mat-option value="EmailCampaign">Email Campaign</mat-option>
                  <mat-option value="TradeShow">Trade Show</mat-option>
                  <mat-option value="ColdCall">Cold Call</mat-option>
                  <mat-option value="Partner">Partner</mat-option>
                  <mat-option value="Other">Other</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
            <div class="col-md-3 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Score (0-100)</mat-label>
                <input matInput type="number" min="0" max="100" formControlName="score" />
              </mat-form-field>
            </div>
            <div class="col-md-3 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Est. Value (USD)</mat-label>
                <input matInput type="number" min="0" formControlName="estimatedValue" />
              </mat-form-field>
            </div>
            <div class="col-md-6 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Assigned To</mat-label>
                <input matInput formControlName="assignedTo" placeholder="Agent name" />
              </mat-form-field>
            </div>
            <div class="col-md-6 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Tags (comma-separated)</mat-label>
                <input matInput formControlName="tagsRaw" placeholder="Europe, VIP" />
              </mat-form-field>
            </div>
            <div class="col-md-12 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Notes</mat-label>
                <textarea matInput formControlName="notes" rows="3"></textarea>
              </mat-form-field>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="cardWithShadow">
        <mat-card-content class="p-24">
          <mat-divider class="m-b-16"></mat-divider>
          <div class="d-flex justify-content-end gap-8">
            <a mat-stroked-button routerLink="/crm/leads">Cancel</a>
            <button mat-flat-button color="primary" type="submit"
                    [disabled]="form.invalid || saving()">
              <mat-icon>save</mat-icon>
              {{ saving() ? 'Saving...' : (isNew() ? 'Create' : 'Save Changes') }}
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    </form>
  `,
})
export class LeadFormComponent implements OnInit {
  private readonly fb     = inject(FormBuilder);
  private readonly api    = inject(LeadsService);
  private readonly snack  = inject(MatSnackBar);
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly saving = signal(false);
  readonly isNew  = signal(true);

  form = this.fb.group({
    firstName:      ['', [Validators.required, Validators.maxLength(100)]],
    lastName:       ['', [Validators.required, Validators.maxLength(100)]],
    email:          ['', [Validators.required, Validators.email]],
    phone:          [''],
    company:        [''],
    jobTitle:       [''],
    status:         ['New' as LeadStatus, Validators.required],
    source:         ['Website' as LeadSource, Validators.required],
    score:          [50, [Validators.required, Validators.min(0), Validators.max(100)]],
    assignedTo:     [''],
    tagsRaw:        [''],
    notes:          [''],
    estimatedValue: [null as number | null],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isNew.set(false);
      this.api.get(id).subscribe({
        next: r => {
          this.form.patchValue({
            firstName: r.firstName, lastName: r.lastName, email: r.email,
            phone: r.phone, company: r.company, jobTitle: r.jobTitle,
            status: r.status as LeadStatus,
            // Map display strings back to enum names for the select options
            source: this.displayToSource(r.source),
            score: r.score, assignedTo: r.assignedTo,
            tagsRaw: r.tags.join(', '),
            notes: r.notes,
            estimatedValue: r.estimatedValue ?? null,
          });
        },
        error: err => {
          this.snack.open(err?.error?.error ?? 'Failed to load lead.', 'Close', { duration: 3500 });
          this.router.navigate(['/crm/leads']);
        },
      });
    }
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    const body: LeadWriteBody = {
      firstName:      v.firstName!,
      lastName:       v.lastName!,
      email:          v.email!,
      phone:          v.phone ?? '',
      company:        v.company ?? '',
      jobTitle:       v.jobTitle ?? '',
      status:         v.status as LeadStatus,
      source:         v.source as LeadSource,
      score:          v.score ?? 50,
      assignedTo:     v.assignedTo ?? '',
      tags:           v.tagsRaw ? v.tagsRaw.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0) : [],
      notes:          v.notes ?? '',
      estimatedValue: v.estimatedValue ?? undefined,
    };

    const id = this.route.snapshot.paramMap.get('id');
    const call$ = (id && id !== 'new') ? this.api.update(id, body) : this.api.create(body);

    call$.subscribe({
      next: () => {
        this.saving.set(false);
        this.snack.open('Lead saved.', 'Close', { duration: 2500 });
        this.router.navigate(['/crm/leads']);
      },
      error: err => {
        this.saving.set(false);
        this.snack.open(err?.error?.error ?? 'Save failed.', 'Close', { duration: 3500 });
      },
    });
  }

  // Map display strings from the API back to enum names for the select
  private displayToSource(display: string): LeadSource {
    const map: Record<string, LeadSource> = {
      'Social Media': 'Social Media', 'Email Campaign': 'Email Campaign',
      'Trade Show': 'Trade Show',     'Cold Call': 'Cold Call',
    };
    return (map[display] ?? display) as LeadSource;
  }
}
```

**Note on source round-trip:** The API DTO returns display strings (`"Social Media"` etc.) while form `<mat-option>` values use enum names (`"SocialMedia"` etc.). The `displayToSource` helper in `ngOnInit` maps them back, and the form submits the enum name to the API. The C# command handler parses `LeadSource` by name (case-insensitive by the ASP.NET Core default JSON binder), so `"SocialMedia"` correctly maps to `LeadSource.SocialMedia`.

- [ ] **Step 2: Add form routes to crm.routes.ts**

In `src/app/pages/crm/crm.routes.ts`, insert these two routes **after** the `leads` list route and **before** `companies`:

```typescript
{
  path: 'leads/new',
  loadComponent: () =>
    import('./leads/lead-form/lead-form.component').then((m) => m.LeadFormComponent),
  data: { title: 'New Lead', breadcrumb: 'New Lead' },
},
{
  path: 'leads/:id',
  loadComponent: () =>
    import('./leads/lead-form/lead-form.component').then((m) => m.LeadFormComponent),
  data: { title: 'Edit Lead', breadcrumb: 'Edit Lead' },
},
```

`leads/new` **must** appear before `leads/:id` so the literal string `new` is not captured by the param.

- [ ] **Step 3: Angular build check**

```
cd D:\ClaudeProjects\TravelCRMPlus
npx ng build --configuration development
```

Expected: Build succeeded — only the pre-existing Sass deprecation warnings, zero errors.

- [ ] **Step 4: Commit**

```
git add src/app/pages/crm/leads/ src/app/pages/crm/crm.routes.ts
git commit -m "feat: add lead-form component and CRM routes for add/edit"
```

---

### Task 9: Apply migration + smoke test

- [ ] **Step 1: Apply EF migration**

```
cd D:\ClaudeProjects\TravelCRMPlus\TravelCrm.Api
dotnet ef database update
```

Expected: `Applying migration '..._AddLeads'` → `Done.`

- [ ] **Step 2: Run full test suite**

```
cd D:\ClaudeProjects\TravelCRMPlus
dotnet test TravelCrm.Tests
```

Expected: All 48 tests PASS (36 pre-existing + 4 query + 8 command).

- [ ] **Step 3: Manual smoke test**
  - Open `http://localhost:4200/crm/leads` — page loads (empty, no mock data)
  - Click **Add Lead** → navigates to `/crm/leads/new`
  - Fill required fields (First Name, Last Name, Email), set Score — click **Create**
  - Redirected to list; new lead appears; KPI counts update reactively
  - Click **Edit** from row menu → form pre-populated with lead data
  - Change status to Qualified, click **Save Changes** → list reflects update
  - Click **Convert** → status changes to Converted; Convert button disabled
  - Click **Delete** → row removed from list

- [ ] **Step 4: Final commit**

```
git add -A
git commit -m "chore: apply AddLeads migration — Lead Management module complete"
```
