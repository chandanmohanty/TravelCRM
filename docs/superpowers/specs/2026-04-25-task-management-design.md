# Task Management Module — Design Spec

**Date:** 2026-04-25  
**Project:** TravelCRMPlus  
**Scope:** Tenant-scoped task management with assignments, subtasks, time tracking, and overdue notifications

---

## Overview

A lightweight, fast task management module embedded in the existing TravelCRMPlus multi-tenant SaaS platform. Each tenant's users can create tasks, assign them to colleagues within the same tenant, track time, and organise work via a list view or Kanban board. Subtasks are multi-level (recursive). Task types are user-defined per tenant.

---

## Section 1 — Data Model

### `TenantTask`

| Column | Type | Notes |
|---|---|---|
| `Id` | `Guid` | PK |
| `TenantId` | `Guid` | FK → Tenant, required |
| `Title` | `string` (200) | Required |
| `Description` | `string?` (4000) | Optional rich text |
| `Status` | `TaskStatus` (enum, int) | `ToDo = 0`, `InProgress = 1`, `Done = 2` |
| `Priority` | `TaskPriority` (enum, int) | `Low = 0`, `Medium = 1`, `High = 2`, `Urgent = 3` |
| `TaskTypeId` | `Guid?` | FK → `TaskType`, nullable |
| `AssignedToUserId` | `Guid?` | FK → `ApplicationUser`, nullable |
| `CreatedByUserId` | `Guid` | FK → `ApplicationUser`, required |
| `ParentTaskId` | `Guid?` | Self-referencing FK for subtasks, nullable |
| `DueDate` | `DateTime?` | UTC, optional |
| `EstimatedMinutes` | `int?` | Optional effort estimate |
| `IsDeleted` | `bool` | Soft delete flag, default `false` |
| `IsOverdueSent` | `bool` | Tracks whether overdue notification was fired, default `false` |
| `CreatedAt` | `DateTime` | UTC, set by `IAuditableEntity` |
| `UpdatedAt` | `DateTime` | UTC, set by `IAuditableEntity` |

Navigation properties: `Children` (`ICollection<TenantTask>`), `TimeEntries` (`ICollection<TimeEntry>`), `Parent` (`TenantTask?`), `TaskType` (`TaskType?`).

EF config: snake_case table `tenant_tasks`. `ParentTaskId` → self-referencing optional FK. No EF global query filter on `IsDeleted` (handled explicitly per handler for predictability). `Status` and `Priority` stored as `int`.

### `TaskType`

| Column | Type | Notes |
|---|---|---|
| `Id` | `Guid` | PK |
| `TenantId` | `Guid` | Required |
| `Name` | `string` (100) | Required, e.g. "Bug", "Feature" |
| `Color` | `string` (7) | Hex color, e.g. `#3B82F6` |
| `IsActive` | `bool` | Soft-disable without deleting, default `true` |
| `CreatedAt` | `DateTime` | UTC |

Table: `task_types`.

### `TimeEntry`

| Column | Type | Notes |
|---|---|---|
| `Id` | `Guid` | PK |
| `TenantId` | `Guid` | Required |
| `TaskId` | `Guid` | FK → `TenantTask` |
| `UserId` | `Guid` | FK → `ApplicationUser` |
| `Minutes` | `int` | Required, > 0 |
| `Notes` | `string?` (500) | Optional description of work done |
| `LoggedAt` | `DateTime` | UTC timestamp of when entry was logged |

Table: `time_entries`.

---

## Section 2 — Backend API

### Feature folders

