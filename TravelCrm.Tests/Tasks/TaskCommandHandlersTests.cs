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
}
