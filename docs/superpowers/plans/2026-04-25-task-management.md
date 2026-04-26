# Task Management Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a tenant-scoped task management module with assignments, multi-level subtasks, time tracking, kanban board, and overdue notifications.

**Architecture:** Single-project ASP.NET Core 8 API with MediatR CQRS handlers (one feature per file: command + validator + handler), EF Core 8 + PostgreSQL with snake_case naming, Hangfire daily job for overdue detection. Angular 21 standalone components using signals and `OnPush`, replacing existing `apps/todo` and `apps/kanban` mock pages.

**Tech Stack:** ASP.NET Core 8, MediatR 12, EF Core 8, PostgreSQL, FluentValidation, Hangfire, xUnit + FluentAssertions (no Moq, hand-rolled fakes); Angular 21, Angular Material, CDK drag-drop, Iconify Solar icons.

**Reference spec:** `docs/superpowers/specs/2026-04-25-task-management-design.md`

---

## File Map

### Backend — files to create

```
TravelCrm.Api/Domain/Entities/TenantTaskStatus.cs                            (new enum)
TravelCrm.Api/Domain/Entities/TenantTaskPriority.cs                          (new enum)
TravelCrm.Api/Domain/Entities/TaskType.cs                              (new entity)
TravelCrm.Api/Domain/Entities/TenantTask.cs                            (new entity)
TravelCrm.Api/Domain/Entities/TimeEntry.cs                             (new entity)

TravelCrm.Api/Features/Tasks/TaskDto.cs                                (DTO + mapper)
TravelCrm.Api/Features/Tasks/Queries/ListTasksQuery.cs                 (query + handler)
TravelCrm.Api/Features/Tasks/Queries/GetTaskQuery.cs                   (query + handler)
TravelCrm.Api/Features/Tasks/Commands/CreateTaskCommand.cs             (command + validator + handler)
TravelCrm.Api/Features/Tasks/Commands/UpdateTaskCommand.cs             (command + validator + handler)
TravelCrm.Api/Features/Tasks/Commands/UpdateTaskStatusCommand.cs       (command + validator + handler)
TravelCrm.Api/Features/Tasks/Commands/DeleteTaskCommand.cs             (command + handler)
TravelCrm.Api/Features/Tasks/Commands/RestoreTaskCommand.cs            (command + handler)
TravelCrm.Api/Features/Tasks/TasksController.cs                        (controller)

TravelCrm.Api/Features/TaskTypes/TaskTypeDto.cs                        (DTO + mapper)
TravelCrm.Api/Features/TaskTypes/Queries/ListTaskTypesQuery.cs         (query + handler)
TravelCrm.Api/Features/TaskTypes/Commands/CreateTaskTypeCommand.cs     (command + validator + handler)
TravelCrm.Api/Features/TaskTypes/Commands/UpdateTaskTypeCommand.cs     (command + validator + handler)
TravelCrm.Api/Features/TaskTypes/Commands/DeleteTaskTypeCommand.cs     (command + handler)
TravelCrm.Api/Features/TaskTypes/TaskTypesController.cs                (controller)

TravelCrm.Api/Features/TimeEntries/TimeEntryDto.cs                     (DTO + mapper)
TravelCrm.Api/Features/TimeEntries/Queries/ListTimeEntriesQuery.cs     (query + handler)
TravelCrm.Api/Features/TimeEntries/Commands/LogTimeCommand.cs          (command + validator + handler)
TravelCrm.Api/Features/TimeEntries/Commands/DeleteTimeEntryCommand.cs  (command + handler)
TravelCrm.Api/Features/TimeEntries/TimeEntriesController.cs            (controller)

TravelCrm.Api/Infrastructure/Jobs/OverdueTasksJob.cs                   (Hangfire recurring job)

TravelCrm.Tests/Tasks/TaskCommandHandlersTests.cs                      (new test file)
TravelCrm.Tests/Tasks/TaskQueryHandlersTests.cs                        (new test file)
TravelCrm.Tests/TaskTypes/TaskTypeHandlersTests.cs                     (new test file)
TravelCrm.Tests/TimeEntries/TimeEntryHandlersTests.cs                  (new test file)
```

### Backend — files to modify

```
TravelCrm.Api/Infrastructure/Persistence/ApplicationDbContext.cs       (add 3 DbSets + OnModelCreating config)
TravelCrm.Api/Infrastructure/Jobs/RecurringJobRegistrar.cs             (register OverdueTasksJob)
TravelCrm.Api/Program.cs                                               (register OverdueTasksJob in DI)
```

### Frontend — files to create

```
src/app/models/task.model.ts                                           (TS interfaces + types)
src/app/core/services/tasks.service.ts                                 (HTTP service)
src/app/core/services/task-types.service.ts                            (HTTP service)
src/app/core/services/time-entries.service.ts                          (HTTP service)

src/app/pages/apps/task/task-list/task-list.component.ts               (list page with side drawer)
src/app/pages/apps/task/task-kanban/task-kanban.component.ts           (kanban with CDK drag-drop)
src/app/pages/apps/task/task-form/task-form.component.ts               (create/edit form)
src/app/pages/apps/task/task-detail/task-detail.component.ts           (drawer body: subtasks + time log)

src/app/pages/settings/task-types/task-types.component.ts              (settings page)
```

### Frontend — files to modify

```
src/app/pages/apps/apps.routes.ts                                      (add task routes, repoint kanban)
src/app/app.routes.ts                                                  (add settings route group if missing)
src/app/layouts/full/vertical/sidebar/sidebar-data.ts                  (point apps/todo → apps/task; add Task Types)
```

### EF migration

```
TravelCrm.Api/Migrations/<timestamp>_AddTaskManagement.cs              (generated)
```

---

## Common Commands Reference

```bash
# Build the API
dotnet build TravelCrm.Api

# Run tests (filter by namespace)
dotnet test TravelCrm.Tests --filter "FullyQualifiedName~Tasks" -v minimal
dotnet test TravelCrm.Tests --filter "FullyQualifiedName~TaskTypes" -v minimal
dotnet test TravelCrm.Tests --filter "FullyQualifiedName~TimeEntries" -v minimal

# EF migration (run from TravelCrm.Api/)
cd TravelCrm.Api
dotnet ef migrations add AddTaskManagement
dotnet ef database update

# Angular build / test
npx ng build --configuration development
npx ng test --watch=false --browsers=ChromeHeadless
```

---

## Task 1: Domain Entities and Enums

**Files:**
- Create: `TravelCrm.Api/Domain/Entities/TenantTaskStatus.cs`
- Create: `TravelCrm.Api/Domain/Entities/TenantTaskPriority.cs`
- Create: `TravelCrm.Api/Domain/Entities/TaskType.cs`
- Create: `TravelCrm.Api/Domain/Entities/TenantTask.cs`
- Create: `TravelCrm.Api/Domain/Entities/TimeEntry.cs`

> ⚠️ The C# entity for tasks is **TenantTask**, NOT `Task`, to avoid the name conflict with `System.Threading.Tasks.Task`. The DbSet is `TenantTasks`. Tables in PostgreSQL will be `tenant_tasks`, `task_types`, `time_entries`.

- [ ] **Step 1: Create `TenantTaskStatus.cs`**

```csharp
namespace TravelCrm.Api.Domain.Entities;

public enum TenantTaskStatus
{
    ToDo = 0,
    InProgress = 1,
    Done = 2,
}
```

- [ ] **Step 2: Create `TenantTaskPriority.cs`**

```csharp
namespace TravelCrm.Api.Domain.Entities;

public enum TenantTaskPriority
{
    Low = 0,
    Medium = 1,
    High = 2,
    Urgent = 3,
}
```

- [ ] **Step 3: Create `TaskType.cs`**

```csharp
namespace TravelCrm.Api.Domain.Entities;

public sealed class TaskType : BaseEntity
{
    public string Name { get; set; } = "";
    public string Color { get; set; } = "#3B82F6";
    public bool IsActive { get; set; } = true;
}
```

- [ ] **Step 4: Create `TenantTask.cs`**

```csharp
namespace TravelCrm.Api.Domain.Entities;

public sealed class TenantTask : BaseEntity
{
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public TenantTaskStatus Status { get; set; } = TenantTaskStatus.ToDo;
    public TenantTaskPriority Priority { get; set; } = TenantTaskPriority.Medium;
    public Guid? TaskTypeId { get; set; }
    public Guid? AssignedToUserId { get; set; }
    public Guid CreatedByUserId { get; set; }
    public Guid? ParentTaskId { get; set; }
    public DateTime? DueDate { get; set; }
    public int? EstimatedMinutes { get; set; }
    public bool IsDeleted { get; set; }
    public bool IsOverdueSent { get; set; }

    // Navigation properties
    public TaskType? TaskType { get; set; }
    public TenantTask? Parent { get; set; }
    public ICollection<TenantTask> Children { get; set; } = new List<TenantTask>();
    public ICollection<TimeEntry> TimeEntries { get; set; } = new List<TimeEntry>();
}
```

- [ ] **Step 5: Create `TimeEntry.cs`**

```csharp
namespace TravelCrm.Api.Domain.Entities;

public sealed class TimeEntry : BaseEntity
{
    public Guid TaskId { get; set; }
    public Guid UserId { get; set; }
    public int Minutes { get; set; }
    public string? Notes { get; set; }
    public DateTime LoggedAt { get; set; }

    // Navigation
    public TenantTask? Task { get; set; }
}
```

- [ ] **Step 6: Verify build**

Run: `dotnet build TravelCrm.Api`
Expected: Build succeeds. (Compiler may warn about `TenantTaskStatus` shadowing `System.Threading.Tasks.TenantTaskStatus` — that's fine; we'll alias on a per-file basis when needed in handlers.)

- [ ] **Step 7: Commit**

```bash
git add TravelCrm.Api/Domain/Entities/TenantTaskStatus.cs \
        TravelCrm.Api/Domain/Entities/TenantTaskPriority.cs \
        TravelCrm.Api/Domain/Entities/TaskType.cs \
        TravelCrm.Api/Domain/Entities/TenantTask.cs \
        TravelCrm.Api/Domain/Entities/TimeEntry.cs
git commit -m "feat(tasks): add TenantTask, TaskType, TimeEntry domain entities"
```

---

## Task 2: DbContext + EF Migration

**Files:**
- Modify: `TravelCrm.Api/Infrastructure/Persistence/ApplicationDbContext.cs`
- Generated: `TravelCrm.Api/Migrations/<timestamp>_AddTaskManagement.cs`

- [ ] **Step 1: Add DbSets to `ApplicationDbContext.cs`**

Find the existing DbSet declarations (e.g. `public DbSet<Lead> Leads => Set<Lead>();`) and add three new DbSets next to them:

```csharp
public DbSet<TenantTask> TenantTasks => Set<TenantTask>();
public DbSet<TaskType> TaskTypes => Set<TaskType>();
public DbSet<TimeEntry> TimeEntries => Set<TimeEntry>();
```

- [ ] **Step 2: Add `OnModelCreating` configuration**

In `OnModelCreating(ModelBuilder modelBuilder)`, after `base.OnModelCreating(modelBuilder)` and the existing entity configs, add:

```csharp
modelBuilder.Entity<TenantTask>(b =>
{
    b.Property(t => t.Title).IsRequired().HasMaxLength(200);
    b.Property(t => t.Description).HasMaxLength(4000);
    b.Property(t => t.Status).HasConversion<int>();
    b.Property(t => t.Priority).HasConversion<int>();

    b.HasOne(t => t.Parent)
        .WithMany(t => t.Children)
        .HasForeignKey(t => t.ParentTaskId)
        .OnDelete(DeleteBehavior.Restrict);

    b.HasOne(t => t.TaskType)
        .WithMany()
        .HasForeignKey(t => t.TaskTypeId)
        .OnDelete(DeleteBehavior.SetNull);

    b.HasMany(t => t.TimeEntries)
        .WithOne(te => te.Task)
        .HasForeignKey(te => te.TaskId)
        .OnDelete(DeleteBehavior.Cascade);

    b.HasIndex(t => new { t.TenantId, t.Status });
    b.HasIndex(t => new { t.TenantId, t.AssignedToUserId });
    b.HasIndex(t => new { t.TenantId, t.IsDeleted });
});

modelBuilder.Entity<TaskType>(b =>
{
    b.Property(t => t.Name).IsRequired().HasMaxLength(100);
    b.Property(t => t.Color).IsRequired().HasMaxLength(7);
    b.HasIndex(t => new { t.TenantId, t.Name }).IsUnique();
});

modelBuilder.Entity<TimeEntry>(b =>
{
    b.Property(t => t.Notes).HasMaxLength(500);
    b.HasIndex(t => new { t.TenantId, t.TaskId });
});
```

- [ ] **Step 3: Verify build**

Run: `dotnet build TravelCrm.Api`
Expected: Build succeeds, no warnings about `TenantTask` config.

- [ ] **Step 4: Create EF migration**

Run from project root:
```bash
cd TravelCrm.Api
dotnet ef migrations add AddTaskManagement
```
Expected: New file appears at `TravelCrm.Api/Migrations/<timestamp>_AddTaskManagement.cs` with `CreateTable("tenant_tasks", ...)`, `CreateTable("task_types", ...)`, `CreateTable("time_entries", ...)`.

- [ ] **Step 5: Inspect the migration file**

Open `TravelCrm.Api/Migrations/<timestamp>_AddTaskManagement.cs`. Verify:
- `tenant_tasks` table has `parent_task_id` self-referencing FK with `OnDelete: ReferentialAction.Restrict`
- `time_entries` has `task_id` FK with `OnDelete: ReferentialAction.Cascade`
- Snake_case naming applied (e.g. `created_at`, `is_deleted`, `is_overdue_sent`)
- Indexes created: `ix_tenant_tasks_tenant_id_status`, `ix_tenant_tasks_tenant_id_assigned_to_user_id`, `ix_tenant_tasks_tenant_id_is_deleted`, `ix_task_types_tenant_id_name` (unique)

If anything looks wrong, delete the migration files (`*.Designer.cs` and the migration `.cs`), fix the entity/config, and re-run `dotnet ef migrations add`.

- [ ] **Step 6: Apply migration**

```bash
dotnet ef database update
```
Expected: `Done.` Tables exist in PostgreSQL.

- [ ] **Step 7: Commit**

```bash
git add TravelCrm.Api/Infrastructure/Persistence/ApplicationDbContext.cs \
        TravelCrm.Api/Migrations/
git commit -m "feat(tasks): add EF migration for task management tables"
```

---

## Task 3: Shared DTOs and Mappers

**Files:**
- Create: `TravelCrm.Api/Features/Tasks/TaskDto.cs`
- Create: `TravelCrm.Api/Features/TaskTypes/TaskTypeDto.cs`
- Create: `TravelCrm.Api/Features/TimeEntries/TimeEntryDto.cs`

> **Deviation from spec:** the spec defines `ListTasksQuery` returning `PagedResult<TaskDto>`. We simplify v1 to return a flat `List<TaskDto>` matching the existing `LeadsController.list()` pattern (no existing pagination infrastructure in the codebase). Pagination can be added later by introducing `Common/PagedResult.cs` and updating handler return types.

- [ ] **Step 1: Create `TaskDto.cs`**