```
TravelCrm.Application/Features/Tasks/
  Commands/
    CreateTask/         CreateTaskCommand, CreateTaskHandler
    UpdateTask/         UpdateTaskCommand, UpdateTaskHandler
    UpdateTaskStatus/   UpdateTaskStatusCommand, UpdateTaskStatusHandler  ← PATCH for kanban
    DeleteTask/         DeleteTaskCommand, DeleteTaskHandler              ← soft delete
    RestoreTask/        RestoreTaskCommand, RestoreTaskHandler
  Queries/
    ListTasks/          ListTasksQuery, ListTasksHandler                  ← includes soft-deleted section
    GetTask/            GetTaskQuery, GetTaskHandler

TravelCrm.Application/Features/TaskTypes/
  Commands/
    CreateTaskType/     CreateTaskTypeCommand, CreateTaskTypeHandler
    UpdateTaskType/     UpdateTaskTypeCommand, UpdateTaskTypeHandler
    DeleteTaskType/     DeleteTaskTypeCommand, DeleteTaskTypeHandler
  Queries/
    ListTaskTypes/      ListTaskTypesQuery, ListTaskTypesHandler

TravelCrm.Application/Features/TimeEntries/
  Commands/
    LogTime/            LogTimeCommand, LogTimeHandler
    DeleteTimeEntry/    DeleteTimeEntryCommand, DeleteTimeEntryHandler
  Queries/
    ListTimeEntries/    ListTimeEntriesQuery, ListTimeEntriesHandler
```

### Controller endpoints

**`/api/tasks`**

| Method | Route | Handler | Permission |
|---|---|---|---|
| GET | `/api/tasks` | `ListTasksQuery` | `crm.tasks.view` |
| GET | `/api/tasks/{id}` | `GetTaskQuery` | `crm.tasks.view` |
| POST | `/api/tasks` | `CreateTaskCommand` | `crm.tasks.manage` |
| PUT | `/api/tasks/{id}` | `UpdateTaskCommand` | `crm.tasks.manage` |
| PATCH | `/api/tasks/{id}/status` | `UpdateTaskStatusCommand` | `crm.tasks.manage` |
| DELETE | `/api/tasks/{id}` | `DeleteTaskCommand` (soft) | `crm.tasks.manage` |
| POST | `/api/tasks/{id}/restore` | `RestoreTaskCommand` | `crm.tasks.manage` |

**`/api/task-types`**

| Method | Route | Handler | Permission |
|---|---|---|---|
| GET | `/api/task-types` | `ListTaskTypesQuery` | `crm.tasks.view` |
| POST | `/api/task-types` | `CreateTaskTypeCommand` | `crm.tasks.admin` |
| PUT | `/api/task-types/{id}` | `UpdateTaskTypeCommand` | `crm.tasks.admin` |
| DELETE | `/api/task-types/{id}` | `DeleteTaskTypeCommand` | `crm.tasks.admin` |

**`/api/tasks/{taskId}/time-entries`**

| Method | Route | Handler | Permission |
|---|---|---|---|
| GET | `/api/tasks/{taskId}/time-entries` | `ListTimeEntriesQuery` | `crm.tasks.view` |
| POST | `/api/tasks/{taskId}/time-entries` | `LogTimeCommand` | `crm.tasks.manage` |
| DELETE | `/api/tasks/{taskId}/time-entries/{id}` | `DeleteTimeEntryCommand` | `crm.tasks.manage` |

### DTOs

```csharp
// Task list/detail DTO
record TaskDto(
    Guid Id,
    string Title,
    string? Description,
    string Status,           // "ToDo" | "InProgress" | "Done"
    string Priority,         // "Low" | "Medium" | "High" | "Urgent"
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
    int TotalLoggedMinutes,  // sum of time entries
    bool IsOverdue,          // computed: DueDate < now && Status != Done
    bool IsDeleted,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    List<TaskDto> Children   // recursive subtask tree (populated in GetTask, empty list in ListTasks)
);

// Time entry DTO
record TimeEntryDto(
    Guid Id,
    Guid TaskId,
    Guid UserId,
    string UserName,
    int Minutes,
    string? Notes,
    DateTime LoggedAt
);

// Task type DTO
record TaskTypeDto(Guid Id, string Name, string Color, bool IsActive);
```

### `ListTasksQuery` parameters

