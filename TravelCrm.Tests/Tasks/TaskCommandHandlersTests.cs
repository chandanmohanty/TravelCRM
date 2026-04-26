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
            Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Medium, CreatedByUserId = user.UserId,
        });
        await db.SaveChangesAsync();

        var handler = new CreateTaskHandler(db, new FakeTenantContext(tenantId), user);
        var cmd = ValidCreate("Sub") with { ParentTaskId = parentId };
        var result = await handler.Handle(cmd, default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.ParentTaskId.Should().Be(parentId);
    }

    [Fact]
    public async Task UpdateTask_ChangesFields_AndPersists()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var taskId = Guid.NewGuid();
        db.TenantTasks.Add(new TenantTask
        {
            Id = taskId, TenantId = tenantId, Title = "Old title",
            Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Low, CreatedByUserId = user.UserId,
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
            Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Medium, CreatedByUserId = user.UserId,
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
            CreatedByUserId = user.UserId, AssignedToUserId = null,
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
            CreatedByUserId = user.UserId, AssignedToUserId = assignee,
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
            Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Medium, CreatedByUserId = user.UserId,
        });
        await db.SaveChangesAsync();

        var handler = new UpdateTaskStatusHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new UpdateTaskStatusCommand(taskId, "Bogus"), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("status");
    }
}