```csharp
using TravelCrm.Api.Domain.Entities;

namespace TravelCrm.Api.Features.Tasks;

public sealed record TaskDto(
    Guid Id,
    string Title,
    string? Description,
    string Status,
    string Priority,
    Guid? TaskTypeId,
    string? TaskTypeName,
    string? TaskTypeColor,
    Guid? AssignedToUserId,
    string? AssignedToUserName,
    Guid CreatedByUserId,
    string CreatedByUserName,
    Guid? ParentTaskId,
    DateTime? DueDate,
    int? EstimatedMinutes,
    int TotalLoggedMinutes,
    bool IsOverdue,
    bool IsDeleted,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    List<TaskDto> Children
);

public static class TaskMapper
{
    public static TaskDto ToDto(TenantTask task, string? assignedToUserName = null, bool includeChildren = false)
    {
        var totalMinutes = task.TimeEntries?.Sum(te => te.Minutes) ?? 0;
        var isOverdue = task.DueDate.HasValue
            && task.DueDate.Value < DateTime.UtcNow
            && task.Status != TenantTaskStatus.Done;

        return new TaskDto(
            task.Id,
            task.Title,
            task.Description,
            task.Status.ToString(),
            task.Priority.ToString(),
            task.TaskTypeId,
            task.TaskType?.Name,
            task.TaskType?.Color,
            task.AssignedToUserId,
            assignedToUserName,
            task.CreatedByUserId,
            task.CreatedBy ?? "",
            task.ParentTaskId,
            task.DueDate,
            task.EstimatedMinutes,
            totalMinutes,
            isOverdue,
            task.IsDeleted,
            task.CreatedAt,
            task.UpdatedAt,
            includeChildren && task.Children != null && task.Children.Any()
                ? task.Children.Select(c => ToDto(c, includeChildren: true)).ToList()
                : new List<TaskDto>()
        );
    }
}
```

- [ ] **Step 2: Create `TaskTypeDto.cs`**

```csharp
using TravelCrm.Api.Domain.Entities;

namespace TravelCrm.Api.Features.TaskTypes;

public sealed record TaskTypeDto(Guid Id, string Name, string Color, bool IsActive);

public static class TaskTypeMapper
{
    public static TaskTypeDto ToDto(TaskType t) => new(t.Id, t.Name, t.Color, t.IsActive);
}
```

- [ ] **Step 3: Create `TimeEntryDto.cs`**

```csharp
using TravelCrm.Api.Domain.Entities;

namespace TravelCrm.Api.Features.TimeEntries;

public sealed record TimeEntryDto(
    Guid Id,
    Guid TaskId,
    Guid UserId,
    string UserName,
    int Minutes,
    string? Notes,
    DateTime LoggedAt
);

public static class TimeEntryMapper
{
    public static TimeEntryDto ToDto(TimeEntry te, string? userName = null) =>
        new(te.Id, te.TaskId, te.UserId, userName ?? te.CreatedBy ?? "", te.Minutes, te.Notes, te.LoggedAt);
}
```

- [ ] **Step 4: Verify build**

Run: `dotnet build TravelCrm.Api`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add TravelCrm.Api/Features/Tasks/TaskDto.cs \
        TravelCrm.Api/Features/TaskTypes/TaskTypeDto.cs \
        TravelCrm.Api/Features/TimeEntries/TimeEntryDto.cs
git commit -m "feat(tasks): add task DTOs and mappers"
```

---

## Task 4: ListTasks and GetTask Queries + Tests

**Files:**
- Create: `TravelCrm.Api/Features/Tasks/Queries/ListTasksQuery.cs`
- Create: `TravelCrm.Api/Features/Tasks/Queries/GetTaskQuery.cs`
- Create: `TravelCrm.Tests/Tasks/TaskQueryHandlersTests.cs`

- [ ] **Step 1: Write the failing test file `TaskQueryHandlersTests.cs`**

```csharp
using FluentAssertions;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Tasks.Queries;

namespace TravelCrm.Tests.Tasks;

public class TaskQueryHandlersTests
{
    [Fact]
    public async Task ListTasks_FiltersByTenantAndExcludesDeleted_ByDefault()
    {
        var (db, tenant, tenantId) = TestDb.New();
        var otherTenantId = Guid.NewGuid();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);

        db.TenantTasks.Add(new TenantTask
        {
            Id = Guid.NewGuid(), TenantId = tenantId, Title = "Mine",
            Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Medium,
            CreatedByUserId = user.Id, IsDeleted = false,
        });
        db.TenantTasks.Add(new TenantTask
        {
            Id = Guid.NewGuid(), TenantId = tenantId, Title = "Trashed",
            Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Medium,
            CreatedByUserId = user.Id, IsDeleted = true,
        });
        db.TenantTasks.Add(new TenantTask
        {
            Id = Guid.NewGuid(), TenantId = otherTenantId, Title = "Other tenant",
            Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Medium,
            CreatedByUserId = user.Id, IsDeleted = false,
        });
        await db.SaveChangesAsync();

        var handler = new ListTasksHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(
            new ListTasksQuery(null, null, null, null, null, IncludeDeleted: false), default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Should().HaveCount(1);
        result.Value!.Single().Title.Should().Be("Mine");
    }

    [Fact]
    public async Task ListTasks_WithIncludeDeleted_ReturnsDeletedTasks()
    {
        var (db, tenant, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);

        db.TenantTasks.Add(new TenantTask
        {
            Id = Guid.NewGuid(), TenantId = tenantId, Title = "Active",
            Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Medium,
            CreatedByUserId = user.Id, IsDeleted = false,
        });
        db.TenantTasks.Add(new TenantTask
        {
            Id = Guid.NewGuid(), TenantId = tenantId, Title = "Trashed",
            Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Medium,
            CreatedByUserId = user.Id, IsDeleted = true,
        });
        await db.SaveChangesAsync();

        var handler = new ListTasksHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(
            new ListTasksQuery(null, null, null, null, null, IncludeDeleted: true), default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Should().HaveCount(2);
    }

    [Fact]
    public async Task ListTasks_WithoutPermission_ReturnsForbidden()
    {
        var (db, tenant, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: false);

        var handler = new ListTasksHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(
            new ListTasksQuery(null, null, null, null, null, false), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("Forbidden");
    }

    [Fact]
    public async Task GetTask_LoadsSubtaskTree()
    {
        var (db, tenant, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);

        var parentId = Guid.NewGuid();
        db.TenantTasks.Add(new TenantTask
        {
            Id = parentId, TenantId = tenantId, Title = "Parent",
            Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Medium, CreatedByUserId = user.Id,
        });
        db.TenantTasks.Add(new TenantTask
        {
            Id = Guid.NewGuid(), TenantId = tenantId, Title = "Child",
            Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Medium,
            CreatedByUserId = user.Id, ParentTaskId = parentId,
        });
        await db.SaveChangesAsync();

        var handler = new GetTaskHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new GetTaskQuery(parentId), default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Children.Should().HaveCount(1);
        result.Value!.Children.Single().Title.Should().Be("Child");
    }

    [Fact]
    public async Task GetTask_FromOtherTenant_ReturnsNotFound()
    {
        var (db, tenant, tenantId) = TestDb.New();
        var otherTenantId = Guid.NewGuid();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var taskId = Guid.NewGuid();

        db.TenantTasks.Add(new TenantTask
        {
            Id = taskId, TenantId = otherTenantId, Title = "Not yours",
            Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Medium, CreatedByUserId = user.Id,
        });
        await db.SaveChangesAsync();

        var handler = new GetTaskHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new GetTaskQuery(taskId), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("not found");
    }
}
```

- [ ] **Step 2: Run tests to verify they fail (compile error is fine)**

Run: `dotnet test TravelCrm.Tests --filter "FullyQualifiedName~TaskQueryHandlersTests"`
Expected: Build error, `ListTasksQuery / ListTasksHandler / GetTaskQuery / GetTaskHandler` not defined.

- [ ] **Step 3: Create `ListTasksQuery.cs`**

```csharp
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;
using TravelCrm.Api.Infrastructure.Security;

namespace TravelCrm.Api.Features.Tasks.Queries;

public sealed record ListTasksQuery(
    string? Search,
    string? Status,
    string? Priority,
    Guid? AssignedToUserId,
    Guid? TaskTypeId,
    bool IncludeDeleted
) : IRequest<Result<List<TaskDto>>>;

public sealed class ListTasksHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<ListTasksQuery, Result<List<TaskDto>>>
{
    public async Task<Result<List<TaskDto>>> Handle(ListTasksQuery q, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.tasks.view"))
            return Result.Failure<List<TaskDto>>("Forbidden");

        if (!tenantContext.IsResolved)
            return Result.Failure<List<TaskDto>>("Tenant not resolved");

        var query = db.TenantTasks
            .Include(t => t.TaskType)
            .Include(t => t.TimeEntries)
            .Where(t => t.TenantId == tenantContext.TenantId);

        if (!q.IncludeDeleted)
            query = query.Where(t => !t.IsDeleted);

        if (!string.IsNullOrWhiteSpace(q.Search))
            query = query.Where(t => EF.Functions.ILike(t.Title, $"%{q.Search}%"));

        if (!string.IsNullOrWhiteSpace(q.Status)
            && Enum.TryParse<TenantTaskStatus>(q.Status, ignoreCase: true, out var status))
            query = query.Where(t => t.Status == status);

        if (!string.IsNullOrWhiteSpace(q.Priority)
            && Enum.TryParse<TenantTaskPriority>(q.Priority, ignoreCase: true, out var priority))
            query = query.Where(t => t.Priority == priority);

        if (q.AssignedToUserId.HasValue)
            query = query.Where(t => t.AssignedToUserId == q.AssignedToUserId.Value);

        if (q.TaskTypeId.HasValue)
            query = query.Where(t => t.TaskTypeId == q.TaskTypeId.Value);

        var tasks = await query
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync(ct);

        var dtos = tasks.Select(t => TaskMapper.ToDto(t)).ToList();
        return Result.Success(dtos);
    }
}
```

> Note: Adjust the `using` namespaces for `Result`, `ITenantContext`, `ICurrentUser`, and `ApplicationDbContext` if your project uses different folder names. Check `Features/Leads/Queries/ListLeadsQuery.cs` for the exact namespace pattern.

- [ ] **Step 4: Create `GetTaskQuery.cs`**

```csharp
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;
using TravelCrm.Api.Infrastructure.Security;

namespace TravelCrm.Api.Features.Tasks.Queries;

public sealed record GetTaskQuery(Guid Id) : IRequest<Result<TaskDto>>;

public sealed class GetTaskHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<GetTaskQuery, Result<TaskDto>>
{
    public async Task<Result<TaskDto>> Handle(GetTaskQuery q, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.tasks.view"))
            return Result.Failure<TaskDto>("Forbidden");

        if (!tenantContext.IsResolved)
            return Result.Failure<TaskDto>("Tenant not resolved");

        // Eager-load 3 levels of subtasks (sufficient for typical use)
        var task = await db.TenantTasks
            .Include(t => t.TaskType)
            .Include(t => t.TimeEntries)
            .Include(t => t.Children).ThenInclude(c => c.TaskType)
            .Include(t => t.Children).ThenInclude(c => c.TimeEntries)
            .Include(t => t.Children).ThenInclude(c => c.Children).ThenInclude(gc => gc.TaskType)
            .Include(t => t.Children).ThenInclude(c => c.Children).ThenInclude(gc => gc.TimeEntries)
            .FirstOrDefaultAsync(t => t.Id == q.Id && t.TenantId == tenantContext.TenantId, ct);

        if (task is null)
            return Result.Failure<TaskDto>("Task not found");

        return Result.Success(TaskMapper.ToDto(task, includeChildren: true));
    }
}
```

- [ ] **Step 5: Verify build**

Run: `dotnet build TravelCrm.Api`
Expected: Succeeds.

- [ ] **Step 6: Run tests**

Run: `dotnet test TravelCrm.Tests --filter "FullyQualifiedName~TaskQueryHandlersTests" -v minimal`
Expected: All 5 tests pass.

- [ ] **Step 7: Commit**

```bash
git add TravelCrm.Api/Features/Tasks/Queries/ \
        TravelCrm.Tests/Tasks/TaskQueryHandlersTests.cs
git commit -m "feat(tasks): add ListTasks and GetTask query handlers"
```

---

## Task 5: CreateTask Command + Tests

**Files:**
- Create: `TravelCrm.Api/Features/Tasks/Commands/CreateTaskCommand.cs`
- Create: `TravelCrm.Tests/Tasks/TaskCommandHandlersTests.cs`

- [ ] **Step 1: Write failing tests in `TaskCommandHandlersTests.cs`**

```csharp
using FluentAssertions;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Tasks.Commands;

namespace TravelCrm.Tests.Tasks;

public class TaskCommandHandlersTests
{
    private static CreateTaskCommand ValidCreate(string title = "Test task") =>
        new(title, null, "ToDo", "Medium", null, null, null, null, null);

    [Fact]
    public async Task CreateTask_Persists_AndReturnsDto()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var handler = new CreateTaskHandler(db, new FakeTenantContext(tenantId), user);

        var result = await handler.Handle(ValidCreate("New task"), default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Title.Should().Be("New task");
        result.Value!.Status.Should().Be("ToDo");
        result.Value!.Priority.Should().Be("Medium");
        db.TenantTasks.Should().ContainSingle(t => t.Title == "New task" && t.TenantId == tenantId);
    }

    [Fact]
    public async Task CreateTask_WithoutPermission_ReturnsForbidden()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: false);
        var handler = new CreateTaskHandler(db, new FakeTenantContext(tenantId), user);

        var result = await handler.Handle(ValidCreate(), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("Forbidden");
    }

    [Fact]
    public async Task CreateTask_WithAssignee_CreatesNotification()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var assignee = Guid.NewGuid();
        var handler = new CreateTaskHandler(db, new FakeTenantContext(tenantId), user);

        var cmd = ValidCreate("Assigned task") with { AssignedToUserId = assignee };
        var result = await handler.Handle(cmd, default);

        result.IsSuccess.Should().BeTrue();
        db.Notifications.Should().ContainSingle(n =>
            n.UserId == assignee && n.Type == "task_assigned");
    }

    [Fact]
    public async Task CreateTask_AsSubtask_StoresParentId()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var parentId = Guid.NewGuid();
        db.TenantTasks.Add(new TenantTask
        {
            Id = parentId, TenantId = tenantId, Title = "Parent",
            Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Medium, CreatedByUserId = user.Id,
        });
        await db.SaveChangesAsync();

