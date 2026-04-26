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
            CreatedByUserId = user.UserId, IsDeleted = false,
        });
        db.TenantTasks.Add(new TenantTask
        {
            Id = Guid.NewGuid(), TenantId = tenantId, Title = "Trashed",
            Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Medium,
            CreatedByUserId = user.UserId, IsDeleted = true,
        });
        db.TenantTasks.Add(new TenantTask
        {
            Id = Guid.NewGuid(), TenantId = otherTenantId, Title = "Other tenant",
            Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Medium,
            CreatedByUserId = user.UserId, IsDeleted = false,
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
            CreatedByUserId = user.UserId, IsDeleted = false,
        });
        db.TenantTasks.Add(new TenantTask
        {
            Id = Guid.NewGuid(), TenantId = tenantId, Title = "Trashed",
            Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Medium,
            CreatedByUserId = user.UserId, IsDeleted = true,
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
            Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Medium, CreatedByUserId = user.UserId,
        });
        db.TenantTasks.Add(new TenantTask
        {
            Id = Guid.NewGuid(), TenantId = tenantId, Title = "Child",
            Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Medium,
            CreatedByUserId = user.UserId, ParentTaskId = parentId,
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
            Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Medium, CreatedByUserId = user.UserId,
        });
        await db.SaveChangesAsync();

        var handler = new GetTaskHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new GetTaskQuery(taskId), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("not found");
    }

    [Fact]
    public async Task ListTasks_WithSearch_ReturnsOnlyMatchingTitles()
    {
        var (db, tenant, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);

        db.TenantTasks.Add(new TenantTask
        {
            Id = Guid.NewGuid(), TenantId = tenantId, Title = "Build deployment pipeline",
            Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Medium, CreatedByUserId = user.UserId,
        });
        db.TenantTasks.Add(new TenantTask
        {
            Id = Guid.NewGuid(), TenantId = tenantId, Title = "Fix login bug",
            Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Medium, CreatedByUserId = user.UserId,
        });
        db.TenantTasks.Add(new TenantTask
        {
            Id = Guid.NewGuid(), TenantId = tenantId, Title = "Refactor invoice service",
            Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Medium, CreatedByUserId = user.UserId,
        });
        await db.SaveChangesAsync();

        var handler = new ListTasksHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(
            new ListTasksQuery("invoice", null, null, null, null, false), default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Should().HaveCount(1);
        result.Value!.Single().Title.Should().Be("Refactor invoice service");
    }
}