```csharp
record ListTasksQuery(
    string? Search,
    string? Status,          // filter by status
    string? Priority,
    Guid? AssignedToUserId,
    Guid? TaskTypeId,
    bool IncludeDeleted,     // false by default; true returns deleted tasks section
    int Page,
    int PageSize
) : IRequest<Result<PagedResult<TaskDto>>>;
```

`ListTasks` returns **flat list** (no `Children` populated). `GetTask` returns the full tree by recursively loading children.

### `IsOverdue` computation

Computed in `TaskMapper.ToDto()`:

```csharp
IsOverdue = task.DueDate.HasValue
    && task.DueDate.Value < DateTime.UtcNow
    && task.Status != TaskStatus.Done
```

### `OverdueTasksJob`

Hangfire recurring job registered in `Program.cs` / `HangfireConfig`:

```csharp
RecurringJob.AddOrUpdate<OverdueTasksJob>(
    "overdue-tasks-check",
    job => job.ExecuteAsync(),
    Cron.Daily);   // runs at midnight UTC
```

`OverdueTasksJob.ExecuteAsync()`:
1. Query all non-deleted, non-Done tasks across all tenants where `DueDate < DateTime.UtcNow` and `IsOverdueSent == false`
2. For each task, call `INotificationService.SendAsync(assigneeId, "Task overdue: {title}")` and `INotificationService.SendAsync(createdByUserId, "Task overdue: {title}")`
3. Set `task.IsOverdueSent = true`
4. `SaveChangesAsync()`

---

## Section 3 — Frontend Architecture

### Angular services (`src/app/pages/apps/task/`)

| Service | File | Responsibility |
|---|---|---|
| `TasksService` | `tasks.service.ts` | CRUD + status PATCH + restore |
| `TaskTypesService` | `task-types.service.ts` | CRUD for task types |
| `TimeEntriesService` | `time-entries.service.ts` | Log + delete time entries |

All services inject `HttpClient` and `API_BASE_URL` token. Return `Observable<T>`.

### Angular models (`src/app/models/task.model.ts`)

```typescript
export type TaskStatus   = 'ToDo' | 'InProgress' | 'Done';
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  taskTypeId?: string;
  taskTypeName?: string;
  taskTypeColor?: string;
  assignedToUserId?: string;
  assignedToUserName?: string;
  createdByUserId: string;
  createdByUserName: string;
  parentTaskId?: string;
  dueDate?: string;         // ISO 8601
  estimatedMinutes?: number;
  totalLoggedMinutes: number;
  isOverdue: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  children: Task[];
}

export interface TaskType {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
}

export interface TimeEntry {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  minutes: number;
  notes?: string;
  loggedAt: string;
}
```

### Components

| Component | Route | Replaces |
|---|---|---|
| `TaskListComponent` | `apps/task` | Existing `apps/todo` mock |
| `TaskKanbanComponent` | `apps/kanban` | Existing `apps/kanban` mock |
| `TaskFormComponent` | `apps/task/new`, `apps/task/:id` | New |
| `TaskDetailComponent` | (modal/panel from list) | New |
| `TaskTypesComponent` | `settings/task-types` | New |

**`TaskListComponent`** (`task-list.component.ts`)  
Four collapsible sections: `To Do`, `In Progress`, `Done`, `Deleted`. Each section shows count badge. Inline quick-create row in "To Do" section (title input only, saves on Enter). Filter bar: search, status, priority, assignee, task type. Clicking a row opens `TaskDetailComponent` as a side panel.

**`TaskKanbanComponent`** (`task-kanban.component.ts`)  
Three columns (To Do / In Progress / Done). CDK drag-drop (`cdkDropList`, `cdkDrag`). On drop, calls `TasksService.updateStatus(id, newStatus)`. Cards show title, priority badge, assignee avatar, due date, overdue indicator.