        var handler = new CreateTaskHandler(db, new FakeTenantContext(tenantId), user);
        var cmd = ValidCreate("Sub") with { ParentTaskId = parentId };
        var result = await handler.Handle(cmd, default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.ParentTaskId.Should().Be(parentId);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test TravelCrm.Tests --filter "FullyQualifiedName~TaskCommandHandlersTests"`
Expected: Build error — `CreateTaskCommand`, `CreateTaskHandler` not defined.

- [ ] **Step 3: Create `CreateTaskCommand.cs`**

```csharp
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;
using TravelCrm.Api.Infrastructure.Security;

namespace TravelCrm.Api.Features.Tasks.Commands;

public sealed record CreateTaskCommand(
    string Title,
    string? Description,
    string Status,
    string Priority,
    Guid? TaskTypeId,
    Guid? AssignedToUserId,
    Guid? ParentTaskId,
    DateTime? DueDate,
    int? EstimatedMinutes
) : IRequest<Result<TaskDto>>;

public sealed class CreateTaskValidator : AbstractValidator<CreateTaskCommand>
{
    public CreateTaskValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(4000);
        RuleFor(x => x.Status)
            .Must(s => Enum.TryParse<TenantTaskStatus>(s, ignoreCase: true, out _))
            .WithMessage("Status must be ToDo, InProgress, or Done");
        RuleFor(x => x.Priority)
            .Must(p => Enum.TryParse<TenantTaskPriority>(p, ignoreCase: true, out _))
            .WithMessage("Priority must be Low, Medium, High, or Urgent");
        RuleFor(x => x.EstimatedMinutes)
            .GreaterThan(0).When(x => x.EstimatedMinutes.HasValue);
    }
}

public sealed class CreateTaskHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<CreateTaskCommand, Result<TaskDto>>
{
    public async Task<Result<TaskDto>> Handle(CreateTaskCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.tasks.manage"))
            return Result.Failure<TaskDto>("Forbidden");

        if (!tenantContext.IsResolved)
            return Result.Failure<TaskDto>("Tenant not resolved");

        // If ParentTaskId given, verify it belongs to same tenant
        if (cmd.ParentTaskId.HasValue)
        {
            var parentExists = await db.TenantTasks.AnyAsync(
                t => t.Id == cmd.ParentTaskId.Value
                  && t.TenantId == tenantContext.TenantId
                  && !t.IsDeleted, ct);
            if (!parentExists)
                return Result.Failure<TaskDto>("Parent task not found");
        }

        var task = new TenantTask
        {
            Id = Guid.NewGuid(),
            TenantId = tenantContext.TenantId!.Value,
            Title = cmd.Title,
            Description = cmd.Description,
            Status = Enum.Parse<TenantTaskStatus>(cmd.Status, ignoreCase: true),
            Priority = Enum.Parse<TenantTaskPriority>(cmd.Priority, ignoreCase: true),
            TaskTypeId = cmd.TaskTypeId,
            AssignedToUserId = cmd.AssignedToUserId,
            CreatedByUserId = currentUser.Id,
            ParentTaskId = cmd.ParentTaskId,
            DueDate = cmd.DueDate,
            EstimatedMinutes = cmd.EstimatedMinutes,
            IsDeleted = false,
            IsOverdueSent = false,
        };

        db.TenantTasks.Add(task);

        if (cmd.AssignedToUserId.HasValue && cmd.AssignedToUserId.Value != currentUser.Id)
        {
            db.Notifications.Add(new Notification
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId!.Value,
                UserId = cmd.AssignedToUserId.Value,
                Type = "task_assigned",
                Title = "Task assigned to you",
                Message = $"You've been assigned: {cmd.Title}",
                IsRead = false,
                ActionUrl = $"/apps/task/{task.Id}",
            });
        }

        await db.SaveChangesAsync(ct);

        var created = await db.TenantTasks
            .Include(t => t.TaskType)
            .FirstAsync(t => t.Id == task.Id, ct);

        return Result.Success(TaskMapper.ToDto(created));
    }
}
```

- [ ] **Step 4: Run tests**

Run: `dotnet test TravelCrm.Tests --filter "FullyQualifiedName~TaskCommandHandlersTests" -v minimal`
Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add TravelCrm.Api/Features/Tasks/Commands/CreateTaskCommand.cs \
        TravelCrm.Tests/Tasks/TaskCommandHandlersTests.cs
git commit -m "feat(tasks): add CreateTask command handler with assignment notifications"
```

---

## Task 6: UpdateTask and UpdateTaskStatus Commands + Tests

**Files:**
- Create: `TravelCrm.Api/Features/Tasks/Commands/UpdateTaskCommand.cs`
- Create: `TravelCrm.Api/Features/Tasks/Commands/UpdateTaskStatusCommand.cs`
- Modify: `TravelCrm.Tests/Tasks/TaskCommandHandlersTests.cs` (append tests)

- [ ] **Step 1: Append failing tests to `TaskCommandHandlersTests.cs`**

Add inside the `TaskCommandHandlersTests` class:

```csharp
[Fact]
public async Task UpdateTask_ChangesFields_AndPersists()
{
    var (db, _, tenantId) = TestDb.New();
    var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
    var taskId = Guid.NewGuid();
    db.TenantTasks.Add(new TenantTask
    {
        Id = taskId, TenantId = tenantId, Title = "Old title",
        Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Low, CreatedByUserId = user.Id,
    });
    await db.SaveChangesAsync();

    var handler = new UpdateTaskHandler(db, new FakeTenantContext(tenantId), user);
    var result = await handler.Handle(new UpdateTaskCommand(
        taskId, "New title", "Updated", "InProgress", "High",
        null, null, null, null, 60), default);

    result.IsSuccess.Should().BeTrue();
    var fresh = db.TenantTasks.Find(taskId)!;
    fresh.Title.Should().Be("New title");
    fresh.Status.Should().Be(TenantTaskStatus.InProgress);
    fresh.Priority.Should().Be(TenantTaskPriority.High);
    fresh.EstimatedMinutes.Should().Be(60);
}

[Fact]
public async Task UpdateTask_FromOtherTenant_ReturnsNotFound()
{
    var (db, _, tenantId) = TestDb.New();
    var otherTenantId = Guid.NewGuid();
    var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
    var taskId = Guid.NewGuid();
    db.TenantTasks.Add(new TenantTask
    {
        Id = taskId, TenantId = otherTenantId, Title = "Other",
        Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Medium, CreatedByUserId = user.Id,
    });
    await db.SaveChangesAsync();

    var handler = new UpdateTaskHandler(db, new FakeTenantContext(tenantId), user);
    var result = await handler.Handle(new UpdateTaskCommand(
        taskId, "Hijack", null, "ToDo", "Medium",
        null, null, null, null, null), default);

    result.IsSuccess.Should().BeFalse();
    result.Error.Should().Contain("not found");
}

[Fact]
public async Task UpdateTask_NewAssignee_CreatesNotification()
{
    var (db, _, tenantId) = TestDb.New();
    var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
    var taskId = Guid.NewGuid();
    var newAssignee = Guid.NewGuid();
    db.TenantTasks.Add(new TenantTask
    {
        Id = taskId, TenantId = tenantId, Title = "T",
        Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Medium,
        CreatedByUserId = user.Id, AssignedToUserId = null,
    });
    await db.SaveChangesAsync();

    var handler = new UpdateTaskHandler(db, new FakeTenantContext(tenantId), user);
    await handler.Handle(new UpdateTaskCommand(
        taskId, "T", null, "ToDo", "Medium",
        null, newAssignee, null, null, null), default);

    db.Notifications.Should().Contain(n =>
        n.UserId == newAssignee && n.Type == "task_assigned");
}

[Fact]
public async Task UpdateTaskStatus_ChangesStatus_AndNotifies()
{
    var (db, _, tenantId) = TestDb.New();
    var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
    var assignee = Guid.NewGuid();
    var taskId = Guid.NewGuid();
    db.TenantTasks.Add(new TenantTask
    {
        Id = taskId, TenantId = tenantId, Title = "T",
        Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Medium,
        CreatedByUserId = user.Id, AssignedToUserId = assignee,
    });
    await db.SaveChangesAsync();

    var handler = new UpdateTaskStatusHandler(db, new FakeTenantContext(tenantId), user);
    var result = await handler.Handle(new UpdateTaskStatusCommand(taskId, "Done"), default);

    result.IsSuccess.Should().BeTrue();
    db.TenantTasks.Find(taskId)!.Status.Should().Be(TenantTaskStatus.Done);
    db.Notifications.Should().Contain(n =>
        n.UserId == assignee && n.Type == "task_status_changed");
}

[Fact]
public async Task UpdateTaskStatus_InvalidStatus_ReturnsFailure()
{
    var (db, _, tenantId) = TestDb.New();
    var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
    var taskId = Guid.NewGuid();
    db.TenantTasks.Add(new TenantTask
    {
        Id = taskId, TenantId = tenantId, Title = "T",
        Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Medium, CreatedByUserId = user.Id,
    });
    await db.SaveChangesAsync();

    var handler = new UpdateTaskStatusHandler(db, new FakeTenantContext(tenantId), user);
    var result = await handler.Handle(new UpdateTaskStatusCommand(taskId, "Bogus"), default);

    result.IsSuccess.Should().BeFalse();
    result.Error.Should().Contain("status");
}
```

- [ ] **Step 2: Run tests to verify they fail (compile errors)**

Run: `dotnet test TravelCrm.Tests --filter "FullyQualifiedName~TaskCommandHandlersTests"`
Expected: `UpdateTaskCommand`, `UpdateTaskHandler`, `UpdateTaskStatusCommand`, `UpdateTaskStatusHandler` not defined.

- [ ] **Step 3: Create `UpdateTaskCommand.cs`**

```csharp
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;
using TravelCrm.Api.Infrastructure.Security;

namespace TravelCrm.Api.Features.Tasks.Commands;

public sealed record UpdateTaskCommand(
    Guid Id,
    string Title,
    string? Description,
    string Status,
    string Priority,
    Guid? TaskTypeId,
    Guid? AssignedToUserId,
    Guid? ParentTaskId,
    DateTime? DueDate,
    int? EstimatedMinutes
) : IRequest<Result<TaskDto>>;

public sealed class UpdateTaskValidator : AbstractValidator<UpdateTaskCommand>
{
    public UpdateTaskValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(4000);
        RuleFor(x => x.Status)
            .Must(s => Enum.TryParse<TenantTaskStatus>(s, ignoreCase: true, out _))
            .WithMessage("Status must be ToDo, InProgress, or Done");
        RuleFor(x => x.Priority)
            .Must(p => Enum.TryParse<TenantTaskPriority>(p, ignoreCase: true, out _))
            .WithMessage("Priority must be Low, Medium, High, or Urgent");
        RuleFor(x => x.EstimatedMinutes)
            .GreaterThan(0).When(x => x.EstimatedMinutes.HasValue);
    }
}

public sealed class UpdateTaskHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<UpdateTaskCommand, Result<TaskDto>>
{
    public async Task<Result<TaskDto>> Handle(UpdateTaskCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.tasks.manage"))
            return Result.Failure<TaskDto>("Forbidden");

        if (!tenantContext.IsResolved)
            return Result.Failure<TaskDto>("Tenant not resolved");

        var task = await db.TenantTasks
            .Include(t => t.TaskType)
            .FirstOrDefaultAsync(t => t.Id == cmd.Id && t.TenantId == tenantContext.TenantId, ct);

        if (task is null || task.IsDeleted)
            return Result.Failure<TaskDto>("Task not found");

        // Prevent setting parent to self or to one of own descendants (basic safety)
        if (cmd.ParentTaskId.HasValue && cmd.ParentTaskId.Value == cmd.Id)
            return Result.Failure<TaskDto>("Task cannot be its own parent");

        var previousAssignee = task.AssignedToUserId;
        var previousStatus = task.Status;

        task.Title = cmd.Title;
        task.Description = cmd.Description;
        task.Status = Enum.Parse<TenantTaskStatus>(cmd.Status, ignoreCase: true);
        task.Priority = Enum.Parse<TenantTaskPriority>(cmd.Priority, ignoreCase: true);
        task.TaskTypeId = cmd.TaskTypeId;
        task.AssignedToUserId = cmd.AssignedToUserId;
        task.ParentTaskId = cmd.ParentTaskId;
        task.DueDate = cmd.DueDate;
        task.EstimatedMinutes = cmd.EstimatedMinutes;

        // Reset overdue flag if due date moved into future or status flipped to Done
        if (task.IsOverdueSent
            && (task.Status == TenantTaskStatus.Done
                || !task.DueDate.HasValue
                || task.DueDate.Value >= DateTime.UtcNow))
        {
            task.IsOverdueSent = false;
        }

        // Notify new assignee on assignment change
        if (cmd.AssignedToUserId.HasValue
            && cmd.AssignedToUserId != previousAssignee
            && cmd.AssignedToUserId.Value != currentUser.Id)
        {
            db.Notifications.Add(new Notification
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId!.Value,
                UserId = cmd.AssignedToUserId.Value,
                Type = "task_assigned",
                Title = "Task assigned to you",
                Message = $"You've been assigned: {task.Title}",
                IsRead = false,
                ActionUrl = $"/apps/task/{task.Id}",
            });
        }

        // Notify on status change (creator + assignee)
        if (task.Status != previousStatus)
        {
            EmitStatusChangedNotifications(task, previousStatus, currentUser.Id, tenantContext.TenantId!.Value);
        }

        await db.SaveChangesAsync(ct);
        return Result.Success(TaskMapper.ToDto(task));
    }

    private void EmitStatusChangedNotifications(TenantTask task, TenantTaskStatus previousStatus, Guid actorId, Guid tenantId)
    {
        var msg = $"Task '{task.Title}' status changed: {previousStatus} → {task.Status}";
        var recipients = new HashSet<Guid>();
        if (task.CreatedByUserId != actorId) recipients.Add(task.CreatedByUserId);
        if (task.AssignedToUserId.HasValue && task.AssignedToUserId.Value != actorId)
            recipients.Add(task.AssignedToUserId.Value);

        foreach (var userId in recipients)
        {
            db.Notifications.Add(new Notification
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                UserId = userId,
                Type = "task_status_changed",
                Title = "Task status changed",
                Message = msg,
                IsRead = false,
                ActionUrl = $"/apps/task/{task.Id}",
            });
        }
    }
}
```

- [ ] **Step 4: Create `UpdateTaskStatusCommand.cs`**

```csharp
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;
using TravelCrm.Api.Infrastructure.Security;

namespace TravelCrm.Api.Features.Tasks.Commands;

public sealed record UpdateTaskStatusCommand(Guid Id, string Status) : IRequest<Result<TaskDto>>;

public sealed class UpdateTaskStatusValidator : AbstractValidator<UpdateTaskStatusCommand>
{
    public UpdateTaskStatusValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Status)
            .Must(s => Enum.TryParse<TenantTaskStatus>(s, ignoreCase: true, out _))
            .WithMessage("Invalid status");
    }
}

public sealed class UpdateTaskStatusHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<UpdateTaskStatusCommand, Result<TaskDto>>
{
    public async Task<Result<TaskDto>> Handle(UpdateTaskStatusCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.tasks.manage"))
            return Result.Failure<TaskDto>("Forbidden");

        if (!tenantContext.IsResolved)
            return Result.Failure<TaskDto>("Tenant not resolved");

        if (!Enum.TryParse<TenantTaskStatus>(cmd.Status, ignoreCase: true, out var newStatus))
            return Result.Failure<TaskDto>("Invalid status value");

        var task = await db.TenantTasks
            .Include(t => t.TaskType)
            .FirstOrDefaultAsync(t => t.Id == cmd.Id && t.TenantId == tenantContext.TenantId, ct);

        if (task is null || task.IsDeleted)
            return Result.Failure<TaskDto>("Task not found");

        var previousStatus = task.Status;
        if (previousStatus == newStatus)
            return Result.Success(TaskMapper.ToDto(task));

        task.Status = newStatus;
        if (newStatus == TenantTaskStatus.Done) task.IsOverdueSent = false;

        var msg = $"Task '{task.Title}' status changed: {previousStatus} → {newStatus}";
        var recipients = new HashSet<Guid>();
        if (task.CreatedByUserId != currentUser.Id) recipients.Add(task.CreatedByUserId);
        if (task.AssignedToUserId.HasValue && task.AssignedToUserId.Value != currentUser.Id)
            recipients.Add(task.AssignedToUserId.Value);

        foreach (var userId in recipients)
        {
            db.Notifications.Add(new Notification
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId!.Value,
                UserId = userId,
                Type = "task_status_changed",
                Title = "Task status changed",
                Message = msg,
                IsRead = false,
                ActionUrl = $"/apps/task/{task.Id}",
            });
        }

        await db.SaveChangesAsync(ct);
        return Result.Success(TaskMapper.ToDto(task));
    }
}
```

- [ ] **Step 5: Run tests**

Run: `dotnet test TravelCrm.Tests --filter "FullyQualifiedName~TaskCommandHandlersTests" -v minimal`
Expected: All 9 tests pass (4 from Task 5 + 5 new).

- [ ] **Step 6: Commit**

```bash
git add TravelCrm.Api/Features/Tasks/Commands/UpdateTaskCommand.cs \
        TravelCrm.Api/Features/Tasks/Commands/UpdateTaskStatusCommand.cs \
        TravelCrm.Tests/Tasks/TaskCommandHandlersTests.cs
git commit -m "feat(tasks): add UpdateTask and UpdateTaskStatus commands with notifications"
```

---

## Task 7: DeleteTask and RestoreTask Commands + Tests

**Files:**
- Create: `TravelCrm.Api/Features/Tasks/Commands/DeleteTaskCommand.cs`
- Create: `TravelCrm.Api/Features/Tasks/Commands/RestoreTaskCommand.cs`
- Modify: `TravelCrm.Tests/Tasks/TaskCommandHandlersTests.cs` (append)

- [ ] **Step 1: Append failing tests**

Add inside `TaskCommandHandlersTests`:

```csharp
[Fact]
public async Task DeleteTask_SoftDeletes()
{
    var (db, _, tenantId) = TestDb.New();
    var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
    var taskId = Guid.NewGuid();
    db.TenantTasks.Add(new TenantTask
    {
        Id = taskId, TenantId = tenantId, Title = "T",
        Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Medium, CreatedByUserId = user.Id,
    });
    await db.SaveChangesAsync();

    var handler = new DeleteTaskHandler(db, new FakeTenantContext(tenantId), user);
    var result = await handler.Handle(new DeleteTaskCommand(taskId), default);

    result.IsSuccess.Should().BeTrue();
    db.TenantTasks.Find(taskId)!.IsDeleted.Should().BeTrue();
}

[Fact]
public async Task RestoreTask_UnsetsIsDeleted()
{
    var (db, _, tenantId) = TestDb.New();
    var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
    var taskId = Guid.NewGuid();
    db.TenantTasks.Add(new TenantTask
    {
        Id = taskId, TenantId = tenantId, Title = "T",
        Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Medium,
        CreatedByUserId = user.Id, IsDeleted = true,
    });
    await db.SaveChangesAsync();

    var handler = new RestoreTaskHandler(db, new FakeTenantContext(tenantId), user);
    var result = await handler.Handle(new RestoreTaskCommand(taskId), default);

    result.IsSuccess.Should().BeTrue();
    db.TenantTasks.Find(taskId)!.IsDeleted.Should().BeFalse();
}

[Fact]
public async Task DeleteTask_FromOtherTenant_ReturnsNotFound()
{
    var (db, _, tenantId) = TestDb.New();
    var otherTenantId = Guid.NewGuid();
    var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
    var taskId = Guid.NewGuid();
    db.TenantTasks.Add(new TenantTask
    {
        Id = taskId, TenantId = otherTenantId, Title = "T",
        Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Medium, CreatedByUserId = user.Id,
    });
    await db.SaveChangesAsync();

    var handler = new DeleteTaskHandler(db, new FakeTenantContext(tenantId), user);
    var result = await handler.Handle(new DeleteTaskCommand(taskId), default);

    result.IsSuccess.Should().BeFalse();
    result.Error.Should().Contain("not found");
}
```

- [ ] **Step 2: Run tests to confirm failure (compile error)**

Run: `dotnet test TravelCrm.Tests --filter "FullyQualifiedName~TaskCommandHandlersTests"`
Expected: `DeleteTaskCommand`, `DeleteTaskHandler`, `RestoreTaskCommand`, `RestoreTaskHandler` undefined.

- [ ] **Step 3: Create `DeleteTaskCommand.cs`**

```csharp
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;
using TravelCrm.Api.Infrastructure.Security;

namespace TravelCrm.Api.Features.Tasks.Commands;

public sealed record DeleteTaskCommand(Guid Id) : IRequest<Result>;

public sealed class DeleteTaskHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<DeleteTaskCommand, Result>
{
    public async Task<Result> Handle(DeleteTaskCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.tasks.manage"))
            return Result.Failure("Forbidden");

        if (!tenantContext.IsResolved)
            return Result.Failure("Tenant not resolved");

        var task = await db.TenantTasks
            .FirstOrDefaultAsync(t => t.Id == cmd.Id && t.TenantId == tenantContext.TenantId, ct);

        if (task is null) return Result.Failure("Task not found");

        task.IsDeleted = true;
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
```

- [ ] **Step 4: Create `RestoreTaskCommand.cs`**

```csharp
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;
using TravelCrm.Api.Infrastructure.Security;

namespace TravelCrm.Api.Features.Tasks.Commands;

public sealed record RestoreTaskCommand(Guid Id) : IRequest<Result<TaskDto>>;

public sealed class RestoreTaskHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<RestoreTaskCommand, Result<TaskDto>>
{
    public async Task<Result<TaskDto>> Handle(RestoreTaskCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.tasks.manage"))
            return Result.Failure<TaskDto>("Forbidden");

        if (!tenantContext.IsResolved)
            return Result.Failure<TaskDto>("Tenant not resolved");

        var task = await db.TenantTasks
            .Include(t => t.TaskType)
            .FirstOrDefaultAsync(t => t.Id == cmd.Id && t.TenantId == tenantContext.TenantId, ct);

        if (task is null) return Result.Failure<TaskDto>("Task not found");

        task.IsDeleted = false;
        await db.SaveChangesAsync(ct);
        return Result.Success(TaskMapper.ToDto(task));
    }
}
```

- [ ] **Step 5: Run tests**

Run: `dotnet test TravelCrm.Tests --filter "FullyQualifiedName~TaskCommandHandlersTests" -v minimal`
Expected: All 12 tests pass.

- [ ] **Step 6: Commit**

```bash
git add TravelCrm.Api/Features/Tasks/Commands/DeleteTaskCommand.cs \
        TravelCrm.Api/Features/Tasks/Commands/RestoreTaskCommand.cs \
        TravelCrm.Tests/Tasks/TaskCommandHandlersTests.cs
git commit -m "feat(tasks): add DeleteTask (soft) and RestoreTask commands"
```

---

## Task 8: TasksController

**Files:**
- Create: `TravelCrm.Api/Features/Tasks/TasksController.cs`

- [ ] **Step 1: Create the controller**

```csharp
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Features.Tasks.Commands;
using TravelCrm.Api.Features.Tasks.Queries;

namespace TravelCrm.Api.Features.Tasks;

[ApiController]
[Authorize]
[Route("api/crm/tasks")]
public sealed class TasksController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] string? priority,
        [FromQuery] Guid? assignedToUserId,
        [FromQuery] Guid? taskTypeId,
        [FromQuery] bool includeDeleted = false)
    {
        var r = await mediator.Send(new ListTasksQuery(
            search, status, priority, assignedToUserId, taskTypeId, includeDeleted));
        return r.IsSuccess ? Ok(r.Value) : Forbid();
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var r = await mediator.Send(new GetTaskQuery(id));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Forbid();
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] TaskWriteRequest body)
    {
        var r = await mediator.Send(new CreateTaskCommand(
            body.Title, body.Description, body.Status, body.Priority,
            body.TaskTypeId, body.AssignedToUserId, body.ParentTaskId,
            body.DueDate, body.EstimatedMinutes));
        return r.IsSuccess
            ? CreatedAtAction(nameof(Get), new { id = r.Value!.Id }, r.Value)
            : BadRequest(new { error = r.Error });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] TaskWriteRequest body)
    {
        var r = await mediator.Send(new UpdateTaskCommand(
            id, body.Title, body.Description, body.Status, body.Priority,
            body.TaskTypeId, body.AssignedToUserId, body.ParentTaskId,
            body.DueDate, body.EstimatedMinutes));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : BadRequest(new { error = r.Error });
    }

    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] StatusUpdateRequest body)
    {
        var r = await mediator.Send(new UpdateTaskStatusCommand(id, body.Status));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : BadRequest(new { error = r.Error });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var r = await mediator.Send(new DeleteTaskCommand(id));
        if (r.IsSuccess) return NoContent();
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Forbid();
    }

    [HttpPost("{id:guid}/restore")]
    public async Task<IActionResult> Restore(Guid id)
    {
        var r = await mediator.Send(new RestoreTaskCommand(id));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Forbid();
    }
}

public sealed record TaskWriteRequest(
    string Title,
    string? Description,
    string Status,
    string Priority,
    Guid? TaskTypeId,
    Guid? AssignedToUserId,
    Guid? ParentTaskId,
    DateTime? DueDate,
    int? EstimatedMinutes
);

public sealed record StatusUpdateRequest(string Status);
```

- [ ] **Step 2: Build**

Run: `dotnet build TravelCrm.Api`
Expected: Succeeds.

- [ ] **Step 3: Smoke-test the endpoints**

Start the API: `dotnet run --project TravelCrm.Api`
Then in another terminal (replace `<TOKEN>` with a valid JWT):

```bash
# List tasks
curl -H "Authorization: Bearer <TOKEN>" http://localhost:5044/api/crm/tasks

# Create a task
curl -X POST -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"title":"Test","description":null,"status":"ToDo","priority":"Medium","taskTypeId":null,"assignedToUserId":null,"parentTaskId":null,"dueDate":null,"estimatedMinutes":null}' \
  http://localhost:5044/api/crm/tasks
```

Expected: List returns `[]` initially. Create returns `201 Created` with the new task DTO.

- [ ] **Step 4: Commit**

```bash
git add TravelCrm.Api/Features/Tasks/TasksController.cs
git commit -m "feat(tasks): add TasksController with REST endpoints"
```

---

## Task 9: TaskType Feature (CRUD + Controller + Tests)

**Files:**
- Create: `TravelCrm.Api/Features/TaskTypes/Queries/ListTaskTypesQuery.cs`
- Create: `TravelCrm.Api/Features/TaskTypes/Commands/CreateTaskTypeCommand.cs`
- Create: `TravelCrm.Api/Features/TaskTypes/Commands/UpdateTaskTypeCommand.cs`
- Create: `TravelCrm.Api/Features/TaskTypes/Commands/DeleteTaskTypeCommand.cs`
- Create: `TravelCrm.Api/Features/TaskTypes/TaskTypesController.cs`
- Create: `TravelCrm.Tests/TaskTypes/TaskTypeHandlersTests.cs`

- [ ] **Step 1: Write failing tests in `TaskTypeHandlersTests.cs`**

```csharp
using FluentAssertions;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.TaskTypes.Commands;
using TravelCrm.Api.Features.TaskTypes.Queries;

namespace TravelCrm.Tests.TaskTypes;

public class TaskTypeHandlersTests
{
    [Fact]
    public async Task CreateTaskType_Persists()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var handler = new CreateTaskTypeHandler(db, new FakeTenantContext(tenantId), user);

        var result = await handler.Handle(new CreateTaskTypeCommand("Bug", "#FF0000"), default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Name.Should().Be("Bug");
        db.TaskTypes.Should().ContainSingle(t => t.Name == "Bug" && t.TenantId == tenantId);
    }

    [Fact]
    public async Task ListTaskTypes_FiltersByTenant()
    {
        var (db, _, tenantId) = TestDb.New();
        var otherTenantId = Guid.NewGuid();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);

        db.TaskTypes.Add(new TaskType { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Bug", Color = "#F00", IsActive = true });
        db.TaskTypes.Add(new TaskType { Id = Guid.NewGuid(), TenantId = otherTenantId, Name = "Other", Color = "#0F0", IsActive = true });
        await db.SaveChangesAsync();

        var handler = new ListTaskTypesHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new ListTaskTypesQuery(), default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Should().HaveCount(1);
        result.Value!.Single().Name.Should().Be("Bug");
    }

    [Fact]
    public async Task UpdateTaskType_ChangesNameAndColor()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var id = Guid.NewGuid();
        db.TaskTypes.Add(new TaskType { Id = id, TenantId = tenantId, Name = "Old", Color = "#000", IsActive = true });
        await db.SaveChangesAsync();

        var handler = new UpdateTaskTypeHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new UpdateTaskTypeCommand(id, "New", "#FFF", false), default);

        result.IsSuccess.Should().BeTrue();
        var fresh = db.TaskTypes.Find(id)!;
        fresh.Name.Should().Be("New");
        fresh.Color.Should().Be("#FFF");
        fresh.IsActive.Should().BeFalse();
    }

    [Fact]
    public async Task DeleteTaskType_WhenInUse_ReturnsConflict()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var typeId = Guid.NewGuid();
        db.TaskTypes.Add(new TaskType { Id = typeId, TenantId = tenantId, Name = "InUse", Color = "#000", IsActive = true });
        db.TenantTasks.Add(new TenantTask
        {
            Id = Guid.NewGuid(), TenantId = tenantId, Title = "T",
            Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Medium,
            CreatedByUserId = user.Id, TaskTypeId = typeId,
        });
        await db.SaveChangesAsync();

        var handler = new DeleteTaskTypeHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new DeleteTaskTypeCommand(typeId), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("in use");
    }

    [Fact]
    public async Task DeleteTaskType_WhenUnused_Removes()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var typeId = Guid.NewGuid();
        db.TaskTypes.Add(new TaskType { Id = typeId, TenantId = tenantId, Name = "Unused", Color = "#000", IsActive = true });
        await db.SaveChangesAsync();

        var handler = new DeleteTaskTypeHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new DeleteTaskTypeCommand(typeId), default);

        result.IsSuccess.Should().BeTrue();
        db.TaskTypes.Find(typeId).Should().BeNull();
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test TravelCrm.Tests --filter "FullyQualifiedName~TaskTypeHandlersTests"`
Expected: Compile errors.

- [ ] **Step 3: Create `ListTaskTypesQuery.cs`**

```csharp
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;
using TravelCrm.Api.Infrastructure.Security;

namespace TravelCrm.Api.Features.TaskTypes.Queries;

public sealed record ListTaskTypesQuery() : IRequest<Result<List<TaskTypeDto>>>;

public sealed class ListTaskTypesHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<ListTaskTypesQuery, Result<List<TaskTypeDto>>>
{
    public async Task<Result<List<TaskTypeDto>>> Handle(ListTaskTypesQuery q, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.tasks.view"))
            return Result.Failure<List<TaskTypeDto>>("Forbidden");

        if (!tenantContext.IsResolved)
            return Result.Failure<List<TaskTypeDto>>("Tenant not resolved");

        var types = await db.TaskTypes
            .Where(t => t.TenantId == tenantContext.TenantId)
            .OrderBy(t => t.Name)
            .ToListAsync(ct);

        return Result.Success(types.Select(TaskTypeMapper.ToDto).ToList());
    }
}
```

- [ ] **Step 4: Create `CreateTaskTypeCommand.cs`**