**`TaskFormComponent`** (`task-form.component.ts`)  
Reactive form. Fields: title (required), description (textarea), status, priority, task type (select from `TaskType[]`), assignee (select from tenant users), parent task (optional autocomplete), due date (date picker), estimated minutes. Create and update modes via presence of `:id` param.

**`TaskDetailComponent`** (`task-detail.component.ts`)  
Right-side panel showing full task detail. Recursive subtask tree — each subtask row has expand/collapse toggle; "Add subtask" button creates child with `parentTaskId` pre-filled. Time log section below the detail: table of `TimeEntry[]` with "Log Time" button opening inline form (minutes + notes). Shows `totalLoggedMinutes` vs `estimatedMinutes` progress bar.

**`TaskTypesComponent`** (`task-types.component.ts`)  
Settings page under Settings → Task Types. Table of task types with name, color swatch, active toggle. Add/edit inline or via small dialog. Delete disabled if type is used by existing tasks (backend returns 409).

### Routing additions

In `crm.routes.ts` (or a new `apps/task/task.routes.ts`):

```typescript
{ path: 'apps/task',        loadComponent: () => TaskListComponent }
{ path: 'apps/task/new',    loadComponent: () => TaskFormComponent }
{ path: 'apps/task/:id',    loadComponent: () => TaskFormComponent }
{ path: 'apps/kanban',      loadComponent: () => TaskKanbanComponent }
{ path: 'settings/task-types', loadComponent: () => TaskTypesComponent }
```

`apps/task/new` must appear **before** `apps/task/:id` to avoid "new" being captured as an ID param.

### Sidebar wiring

The existing `apps/todo` entry in `sidebar-data.ts` (Operations section, id: 6) is updated to point to `apps/task`. The existing `apps/kanban` entry remains. A "Task Types" entry is added under Settings with `route: 'settings/task-types'` and `id: 9`.

---

## Section 4 — Notifications + Overdue Detection

### Notification triggers

| Event | Recipients | Message template |
|---|---|---|
| Task assigned | Assignee | `"You've been assigned: {task.Title}"` |
| Status changed | Creator + assignee | `"{actorName} changed '{task.Title}' to {newStatus}"` |
| Task overdue | Creator + assignee | `"Task overdue: '{task.Title}' was due {dueDate}"` |

Notifications are dispatched via `INotificationService.SendAsync(userId, tenantId, message)`. This abstraction is assumed to already exist (or will be created as a thin wrapper storing to a `TenantNotification` table). No SignalR/WebSocket push in v1 — frontend polls on load.

### `OverdueTasksJob` detail

```csharp
public class OverdueTasksJob(ApplicationDbContext db, INotificationService notifications)
{
    public async Task ExecuteAsync()
    {
        var now = DateTime.UtcNow;
        var overdueTasks = await db.TenantTasks
            .Where(t => !t.IsDeleted
                     && t.Status != TaskStatus.Done
                     && t.DueDate.HasValue
                     && t.DueDate < now
                     && !t.IsOverdueSent)
            .ToListAsync();

        foreach (var task in overdueTasks)
        {
            var msg = $"Task overdue: '{task.Title}'";
            if (task.AssignedToUserId.HasValue)
                await notifications.SendAsync(task.AssignedToUserId.Value, task.TenantId, msg);
            await notifications.SendAsync(task.CreatedByUserId, task.TenantId, msg);
            task.IsOverdueSent = true;
        }

        await db.SaveChangesAsync();
    }
}
```

Registered as a daily Hangfire recurring job at midnight UTC.

### `IsOverdue` read-only flag

Computed in mapper, no DB column:

```csharp
IsOverdue = task.DueDate.HasValue
          && task.DueDate.Value < DateTime.UtcNow
          && task.Status != TaskStatus.Done
```

---

## Out of Scope (v1)

- Real-time push notifications (SignalR)
- File attachments on tasks
- Task comments/activity feed
- Recurring tasks
- Calendar integration for due dates
- Export to CSV/PDF
- Per-task permission overrides (access is tenant-wide)