```csharp
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;
using TravelCrm.Api.Infrastructure.Security;

namespace TravelCrm.Api.Features.TaskTypes.Commands;

public sealed record CreateTaskTypeCommand(string Name, string Color) : IRequest<Result<TaskTypeDto>>;

public sealed class CreateTaskTypeValidator : AbstractValidator<CreateTaskTypeCommand>
{
    public CreateTaskTypeValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Color).NotEmpty().MaximumLength(7).Matches("^#[0-9A-Fa-f]{6}$")
            .WithMessage("Color must be a hex code like #3B82F6");
    }
}

public sealed class CreateTaskTypeHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<CreateTaskTypeCommand, Result<TaskTypeDto>>
{
    public async Task<Result<TaskTypeDto>> Handle(CreateTaskTypeCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.tasks.admin"))
            return Result.Failure<TaskTypeDto>("Forbidden");

        if (!tenantContext.IsResolved)
            return Result.Failure<TaskTypeDto>("Tenant not resolved");

        var nameClash = await db.TaskTypes.AnyAsync(
            t => t.TenantId == tenantContext.TenantId && t.Name == cmd.Name, ct);
        if (nameClash)
            return Result.Failure<TaskTypeDto>("A task type with this name already exists");

        var entity = new TaskType
        {
            Id = Guid.NewGuid(),
            TenantId = tenantContext.TenantId!.Value,
            Name = cmd.Name,
            Color = cmd.Color,
            IsActive = true,
        };
        db.TaskTypes.Add(entity);
        await db.SaveChangesAsync(ct);
        return Result.Success(TaskTypeMapper.ToDto(entity));
    }
}
```

- [ ] **Step 5: Create `UpdateTaskTypeCommand.cs`**

```csharp
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;
using TravelCrm.Api.Infrastructure.Security;

namespace TravelCrm.Api.Features.TaskTypes.Commands;

public sealed record UpdateTaskTypeCommand(Guid Id, string Name, string Color, bool IsActive)
    : IRequest<Result<TaskTypeDto>>;

public sealed class UpdateTaskTypeValidator : AbstractValidator<UpdateTaskTypeCommand>
{
    public UpdateTaskTypeValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Color).NotEmpty().MaximumLength(7).Matches("^#[0-9A-Fa-f]{6}$");
    }
}

public sealed class UpdateTaskTypeHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<UpdateTaskTypeCommand, Result<TaskTypeDto>>
{
    public async Task<Result<TaskTypeDto>> Handle(UpdateTaskTypeCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.tasks.admin"))
            return Result.Failure<TaskTypeDto>("Forbidden");

        if (!tenantContext.IsResolved)
            return Result.Failure<TaskTypeDto>("Tenant not resolved");

        var entity = await db.TaskTypes.FirstOrDefaultAsync(
            t => t.Id == cmd.Id && t.TenantId == tenantContext.TenantId, ct);
        if (entity is null) return Result.Failure<TaskTypeDto>("Task type not found");

        var nameClash = await db.TaskTypes.AnyAsync(
            t => t.TenantId == tenantContext.TenantId && t.Name == cmd.Name && t.Id != cmd.Id, ct);
        if (nameClash) return Result.Failure<TaskTypeDto>("A task type with this name already exists");

        entity.Name = cmd.Name;
        entity.Color = cmd.Color;
        entity.IsActive = cmd.IsActive;
        await db.SaveChangesAsync(ct);
        return Result.Success(TaskTypeMapper.ToDto(entity));
    }
}
```

- [ ] **Step 6: Create `DeleteTaskTypeCommand.cs`**

```csharp
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;
using TravelCrm.Api.Infrastructure.Security;

namespace TravelCrm.Api.Features.TaskTypes.Commands;

public sealed record DeleteTaskTypeCommand(Guid Id) : IRequest<Result>;

public sealed class DeleteTaskTypeHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<DeleteTaskTypeCommand, Result>
{
    public async Task<Result> Handle(DeleteTaskTypeCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.tasks.admin"))
            return Result.Failure("Forbidden");

        if (!tenantContext.IsResolved)
            return Result.Failure("Tenant not resolved");

        var entity = await db.TaskTypes.FirstOrDefaultAsync(
            t => t.Id == cmd.Id && t.TenantId == tenantContext.TenantId, ct);
        if (entity is null) return Result.Failure("Task type not found");

        var inUse = await db.TenantTasks.AnyAsync(
            t => t.TaskTypeId == cmd.Id && t.TenantId == tenantContext.TenantId, ct);
        if (inUse) return Result.Failure("Task type is in use by existing tasks");

        db.TaskTypes.Remove(entity);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
```

- [ ] **Step 7: Create `TaskTypesController.cs`**

```csharp
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Features.TaskTypes.Commands;
using TravelCrm.Api.Features.TaskTypes.Queries;

namespace TravelCrm.Api.Features.TaskTypes;

[ApiController]
[Authorize]
[Route("api/crm/task-types")]
public sealed class TaskTypesController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List()
    {
        var r = await mediator.Send(new ListTaskTypesQuery());
        return r.IsSuccess ? Ok(r.Value) : Forbid();
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] TaskTypeWriteRequest body)
    {
        var r = await mediator.Send(new CreateTaskTypeCommand(body.Name, body.Color));
        return r.IsSuccess ? Ok(r.Value) : BadRequest(new { error = r.Error });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] TaskTypeUpdateRequest body)
    {
        var r = await mediator.Send(new UpdateTaskTypeCommand(id, body.Name, body.Color, body.IsActive));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : BadRequest(new { error = r.Error });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var r = await mediator.Send(new DeleteTaskTypeCommand(id));
        if (r.IsSuccess) return NoContent();
        if (r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase))
            return NotFound(new { error = r.Error });
        if (r.Error!.Contains("in use", StringComparison.OrdinalIgnoreCase))
            return Conflict(new { error = r.Error });
        return Forbid();
    }
}

public sealed record TaskTypeWriteRequest(string Name, string Color);
public sealed record TaskTypeUpdateRequest(string Name, string Color, bool IsActive);
```

- [ ] **Step 8: Run tests**

Run: `dotnet test TravelCrm.Tests --filter "FullyQualifiedName~TaskTypeHandlersTests" -v minimal`
Expected: All 5 tests pass.

- [ ] **Step 9: Commit**

```bash
git add TravelCrm.Api/Features/TaskTypes/ \
        TravelCrm.Tests/TaskTypes/
git commit -m "feat(task-types): add CRUD endpoints with name uniqueness and in-use guard"
```

---

## Task 10: TimeEntries Feature (CRUD + Controller + Tests)

**Files:**
- Create: `TravelCrm.Api/Features/TimeEntries/Queries/ListTimeEntriesQuery.cs`
- Create: `TravelCrm.Api/Features/TimeEntries/Commands/LogTimeCommand.cs`
- Create: `TravelCrm.Api/Features/TimeEntries/Commands/DeleteTimeEntryCommand.cs`
- Create: `TravelCrm.Api/Features/TimeEntries/TimeEntriesController.cs`
- Create: `TravelCrm.Tests/TimeEntries/TimeEntryHandlersTests.cs`

- [ ] **Step 1: Write failing tests in `TimeEntryHandlersTests.cs`**

```csharp
using FluentAssertions;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.TimeEntries.Commands;
using TravelCrm.Api.Features.TimeEntries.Queries;

namespace TravelCrm.Tests.TimeEntries;

public class TimeEntryHandlersTests
{
    private static TenantTask SeedTask(ApplicationDbContext db, Guid tenantId, Guid userId)
    {
        var t = new TenantTask
        {
            Id = Guid.NewGuid(), TenantId = tenantId, Title = "Parent",
            Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Medium, CreatedByUserId = userId,
        };
        db.TenantTasks.Add(t);
        db.SaveChanges();
        return t;
    }

    [Fact]
    public async Task LogTime_AddsEntry()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var task = SeedTask(db, tenantId, user.Id);
        var handler = new LogTimeHandler(db, new FakeTenantContext(tenantId), user);

        var result = await handler.Handle(
            new LogTimeCommand(task.Id, 30, "did stuff"), default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Minutes.Should().Be(30);
        db.TimeEntries.Should().ContainSingle(te =>
            te.TaskId == task.Id && te.Minutes == 30 && te.UserId == user.Id);
    }

    [Fact]
    public async Task LogTime_OnDeletedTask_ReturnsFailure()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var task = SeedTask(db, tenantId, user.Id);
        task.IsDeleted = true;
        await db.SaveChangesAsync();

        var handler = new LogTimeHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new LogTimeCommand(task.Id, 30, null), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("not found");
    }

    [Fact]
    public async Task ListTimeEntries_ReturnsForTask()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var task = SeedTask(db, tenantId, user.Id);
        db.TimeEntries.Add(new TimeEntry
        {
            Id = Guid.NewGuid(), TenantId = tenantId, TaskId = task.Id, UserId = user.Id,
            Minutes = 15, LoggedAt = DateTime.UtcNow,
        });
        db.TimeEntries.Add(new TimeEntry
        {
            Id = Guid.NewGuid(), TenantId = tenantId, TaskId = task.Id, UserId = user.Id,
            Minutes = 45, LoggedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var handler = new ListTimeEntriesHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new ListTimeEntriesQuery(task.Id), default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Should().HaveCount(2);
    }

    [Fact]
    public async Task DeleteTimeEntry_RemovesIt()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var task = SeedTask(db, tenantId, user.Id);
        var teId = Guid.NewGuid();
        db.TimeEntries.Add(new TimeEntry
        {
            Id = teId, TenantId = tenantId, TaskId = task.Id, UserId = user.Id,
            Minutes = 15, LoggedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var handler = new DeleteTimeEntryHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new DeleteTimeEntryCommand(task.Id, teId), default);

        result.IsSuccess.Should().BeTrue();
        db.TimeEntries.Find(teId).Should().BeNull();
    }
}
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `dotnet test TravelCrm.Tests --filter "FullyQualifiedName~TimeEntryHandlersTests"`
Expected: Compile errors.

- [ ] **Step 3: Create `LogTimeCommand.cs`**

```csharp
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;
using TravelCrm.Api.Infrastructure.Security;

namespace TravelCrm.Api.Features.TimeEntries.Commands;

public sealed record LogTimeCommand(Guid TaskId, int Minutes, string? Notes)
    : IRequest<Result<TimeEntryDto>>;

public sealed class LogTimeValidator : AbstractValidator<LogTimeCommand>
{
    public LogTimeValidator()
    {
        RuleFor(x => x.TaskId).NotEmpty();
        RuleFor(x => x.Minutes).GreaterThan(0).LessThanOrEqualTo(24 * 60);
        RuleFor(x => x.Notes).MaximumLength(500);
    }
}

public sealed class LogTimeHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<LogTimeCommand, Result<TimeEntryDto>>
{
    public async Task<Result<TimeEntryDto>> Handle(LogTimeCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.tasks.manage"))
            return Result.Failure<TimeEntryDto>("Forbidden");

        if (!tenantContext.IsResolved)
            return Result.Failure<TimeEntryDto>("Tenant not resolved");

        var taskExists = await db.TenantTasks.AnyAsync(
            t => t.Id == cmd.TaskId
              && t.TenantId == tenantContext.TenantId
              && !t.IsDeleted, ct);
        if (!taskExists) return Result.Failure<TimeEntryDto>("Task not found");

        var entry = new TimeEntry
        {
            Id = Guid.NewGuid(),
            TenantId = tenantContext.TenantId!.Value,
            TaskId = cmd.TaskId,
            UserId = currentUser.Id,
            Minutes = cmd.Minutes,
            Notes = cmd.Notes,
            LoggedAt = DateTime.UtcNow,
        };
        db.TimeEntries.Add(entry);
        await db.SaveChangesAsync(ct);
        return Result.Success(TimeEntryMapper.ToDto(entry));
    }
}
```

- [ ] **Step 4: Create `DeleteTimeEntryCommand.cs`**

```csharp
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;
using TravelCrm.Api.Infrastructure.Security;

namespace TravelCrm.Api.Features.TimeEntries.Commands;

public sealed record DeleteTimeEntryCommand(Guid TaskId, Guid Id) : IRequest<Result>;

public sealed class DeleteTimeEntryHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<DeleteTimeEntryCommand, Result>
{
    public async Task<Result> Handle(DeleteTimeEntryCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.tasks.manage"))
            return Result.Failure("Forbidden");

        if (!tenantContext.IsResolved)
            return Result.Failure("Tenant not resolved");

        var entry = await db.TimeEntries.FirstOrDefaultAsync(
            te => te.Id == cmd.Id
               && te.TaskId == cmd.TaskId
               && te.TenantId == tenantContext.TenantId, ct);

        if (entry is null) return Result.Failure("Time entry not found");

        db.TimeEntries.Remove(entry);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
```

- [ ] **Step 5: Create `ListTimeEntriesQuery.cs`**

```csharp
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;
using TravelCrm.Api.Infrastructure.Security;

namespace TravelCrm.Api.Features.TimeEntries.Queries;

public sealed record ListTimeEntriesQuery(Guid TaskId) : IRequest<Result<List<TimeEntryDto>>>;

public sealed class ListTimeEntriesHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<ListTimeEntriesQuery, Result<List<TimeEntryDto>>>
{
    public async Task<Result<List<TimeEntryDto>>> Handle(ListTimeEntriesQuery q, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.tasks.view"))
            return Result.Failure<List<TimeEntryDto>>("Forbidden");

        if (!tenantContext.IsResolved)
            return Result.Failure<List<TimeEntryDto>>("Tenant not resolved");

        var taskExists = await db.TenantTasks.AnyAsync(
            t => t.Id == q.TaskId && t.TenantId == tenantContext.TenantId, ct);
        if (!taskExists) return Result.Failure<List<TimeEntryDto>>("Task not found");

        var entries = await db.TimeEntries
            .Where(te => te.TaskId == q.TaskId && te.TenantId == tenantContext.TenantId)
            .OrderByDescending(te => te.LoggedAt)
            .ToListAsync(ct);

        return Result.Success(entries.Select(te => TimeEntryMapper.ToDto(te)).ToList());
    }
}
```

- [ ] **Step 6: Create `TimeEntriesController.cs`**

```csharp
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Features.TimeEntries.Commands;
using TravelCrm.Api.Features.TimeEntries.Queries;

namespace TravelCrm.Api.Features.TimeEntries;

[ApiController]
[Authorize]
[Route("api/crm/tasks/{taskId:guid}/time-entries")]
public sealed class TimeEntriesController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(Guid taskId)
    {
        var r = await mediator.Send(new ListTimeEntriesQuery(taskId));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Forbid();
    }

    [HttpPost]
    public async Task<IActionResult> Log(Guid taskId, [FromBody] TimeEntryWriteRequest body)
    {
        var r = await mediator.Send(new LogTimeCommand(taskId, body.Minutes, body.Notes));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : BadRequest(new { error = r.Error });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid taskId, Guid id)
    {
        var r = await mediator.Send(new DeleteTimeEntryCommand(taskId, id));
        if (r.IsSuccess) return NoContent();
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Forbid();
    }
}

public sealed record TimeEntryWriteRequest(int Minutes, string? Notes);
```

- [ ] **Step 7: Run tests**

Run: `dotnet test TravelCrm.Tests --filter "FullyQualifiedName~TimeEntryHandlersTests" -v minimal`
Expected: All 4 tests pass.

- [ ] **Step 8: Commit**

```bash
git add TravelCrm.Api/Features/TimeEntries/ \
        TravelCrm.Tests/TimeEntries/
git commit -m "feat(time-entries): add log/list/delete time entry handlers and controller"
```

---

## Task 11: OverdueTasksJob (Hangfire daily recurring job)

**Files:**
- Create: `TravelCrm.Api/Infrastructure/Jobs/OverdueTasksJob.cs`
- Modify: `TravelCrm.Api/Infrastructure/Jobs/RecurringJobRegistrar.cs`
- Modify: `TravelCrm.Api/Program.cs`

- [ ] **Step 1: Create `OverdueTasksJob.cs`**

```csharp
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Infrastructure.Jobs;

public sealed class OverdueTasksJob(
    ApplicationDbContext db,
    ILogger<OverdueTasksJob> logger)
{
    public async Task ExecuteAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;

        var overdueTasks = await db.TenantTasks
            .Where(t => !t.IsDeleted
                     && t.Status != TenantTaskStatus.Done
                     && t.DueDate.HasValue
                     && t.DueDate < now
                     && !t.IsOverdueSent)
            .ToListAsync(ct);

        if (overdueTasks.Count == 0)
        {
            logger.LogInformation("OverdueTasksJob: no overdue tasks needing notification");
            return;
        }

        logger.LogInformation("OverdueTasksJob: notifying {Count} overdue tasks", overdueTasks.Count);

        foreach (var task in overdueTasks)
        {
            var msg = $"Task overdue: '{task.Title}' was due {task.DueDate:yyyy-MM-dd}";
            var recipients = new HashSet<Guid> { task.CreatedByUserId };
            if (task.AssignedToUserId.HasValue)
                recipients.Add(task.AssignedToUserId.Value);

            foreach (var userId in recipients)
            {
                db.Notifications.Add(new Notification
                {
                    Id = Guid.NewGuid(),
                    TenantId = task.TenantId,
                    UserId = userId,
                    Type = "task_overdue",
                    Title = "Task overdue",
                    Message = msg,
                    IsRead = false,
                    ActionUrl = $"/apps/task/{task.Id}",
                });
            }

            task.IsOverdueSent = true;
        }

        await db.SaveChangesAsync(ct);
    }
}
```

- [ ] **Step 2: Register job in DI in `Program.cs`**

Find the line near other scoped job registrations (e.g., `builder.Services.AddScoped<SampleHeartbeatJob>();`) and add:

```csharp
builder.Services.AddScoped<OverdueTasksJob>();
```

- [ ] **Step 3: Add to `RecurringJobRegistrar.cs`**

Find the `RegisterAll(IRecurringJobManager jobs)` method body. Add:

```csharp
jobs.AddOrUpdate<OverdueTasksJob>(
    recurringJobId: "overdue-tasks-check",
    methodCall: j => j.ExecuteAsync(CancellationToken.None),
    cronExpression: Cron.Daily);
```

(The exact import path is `using Hangfire;` for `Cron`. The using for `OverdueTasksJob` is `TravelCrm.Api.Infrastructure.Jobs`.)

- [ ] **Step 4: Build**

Run: `dotnet build TravelCrm.Api`
Expected: Succeeds.

- [ ] **Step 5: Smoke-test the job**

Start the API and visit the Hangfire dashboard (typically `/hangfire`). Verify the recurring job `overdue-tasks-check` appears with cron `0 0 * * *` (daily at midnight). Trigger it manually via the dashboard's "Trigger now" button. Check logs for "OverdueTasksJob: notifying X overdue tasks" or "no overdue tasks needing notification".

- [ ] **Step 6: Commit**

```bash
git add TravelCrm.Api/Infrastructure/Jobs/OverdueTasksJob.cs \
        TravelCrm.Api/Infrastructure/Jobs/RecurringJobRegistrar.cs \
        TravelCrm.Api/Program.cs
git commit -m "feat(tasks): add OverdueTasksJob daily Hangfire recurring job"
```

---

## Task 12: Angular Models and Services

**Files:**
- Create: `src/app/models/task.model.ts`
- Create: `src/app/core/services/tasks.service.ts`
- Create: `src/app/core/services/task-types.service.ts`
- Create: `src/app/core/services/time-entries.service.ts`

> Convention check: confirm services live in `src/app/core/services/` (matches `leads.service.ts`).

- [ ] **Step 1: Create `task.model.ts`**

```typescript
export type TenantTaskStatus = 'ToDo' | 'InProgress' | 'Done';
export type TenantTaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface TaskDto {
  id: string;
  title: string;
  description?: string | null;
  status: TenantTaskStatus;
  priority: TenantTaskPriority;
  taskTypeId?: string | null;
  taskTypeName?: string | null;
  taskTypeColor?: string | null;
  assignedToUserId?: string | null;
  assignedToUserName?: string | null;
  createdByUserId: string;
  createdByUserName: string;
  parentTaskId?: string | null;
  dueDate?: string | null;
  estimatedMinutes?: number | null;
  totalLoggedMinutes: number;
  isOverdue: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  children: TaskDto[];
}

export interface TaskWriteBody {
  title: string;
  description?: string | null;
  status: TenantTaskStatus;
  priority: TenantTaskPriority;
  taskTypeId?: string | null;
  assignedToUserId?: string | null;
  parentTaskId?: string | null;
  dueDate?: string | null;
  estimatedMinutes?: number | null;
}

export interface TaskTypeDto {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
}

export interface TaskTypeWriteBody {
  name: string;
  color: string;
  isActive?: boolean;
}

export interface TimeEntryDto {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  minutes: number;
  notes?: string | null;
  loggedAt: string;
}

export interface TimeEntryWriteBody {
  minutes: number;
  notes?: string | null;
}
```

- [ ] **Step 2: Create `tasks.service.ts`**

```typescript
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from 'src/app/core/tokens/api-base-url.token';
import { TaskDto, TaskWriteBody } from 'src/app/models/task.model';

export interface ListTasksParams {
  search?: string;
  status?: string;
  priority?: string;
  assignedToUserId?: string;
  taskTypeId?: string;
  includeDeleted?: boolean;
}

@Injectable({ providedIn: 'root' })
export class TasksService {
  private http = inject(HttpClient);
  private base = inject(API_BASE_URL);
  private url = `${this.base}/crm/tasks`;

  list(params?: ListTasksParams): Observable<TaskDto[]> {
    const query: Record<string, string> = {};
    if (params?.search) query['search'] = params.search;
    if (params?.status) query['status'] = params.status;
    if (params?.priority) query['priority'] = params.priority;
    if (params?.assignedToUserId) query['assignedToUserId'] = params.assignedToUserId;
    if (params?.taskTypeId) query['taskTypeId'] = params.taskTypeId;
    if (params?.includeDeleted) query['includeDeleted'] = 'true';
    return this.http.get<TaskDto[]>(this.url, { params: query });
  }

  get(id: string): Observable<TaskDto> {
    return this.http.get<TaskDto>(`${this.url}/${id}`);
  }

  create(body: TaskWriteBody): Observable<TaskDto> {
    return this.http.post<TaskDto>(this.url, body);
  }

  update(id: string, body: TaskWriteBody): Observable<TaskDto> {
    return this.http.put<TaskDto>(`${this.url}/${id}`, body);
  }

  updateStatus(id: string, status: string): Observable<TaskDto> {
    return this.http.patch<TaskDto>(`${this.url}/${id}/status`, { status });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  restore(id: string): Observable<TaskDto> {
    return this.http.post<TaskDto>(`${this.url}/${id}/restore`, {});
  }
}
```

> If the `API_BASE_URL` token import path differs in this project, look at the import at the top of `src/app/core/services/leads.service.ts` and copy it.

- [ ] **Step 3: Create `task-types.service.ts`**

```typescript
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from 'src/app/core/tokens/api-base-url.token';
import { TaskTypeDto, TaskTypeWriteBody } from 'src/app/models/task.model';

@Injectable({ providedIn: 'root' })
export class TaskTypesService {
  private http = inject(HttpClient);
  private base = inject(API_BASE_URL);
  private url = `${this.base}/crm/task-types`;

  list(): Observable<TaskTypeDto[]> {
    return this.http.get<TaskTypeDto[]>(this.url);
  }

  create(body: TaskTypeWriteBody): Observable<TaskTypeDto> {
    return this.http.post<TaskTypeDto>(this.url, body);
  }

  update(id: string, body: TaskTypeWriteBody & { isActive: boolean }): Observable<TaskTypeDto> {
    return this.http.put<TaskTypeDto>(`${this.url}/${id}`, body);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
```

- [ ] **Step 4: Create `time-entries.service.ts`**

```typescript
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from 'src/app/core/tokens/api-base-url.token';
import { TimeEntryDto, TimeEntryWriteBody } from 'src/app/models/task.model';

@Injectable({ providedIn: 'root' })
export class TimeEntriesService {
  private http = inject(HttpClient);
  private base = inject(API_BASE_URL);

  private taskUrl(taskId: string) {
    return `${this.base}/crm/tasks/${taskId}/time-entries`;
  }

  list(taskId: string): Observable<TimeEntryDto[]> {
    return this.http.get<TimeEntryDto[]>(this.taskUrl(taskId));
  }

  log(taskId: string, body: TimeEntryWriteBody): Observable<TimeEntryDto> {
    return this.http.post<TimeEntryDto>(this.taskUrl(taskId), body);
  }

  delete(taskId: string, id: string): Observable<void> {
    return this.http.delete<void>(`${this.taskUrl(taskId)}/${id}`);
  }
}
```

- [ ] **Step 5: Build the Angular app**

Run: `npx ng build --configuration development`
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/models/task.model.ts \
        src/app/core/services/tasks.service.ts \
        src/app/core/services/task-types.service.ts \
        src/app/core/services/time-entries.service.ts
git commit -m "feat(tasks): add Angular task models and HTTP services"
```

---

## Task 13: TaskListComponent

**Files:**
- Create: `src/app/pages/apps/task/task-list/task-list.component.ts`

This component shows 4 collapsible sections (To Do / In Progress / Done / Deleted) with inline quick-create in "To Do", a filter bar, and a side drawer for the detail panel (which embeds `TaskDetailComponent` from Task 16).

- [ ] **Step 1: Create the component file**

```typescript
import { ChangeDetectionStrategy, Component, computed, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TasksService } from 'src/app/core/services/tasks.service';
import { TaskTypesService } from 'src/app/core/services/task-types.service';
import { TaskDto, TaskTypeDto } from 'src/app/models/task.model';
import { TaskDetailComponent } from '../task-detail/task-detail.component';

@Component({
  selector: 'app-task-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterModule,
    MatButtonModule, MatCardModule, MatChipsModule, MatExpansionModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule,
    MatSelectModule, MatSidenavModule, MatTooltipModule, TablerIconsModule,
    TaskDetailComponent,
  ],
  template: `
    <mat-sidenav-container class="task-list-container" autosize>
      <mat-sidenav-content>
        <div class="p-24">
          <!-- Header -->
          <div class="d-flex justify-content-between align-items-center m-b-16">
            <h2 class="m-0">Tasks</h2>
            <button mat-flat-button color="primary" (click)="goToNew()">
              <mat-icon>add</mat-icon> New Task
            </button>
          </div>

          <!-- Filters -->
          <mat-card class="m-b-16">
            <mat-card-content>
              <div class="d-flex gap-16 flex-wrap">
                <mat-form-field appearance="outline" class="flex-grow-1">
                  <mat-label>Search</mat-label>
                  <input matInput [(ngModel)]="searchText" (ngModelChange)="reload()" placeholder="Search title…" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Priority</mat-label>
                  <mat-select [(ngModel)]="priorityFilter" (ngModelChange)="reload()">
                    <mat-option [value]="null">All</mat-option>
                    <mat-option value="Low">Low</mat-option>
                    <mat-option value="Medium">Medium</mat-option>
                    <mat-option value="High">High</mat-option>
                    <mat-option value="Urgent">Urgent</mat-option>
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Type</mat-label>
                  <mat-select [(ngModel)]="taskTypeFilter" (ngModelChange)="reload()">
                    <mat-option [value]="null">All</mat-option>
                    @for (t of taskTypes(); track t.id) {
                      <mat-option [value]="t.id">{{ t.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </div>
            </mat-card-content>
          </mat-card>

          @if (loading()) {
            <div class="text-center p-32"><mat-spinner diameter="32"></mat-spinner></div>
          } @else {
            <!-- To Do section with inline quick-create -->
            <mat-expansion-panel [expanded]="true" class="m-b-8">
              <mat-expansion-panel-header>
                <mat-panel-title>To Do ({{ todo().length }})</mat-panel-title>
              </mat-expansion-panel-header>
              <div class="d-flex gap-8 p-y-8">
                <input class="form-control flex-grow-1" placeholder="Quick add task… press Enter"
                       [(ngModel)]="quickAddTitle" (keyup.enter)="quickAdd()" />
                <button mat-stroked-button (click)="quickAdd()" [disabled]="!quickAddTitle.trim()">Add</button>
              </div>
              <ng-container *ngTemplateOutlet="rows; context: { tasks: todo() }"></ng-container>
            </mat-expansion-panel>

            <mat-expansion-panel [expanded]="true" class="m-b-8">
              <mat-expansion-panel-header>
                <mat-panel-title>In Progress ({{ inProgress().length }})</mat-panel-title>
              </mat-expansion-panel-header>
              <ng-container *ngTemplateOutlet="rows; context: { tasks: inProgress() }"></ng-container>
            </mat-expansion-panel>

            <mat-expansion-panel class="m-b-8">
              <mat-expansion-panel-header>
                <mat-panel-title>Done ({{ done().length }})</mat-panel-title>
              </mat-expansion-panel-header>
              <ng-container *ngTemplateOutlet="rows; context: { tasks: done() }"></ng-container>
            </mat-expansion-panel>

            <mat-expansion-panel>
              <mat-expansion-panel-header>
                <mat-panel-title>Deleted ({{ deleted().length }})</mat-panel-title>
              </mat-expansion-panel-header>
              <ng-container *ngTemplateOutlet="rows; context: { tasks: deleted() }"></ng-container>
            </mat-expansion-panel>
          }

          <ng-template #rows let-tasks="tasks">
            @if (tasks.length === 0) {
              <div class="text-muted p-y-16 text-center">No tasks</div>
            } @else {
              @for (t of tasks; track t.id) {
                <div class="task-row d-flex align-items-center p-y-8 p-x-8 cursor-pointer"
                     (click)="open(t)">
                  <div class="flex-grow-1">
                    <div class="d-flex align-items-center gap-8">
                      <span class="f-w-500">{{ t.title }}</span>
                      @if (t.taskTypeName) {
                        <span class="chip" [style.background]="t.taskTypeColor">{{ t.taskTypeName }}</span>
                      }
                      @if (t.isOverdue) {
                        <span class="chip chip-danger">Overdue</span>
                      }
                    </div>
                    <small class="text-muted">{{ t.priority }} · Due: {{ t.dueDate ? (t.dueDate | date:'shortDate') : '—' }}</small>
                  </div>
                  <button mat-icon-button (click)="$event.stopPropagation(); editTask(t)" matTooltip="Edit">
                    <mat-icon>edit</mat-icon>
                  </button>
                  @if (!t.isDeleted) {
                    <button mat-icon-button (click)="$event.stopPropagation(); deleteTask(t)" matTooltip="Delete">
                      <mat-icon>delete</mat-icon>
                    </button>
                  } @else {
                    <button mat-icon-button (click)="$event.stopPropagation(); restoreTask(t)" matTooltip="Restore">
                      <mat-icon>restore</mat-icon>
                    </button>
                  }
                </div>
              }
            }
          </ng-template>
        </div>
      </mat-sidenav-content>

      <mat-sidenav #drawer mode="over" position="end" [style.width.px]="480">
        @if (selectedTask()) {
          <app-task-detail [taskId]="selectedTask()!.id" (closed)="drawer.close()" (changed)="reload()"></app-task-detail>
        }
      </mat-sidenav>
    </mat-sidenav-container>
  `,
  styles: [`
    .task-row { border-bottom: 1px solid #eee; }
    .task-row:hover { background: #f7f9fc; }
    .chip { padding: 2px 8px; border-radius: 12px; color: #fff; font-size: 11px; }
    .chip-danger { background: #ef4444; }
    .cursor-pointer { cursor: pointer; }
  `],
})
export class TaskListComponent implements OnInit {
  private tasksApi = inject(TasksService);
  private typesApi = inject(TaskTypesService);
  private router = inject(Router);

  loading = signal(true);
  allTasks = signal<TaskDto[]>([]);
  taskTypes = signal<TaskTypeDto[]>([]);
  selectedTask = signal<TaskDto | null>(null);

  searchText = '';
  priorityFilter: string | null = null;
  taskTypeFilter: string | null = null;
  quickAddTitle = '';

  todo = computed(() => this.allTasks().filter(t => t.status === 'ToDo' && !t.isDeleted));
  inProgress = computed(() => this.allTasks().filter(t => t.status === 'InProgress' && !t.isDeleted));
  done = computed(() => this.allTasks().filter(t => t.status === 'Done' && !t.isDeleted));
  deleted = computed(() => this.allTasks().filter(t => t.isDeleted));

  ngOnInit(): void {
    this.typesApi.list().subscribe(t => this.taskTypes.set(t));
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.tasksApi
      .list({
        search: this.searchText || undefined,
        priority: this.priorityFilter || undefined,
        taskTypeId: this.taskTypeFilter || undefined,
        includeDeleted: true,
      })
      .subscribe({
        next: (res) => { this.allTasks.set(res); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
  }

  open(task: TaskDto): void {
    this.selectedTask.set(task);
    // The drawer reference is opened via template binding; use ViewChild if needed
    const sidenav = document.querySelector('mat-sidenav') as any;
    sidenav?.open?.();
  }

  goToNew(): void { this.router.navigate(['/apps/task/new']); }
  editTask(t: TaskDto): void { this.router.navigate(['/apps/task', t.id]); }

  quickAdd(): void {
    const title = this.quickAddTitle.trim();
    if (!title) return;
    this.tasksApi
      .create({ title, status: 'ToDo', priority: 'Medium' })
      .subscribe(() => { this.quickAddTitle = ''; this.reload(); });
  }

  deleteTask(t: TaskDto): void {
    if (!confirm(`Delete task "${t.title}"?`)) return;
    this.tasksApi.delete(t.id).subscribe(() => this.reload());
  }

  restoreTask(t: TaskDto): void {
    this.tasksApi.restore(t.id).subscribe(() => this.reload());
  }
}

import { inject } from '@angular/core';
```

> Note: the `inject` import is grouped at the bottom for readability — adjust to the top if your linter prefers. The drawer `open()` is wired through a `@ViewChild('drawer')` reference for cleaner code; replace the `document.querySelector` line with `@ViewChild('drawer') drawer!: MatSidenav;` and call `this.drawer.open()` if your project's lint rules disallow direct DOM access.

Polish step (preferred): replace the `open()` method and template binding to use `@ViewChild`:

```typescript
import { ViewChild } from '@angular/core';
import { MatSidenav } from '@angular/material/sidenav';

// In the class:
@ViewChild('drawer') drawer!: MatSidenav;

open(task: TaskDto): void {
  this.selectedTask.set(task);
  this.drawer.open();
}
```

- [ ] **Step 2: Build**

Run: `npx ng build --configuration development`
Expected: Build succeeds.

- [ ] **Step 3: Commit (without routing yet — that comes in Task 18)**

```bash
git add src/app/pages/apps/task/task-list/
git commit -m "feat(tasks): add TaskListComponent with sections, filters, and drawer"
```

---

## Task 14: TaskKanbanComponent

**Files:**
- Create: `src/app/pages/apps/task/task-kanban/task-kanban.component.ts`

> Verify CDK is installed: `cat package.json | grep @angular/cdk` should show a version. The existing `apps/kanban` page uses `@angular/cdk/drag-drop` so it's available.

- [ ] **Step 1: Create the kanban component**

```typescript
import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule, transferArrayItem, moveItemInArray } from '@angular/cdk/drag-drop';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TasksService } from 'src/app/core/services/tasks.service';
import { TaskDto, TenantTaskStatus } from 'src/app/models/task.model';
import { inject } from '@angular/core';

@Component({
  selector: 'app-task-kanban',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, DragDropModule, MatButtonModule, MatCardModule,
    MatIconModule, MatProgressSpinnerModule, TablerIconsModule,
  ],
  template: `
    <div class="p-24">
      <div class="d-flex justify-content-between align-items-center m-b-16">
        <h2 class="m-0">Kanban Board</h2>
        <button mat-flat-button color="primary" (click)="goToNew()">
          <mat-icon>add</mat-icon> New Task
        </button>
      </div>

      @if (loading()) {
        <div class="text-center p-32"><mat-spinner diameter="32"></mat-spinner></div>
      } @else {
        <div class="kanban-board d-flex gap-16">
          @for (col of columns; track col.status) {
            <div class="kanban-column flex-grow-1">
              <div class="kanban-column-header p-12 f-w-600">
                {{ col.label }} ({{ col.tasks.length }})
              </div>
              <div class="kanban-column-body p-8"
                   cdkDropList
                   [id]="col.status"
                   [cdkDropListData]="col.tasks"
                   [cdkDropListConnectedTo]="connectedListIds"
                   (cdkDropListDropped)="onDrop($event)">
                @for (t of col.tasks; track t.id) {
                  <mat-card class="kanban-card m-b-8" cdkDrag (click)="openTask(t)">
                    <mat-card-content>
                      <div class="d-flex align-items-center gap-8">
                        <span class="priority-dot priority-{{ t.priority.toLowerCase() }}"></span>
                        <span class="f-w-500">{{ t.title }}</span>
                      </div>
                      @if (t.taskTypeName) {
                        <span class="chip m-t-4" [style.background]="t.taskTypeColor">{{ t.taskTypeName }}</span>
                      }
                      @if (t.dueDate) {
                        <small class="text-muted d-block m-t-4">
                          Due: {{ t.dueDate | date:'shortDate' }}
                          @if (t.isOverdue) { <span class="text-danger">(overdue)</span> }
                        </small>
                      }
                    </mat-card-content>
                  </mat-card>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .kanban-column { background: #f3f4f6; border-radius: 8px; min-width: 280px; }
    .kanban-column-header { background: #e5e7eb; border-radius: 8px 8px 0 0; }
    .kanban-column-body { min-height: 400px; }
    .kanban-card { cursor: pointer; }
    .chip { padding: 2px 8px; border-radius: 12px; color: #fff; font-size: 11px; }
    .priority-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .priority-low { background: #6b7280; }
    .priority-medium { background: #3b82f6; }
    .priority-high { background: #f59e0b; }
    .priority-urgent { background: #ef4444; }
  `],
})
export class TaskKanbanComponent implements OnInit {
  private tasksApi = inject(TasksService);
  private router = inject(Router);

  loading = signal(true);
  columns: { status: TenantTaskStatus; label: string; tasks: TaskDto[] }[] = [
    { status: 'ToDo', label: 'To Do', tasks: [] },
    { status: 'InProgress', label: 'In Progress', tasks: [] },
    { status: 'Done', label: 'Done', tasks: [] },
  ];
  connectedListIds = ['ToDo', 'InProgress', 'Done'];

  ngOnInit(): void {
    this.tasksApi.list({ includeDeleted: false }).subscribe({
      next: (tasks) => {
        for (const c of this.columns) c.tasks = [];
        for (const t of tasks) {
          const col = this.columns.find((c) => c.status === t.status);
          if (col) col.tasks.push(t);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onDrop(event: CdkDragDrop<TaskDto[]>): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }
    const task = event.previousContainer.data[event.previousIndex];
    const newStatus = event.container.id as TenantTaskStatus;
    transferArrayItem(event.previousContainer.data, event.container.data,
                      event.previousIndex, event.currentIndex);
    this.tasksApi.updateStatus(task.id, newStatus).subscribe({
      next: () => { /* state already moved optimistically */ },
      error: () => {
        // Rollback on failure
        transferArrayItem(event.container.data, event.previousContainer.data,
                          event.currentIndex, event.previousIndex);
      },
    });
  }

  openTask(t: TaskDto): void { this.router.navigate(['/apps/task', t.id]); }
  goToNew(): void { this.router.navigate(['/apps/task/new']); }
}
```

- [ ] **Step 2: Build**

Run: `npx ng build --configuration development`
Expected: Succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/apps/task/task-kanban/
git commit -m "feat(tasks): add TaskKanbanComponent with CDK drag-drop"
```

---

## Task 15: TaskFormComponent (create + edit)

**Files:**
- Create: `src/app/pages/apps/task/task-form/task-form.component.ts`

- [ ] **Step 1: Create the form component**

```typescript
import { ChangeDetectionStrategy, Component, OnInit, signal, inject } from '@angular/core';
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
import { TasksService } from 'src/app/core/services/tasks.service';
import { TaskTypesService } from 'src/app/core/services/task-types.service';
import { TaskTypeDto, TaskWriteBody } from 'src/app/models/task.model';

@Component({
  selector: 'app-task-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule, RouterModule,
    MatButtonModule, MatCardModule, MatDatepickerModule, MatNativeDateModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule,
    MatSelectModule,
  ],
  template: `
    <div class="p-24">
      <mat-card>
        <mat-card-content>
          <h2>{{ isEdit() ? 'Edit Task' : 'New Task' }}</h2>
          @if (loading()) {
            <div class="text-center p-32"><mat-spinner diameter="32"></mat-spinner></div>
          } @else {
            <form [formGroup]="form" (ngSubmit)="save()" class="d-flex flex-column gap-16">
              <mat-form-field appearance="outline">
                <mat-label>Title</mat-label>
                <input matInput formControlName="title" maxlength="200" />
                @if (form.controls.title.touched && form.controls.title.invalid) {
                  <mat-error>Title is required</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Description</mat-label>
                <textarea matInput formControlName="description" rows="4" maxlength="4000"></textarea>
              </mat-form-field>

              <div class="d-flex gap-16">
                <mat-form-field appearance="outline" class="flex-grow-1">
                  <mat-label>Status</mat-label>
                  <mat-select formControlName="status">
                    <mat-option value="ToDo">To Do</mat-option>
                    <mat-option value="InProgress">In Progress</mat-option>
                    <mat-option value="Done">Done</mat-option>
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline" class="flex-grow-1">
                  <mat-label>Priority</mat-label>
                  <mat-select formControlName="priority">
                    <mat-option value="Low">Low</mat-option>
                    <mat-option value="Medium">Medium</mat-option>
                    <mat-option value="High">High</mat-option>
                    <mat-option value="Urgent">Urgent</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              <div class="d-flex gap-16">
                <mat-form-field appearance="outline" class="flex-grow-1">
                  <mat-label>Type</mat-label>
                  <mat-select formControlName="taskTypeId">
                    <mat-option [value]="null">None</mat-option>
                    @for (t of taskTypes(); track t.id) {
                      <mat-option [value]="t.id">{{ t.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline" class="flex-grow-1">
                  <mat-label>Due Date</mat-label>
                  <input matInput [matDatepicker]="picker" formControlName="dueDate" />
                  <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
                  <mat-datepicker #picker></mat-datepicker>
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline">
                <mat-label>Estimated Minutes</mat-label>
                <input matInput type="number" min="1" formControlName="estimatedMinutes" />
              </mat-form-field>

              @if (errorMessage()) {
                <div class="text-danger">{{ errorMessage() }}</div>
              }

              <div class="d-flex gap-8">
                <button mat-flat-button color="primary" type="submit"
                        [disabled]="form.invalid || saving()">
                  {{ isEdit() ? 'Update' : 'Create' }}
                </button>
                <button mat-button type="button" (click)="cancel()">Cancel</button>
              </div>
            </form>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
})
export class TaskFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private tasksApi = inject(TasksService);
  private typesApi = inject(TaskTypesService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  loading = signal(true);
  saving = signal(false);
  errorMessage = signal<string | null>(null);
  taskTypes = signal<TaskTypeDto[]>([]);
  taskId = signal<string | null>(null);
  isEdit = signal(false);

  form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: [null as string | null],
    status: ['ToDo' as 'ToDo' | 'InProgress' | 'Done', Validators.required],
    priority: ['Medium' as 'Low' | 'Medium' | 'High' | 'Urgent', Validators.required],
    taskTypeId: [null as string | null],
    dueDate: [null as Date | null],
    estimatedMinutes: [null as number | null],
  });

  ngOnInit(): void {
    this.typesApi.list().subscribe(t => this.taskTypes.set(t));

    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.taskId.set(id);
      this.isEdit.set(true);
      this.tasksApi.get(id).subscribe({
        next: (task) => {
          this.form.patchValue({
            title: task.title,
            description: task.description ?? null,
            status: task.status,
            priority: task.priority,
            taskTypeId: task.taskTypeId ?? null,
            dueDate: task.dueDate ? new Date(task.dueDate) : null,
            estimatedMinutes: task.estimatedMinutes ?? null,
          });
          this.loading.set(false);
        },
        error: () => { this.errorMessage.set('Failed to load task'); this.loading.set(false); },
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
    const body: TaskWriteBody = {
      title: v.title,
      description: v.description,
      status: v.status,
      priority: v.priority,
      taskTypeId: v.taskTypeId,
      assignedToUserId: null,
      parentTaskId: null,
      dueDate: v.dueDate ? v.dueDate.toISOString() : null,
      estimatedMinutes: v.estimatedMinutes,
    };

    const op$ = this.isEdit()
      ? this.tasksApi.update(this.taskId()!, body)
      : this.tasksApi.create(body);

    op$.subscribe({
      next: () => this.router.navigate(['/apps/task']),
      error: (err) => {
        this.errorMessage.set(err?.error?.error ?? 'Save failed');
        this.saving.set(false);
      },
    });
  }

  cancel(): void { this.router.navigate(['/apps/task']); }
}
```

- [ ] **Step 2: Build**

Run: `npx ng build --configuration development`
Expected: Succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/apps/task/task-form/
git commit -m "feat(tasks): add TaskFormComponent for create and edit"
```

---

## Task 16: TaskDetailComponent (drawer body — subtasks + time log)

**Files:**
- Create: `src/app/pages/apps/task/task-detail/task-detail.component.ts`

- [ ] **Step 1: Create the detail component**

```typescript
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TasksService } from 'src/app/core/services/tasks.service';
import { TimeEntriesService } from 'src/app/core/services/time-entries.service';
import { TaskDto, TimeEntryDto } from 'src/app/models/task.model';

@Component({
  selector: 'app-task-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, MatButtonModule, MatDividerModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="p-16">
      <div class="d-flex justify-content-between align-items-center m-b-16">
        <h3 class="m-0">Task Detail</h3>
        <button mat-icon-button (click)="closed.emit()"><mat-icon>close</mat-icon></button>
      </div>

      @if (loading()) {
        <div class="text-center p-32"><mat-spinner diameter="32"></mat-spinner></div>
      } @else if (task()) {
        <div>
          <h4>{{ task()!.title }}</h4>
          @if (task()!.description) { <p>{{ task()!.description }}</p> }
          <p><strong>Status:</strong> {{ task()!.status }}</p>
          <p><strong>Priority:</strong> {{ task()!.priority }}</p>
          @if (task()!.dueDate) { <p><strong>Due:</strong> {{ task()!.dueDate | date:'mediumDate' }}</p> }
          @if (task()!.estimatedMinutes) {
            <p><strong>Estimated:</strong> {{ task()!.estimatedMinutes }} min · <strong>Logged:</strong> {{ task()!.totalLoggedMinutes }} min</p>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" [style.width.%]="progressPct()"></div>
            </div>
          }

          <mat-divider class="m-y-16"></mat-divider>

          <!-- Subtasks -->
          <div class="d-flex justify-content-between align-items-center">
            <h5 class="m-0">Subtasks ({{ task()!.children.length }})</h5>
            <button mat-stroked-button (click)="addSubtask()">+ Add subtask</button>
          </div>
          @for (child of task()!.children; track child.id) {
            <ng-container *ngTemplateOutlet="subtree; context: { node: child, depth: 0 }"></ng-container>
          }

          <ng-template #subtree let-node="node" let-depth="depth">
            <div class="subtask-row p-y-4" [style.margin-left.px]="depth * 16">
              <span>{{ node.title }} <small class="text-muted">({{ node.status }})</small></span>
              @if (node.children?.length) {
                @for (gc of node.children; track gc.id) {
                  <ng-container *ngTemplateOutlet="subtree; context: { node: gc, depth: depth + 1 }"></ng-container>
                }
              }
            </div>
          </ng-template>

          <mat-divider class="m-y-16"></mat-divider>

          <!-- Time log -->
          <h5>Time Log</h5>
          <form [formGroup]="logForm" (ngSubmit)="logTime()" class="d-flex gap-8 align-items-start m-b-8">
            <mat-form-field appearance="outline" class="flex-grow-0" style="width: 100px;">
              <mat-label>Min</mat-label>
              <input matInput type="number" min="1" formControlName="minutes" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="flex-grow-1">
              <mat-label>Notes</mat-label>
              <input matInput formControlName="notes" maxlength="500" />
            </mat-form-field>
            <button mat-stroked-button type="submit" [disabled]="logForm.invalid || logging()">Log</button>
          </form>
          @if (entries().length === 0) {
            <div class="text-muted">No time logged yet.</div>
          } @else {
            <table class="w-100 time-log-table">
              <thead><tr><th>User</th><th>Min</th><th>Notes</th><th>When</th><th></th></tr></thead>
              <tbody>
                @for (e of entries(); track e.id) {
                  <tr>
                    <td>{{ e.userName }}</td>
                    <td>{{ e.minutes }}</td>
                    <td>{{ e.notes }}</td>
                    <td>{{ e.loggedAt | date:'short' }}</td>
                    <td>
                      <button mat-icon-button (click)="deleteEntry(e)"><mat-icon>delete</mat-icon></button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .progress-bar-bg { width: 100%; height: 8px; background: #e5e7eb; border-radius: 4px; }
    .progress-bar-fill { height: 100%; background: #3b82f6; border-radius: 4px; }
    .subtask-row { border-left: 2px solid #e5e7eb; padding-left: 8px; }
    .time-log-table th, .time-log-table td { padding: 4px 8px; text-align: left; font-size: 13px; }
  `],
})
export class TaskDetailComponent implements OnChanges {
  @Input({ required: true }) taskId!: string;
  @Output() closed = new EventEmitter<void>();
  @Output() changed = new EventEmitter<void>();

  private tasksApi = inject(TasksService);
  private timeApi = inject(TimeEntriesService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  loading = signal(true);
  logging = signal(false);
  task = signal<TaskDto | null>(null);
  entries = signal<TimeEntryDto[]>([]);

  logForm = this.fb.nonNullable.group({
    minutes: [30, [Validators.required, Validators.min(1), Validators.max(24 * 60)]],
    notes: ['', Validators.maxLength(500)],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['taskId'] && this.taskId) this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.tasksApi.get(this.taskId).subscribe({
      next: (t) => { this.task.set(t); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
    this.timeApi.list(this.taskId).subscribe(e => this.entries.set(e));
  }

  progressPct(): number {
    const t = this.task();
    if (!t || !t.estimatedMinutes) return 0;
    return Math.min(100, Math.round((t.totalLoggedMinutes / t.estimatedMinutes) * 100));
  }

  addSubtask(): void {
    this.router.navigate(['/apps/task/new'], { queryParams: { parentId: this.taskId } });
  }

  logTime(): void {
    if (this.logForm.invalid || this.logging()) return;
    const v = this.logForm.getRawValue();
    this.logging.set(true);
    this.timeApi.log(this.taskId, { minutes: v.minutes, notes: v.notes || null }).subscribe({
      next: () => {
        this.logForm.reset({ minutes: 30, notes: '' });
        this.logging.set(false);
        this.reload();
        this.changed.emit();
      },
      error: () => this.logging.set(false),
    });
  }

  deleteEntry(e: TimeEntryDto): void {
    if (!confirm('Delete this time entry?')) return;
    this.timeApi.delete(this.taskId, e.id).subscribe(() => { this.reload(); this.changed.emit(); });
  }
}
```

- [ ] **Step 2: Build**

Run: `npx ng build --configuration development`
Expected: Succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/apps/task/task-detail/
git commit -m "feat(tasks): add TaskDetailComponent with subtask tree and time log"
```

---

## Task 17: TaskTypesComponent (Settings page)

**Files:**
- Create: `src/app/pages/settings/task-types/task-types.component.ts`

- [ ] **Step 1: Create the component**

```typescript
import { ChangeDetectionStrategy, Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { TaskTypesService } from 'src/app/core/services/task-types.service';
import { TaskTypeDto } from 'src/app/models/task.model';

@Component({
  selector: 'app-task-types',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule,
    MatButtonModule, MatCardModule, MatFormFieldModule,
    MatIconModule, MatInputModule, MatSlideToggleModule, MatTableModule,
  ],
  template: `
    <div class="p-24">
      <h2>Task Types</h2>
      <p class="text-muted">Define custom categories for tasks (e.g. Bug, Feature, Research).</p>

      <mat-card class="m-b-16">
        <mat-card-content>
          <h4>Add new type</h4>
          <form [formGroup]="form" (ngSubmit)="save()" class="d-flex gap-16 align-items-end">
            <mat-form-field appearance="outline" class="flex-grow-1">
              <mat-label>Name</mat-label>
              <input matInput formControlName="name" maxlength="100" />
            </mat-form-field>
            <mat-form-field appearance="outline" style="width: 140px;">
              <mat-label>Color (hex)</mat-label>
              <input matInput formControlName="color" placeholder="#3B82F6" />
            </mat-form-field>
            <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving()">Add</button>
          </form>
          @if (errorMessage()) { <div class="text-danger m-t-8">{{ errorMessage() }}</div> }
        </mat-card-content>
      </mat-card>

      <mat-card>
        <mat-card-content>
          @if (types().length === 0) {
            <div class="text-muted">No task types yet.</div>
          } @else {
            <table mat-table [dataSource]="types()" class="w-100">
              <ng-container matColumnDef="color">
                <th mat-header-cell *matHeaderCellDef>Color</th>
                <td mat-cell *matCellDef="let t">
                  <span class="swatch" [style.background]="t.color"></span>
                </td>
              </ng-container>
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Name</th>
                <td mat-cell *matCellDef="let t">{{ t.name }}</td>
              </ng-container>
              <ng-container matColumnDef="active">
                <th mat-header-cell *matHeaderCellDef>Active</th>
                <td mat-cell *matCellDef="let t">
                  <mat-slide-toggle [checked]="t.isActive" (change)="toggleActive(t, $event.checked)"></mat-slide-toggle>
                </td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let t">
                  <button mat-icon-button (click)="remove(t)"><mat-icon>delete</mat-icon></button>
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
    .swatch { display: inline-block; width: 20px; height: 20px; border-radius: 4px; }
  `],
})
export class TaskTypesComponent implements OnInit {
  private api = inject(TaskTypesService);
  private fb = inject(FormBuilder);

  types = signal<TaskTypeDto[]>([]);
  saving = signal(false);
  errorMessage = signal<string | null>(null);
  displayedColumns = ['color', 'name', 'active', 'actions'];

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    color: ['#3B82F6', [Validators.required, Validators.pattern(/^#[0-9A-Fa-f]{6}$/)]],
  });

  ngOnInit(): void { this.reload(); }

  reload(): void {
    this.api.list().subscribe(t => this.types.set(t));
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.errorMessage.set(null);
    const v = this.form.getRawValue();
    this.api.create({ name: v.name, color: v.color }).subscribe({
      next: () => { this.form.reset({ name: '', color: '#3B82F6' }); this.saving.set(false); this.reload(); },
      error: (err) => { this.errorMessage.set(err?.error?.error ?? 'Save failed'); this.saving.set(false); },
    });
  }

  toggleActive(t: TaskTypeDto, isActive: boolean): void {
    this.api.update(t.id, { name: t.name, color: t.color, isActive }).subscribe(() => this.reload());
  }

  remove(t: TaskTypeDto): void {
    if (!confirm(`Delete task type "${t.name}"?`)) return;
    this.api.delete(t.id).subscribe({
      next: () => this.reload(),
      error: (err) => alert(err?.error?.error ?? 'Delete failed'),
    });
  }
}
```

- [ ] **Step 2: Build**

Run: `npx ng build --configuration development`
Expected: Succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/settings/task-types/
git commit -m "feat(tasks): add TaskTypesComponent settings page"
```

---

## Task 18: Routing and Sidebar Wiring

**Files:**
- Modify: `src/app/pages/apps/apps.routes.ts`
- Modify: `src/app/app.routes.ts` (only if `settings` route group is missing)
- Modify: `src/app/layouts/full/vertical/sidebar/sidebar-data.ts`

> Verify before editing: open `apps.routes.ts` and confirm exact format. The existing structure shows `path: 'todo' → AppTodoComponent` and `path: 'kanban' → AppKanbanComponent` as eager routes.

- [ ] **Step 1: Update `src/app/pages/apps/apps.routes.ts` — add task routes and repoint kanban**

Find the existing `Routes` array and add the following entries (the order matters for `task/new` vs `task/:id`):

```typescript
// New task routes — add inside the AppsRoutes Routes array
{
  path: 'task',
  loadComponent: () =>
    import('./task/task-list/task-list.component').then((m) => m.TaskListComponent),
  data: { title: 'Tasks', breadcrumb: 'Tasks' },
},
{
  path: 'task/new',
  loadComponent: () =>
    import('./task/task-form/task-form.component').then((m) => m.TaskFormComponent),
  data: { title: 'New Task', breadcrumb: 'New Task' },
},
{
  path: 'task/:id',
  loadComponent: () =>
    import('./task/task-form/task-form.component').then((m) => m.TaskFormComponent),
  data: { title: 'Edit Task', breadcrumb: 'Edit Task' },
},
```

Then **replace** the existing `kanban` route to point to the new component:

```typescript
{
  path: 'kanban',
  loadComponent: () =>
    import('./task/task-kanban/task-kanban.component').then((m) => m.TaskKanbanComponent),
  data: { title: 'Kanban Board', breadcrumb: 'Kanban' },
},
```

If the existing `todo` route uses `component: AppTodoComponent` (eager), leave the import in place (don't break anything else that uses it) but optionally add a redirect:

```typescript
{ path: 'todo', redirectTo: 'task', pathMatch: 'full' },
```

(Remove the eager `AppTodoComponent` route if doing the redirect; otherwise the redirect won't fire because the old route matches first.)

- [ ] **Step 2: Confirm or add the settings route group**

Run: `find src/app -name "settings*.routes.ts"` (or open `app.routes.ts` and search for `'settings'`).

If a `settings` route group already exists (e.g. `loadChildren: () => import('./pages/settings/settings.routes')...`), **add** to that file:

```typescript
{
  path: 'task-types',
  loadComponent: () =>
    import('./task-types/task-types.component').then((m) => m.TaskTypesComponent),
  data: { title: 'Task Types', breadcrumb: 'Task Types' },
},
```

If no settings route group exists yet, add this top-level entry to `src/app/app.routes.ts` inside the `FullComponent` children array (next to `apps`, `crm`):

```typescript
{
  path: 'settings',
  children: [
    {
      path: 'task-types',
      loadComponent: () =>
        import('./pages/settings/task-types/task-types.component').then((m) => m.TaskTypesComponent),
      data: { title: 'Task Types', breadcrumb: 'Task Types' },
    },
  ],
},
```

- [ ] **Step 3: Update sidebar — repoint Tasks entry and add Task Types**

Open `src/app/layouts/full/vertical/sidebar/sidebar-data.ts`. Find the Operations section's "Tasks" entry (currently `route: 'apps/todo'`) and change to `apps/task`:

```typescript
{
  id: 6,
  displayName: 'Tasks',
  iconName: 'solar:checklist-minimalistic-line-duotone',
  route: 'apps/task',
},
```

In the Settings section (id: 9, the bigger collapsible Settings menu near the bottom), add a new entry after "Scheduled Tasks":

```typescript
{
  displayName: 'Task Types',
  iconName: 'solar:tag-line-duotone',
  route: '/settings/task-types',
},
```

- [ ] **Step 4: Build the Angular app**

Run: `npx ng build --configuration development`
Expected: Build succeeds.

- [ ] **Step 5: Smoke-test in browser**

Start backend (`dotnet run --project TravelCrm.Api`) and frontend (`npx ng serve`). Navigate to:
- `http://localhost:4200/apps/task` — list page renders, sections show
- `http://localhost:4200/apps/task/new` — form renders, can create a task
- `http://localhost:4200/apps/kanban` — kanban renders, can drag a card between columns
- `http://localhost:4200/settings/task-types` — settings page renders, can add a type
- Click a task in the list — drawer opens with detail and time-log form
- Sidebar — "Tasks" link in Operations and "Task Types" under Settings both navigate correctly

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/apps/apps.routes.ts \
        src/app/app.routes.ts \
        src/app/layouts/full/vertical/sidebar/sidebar-data.ts
git commit -m "feat(tasks): wire task routes and sidebar entries"
```

---

## Final verification

- [ ] **All tests pass**

Run: `dotnet test TravelCrm.Tests -v minimal`
Expected: All Lead, Task, TaskType, TimeEntry tests pass.

- [ ] **Backend builds clean**

Run: `dotnet build TravelCrm.Api`
Expected: 0 warnings, 0 errors.

- [ ] **Angular builds clean**

Run: `npx ng build --configuration production`
Expected: Build succeeds.

- [ ] **End-to-end smoke**

Start API + Angular. Log in as a tenant admin user with `crm.tasks.view`, `crm.tasks.manage`, `crm.tasks.admin` permissions. Verify:
1. Create a task type at `/settings/task-types`
2. Create a task at `/apps/task/new` with the new type
3. Verify task appears in `/apps/task` "To Do" section
4. Open the side drawer and log 30 minutes
5. Drag the task on `/apps/kanban` from To Do → Done
6. Verify status updates persist on refresh
7. Soft-delete the task; confirm it appears in the "Deleted" section; restore it

---

## Permissions seed (one-time check)

If `crm.tasks.view`, `crm.tasks.manage`, and `crm.tasks.admin` aren't yet defined in your permissions seed/registry, add them. Look for the file that registers `crm.leads.view` etc. (likely `TravelCrm.Api/Infrastructure/Security/Permissions.cs` or a seed in `Infrastructure/Persistence/Seeders/`) and append the three new slugs. Without this, all task endpoints will return 403.
