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

        db.TaskTypes.Add(new TaskType { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Bug", Color = "#FF0000", IsActive = true });
        db.TaskTypes.Add(new TaskType { Id = Guid.NewGuid(), TenantId = otherTenantId, Name = "Other", Color = "#00FF00", IsActive = true });
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
        db.TaskTypes.Add(new TaskType { Id = id, TenantId = tenantId, Name = "Old", Color = "#000000", IsActive = true });
        await db.SaveChangesAsync();

        var handler = new UpdateTaskTypeHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new UpdateTaskTypeCommand(id, "New", "#FFFFFF", false), default);

        result.IsSuccess.Should().BeTrue();
        var fresh = db.TaskTypes.Find(id)!;
        fresh.Name.Should().Be("New");
        fresh.Color.Should().Be("#FFFFFF");
        fresh.IsActive.Should().BeFalse();
    }

    [Fact]
    public async Task DeleteTaskType_WhenInUse_ReturnsConflict()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var typeId = Guid.NewGuid();
        db.TaskTypes.Add(new TaskType { Id = typeId, TenantId = tenantId, Name = "InUse", Color = "#000000", IsActive = true });
        db.TenantTasks.Add(new TenantTask
        {
            Id = Guid.NewGuid(), TenantId = tenantId, Title = "T",
            Status = TenantTaskStatus.ToDo, Priority = TenantTaskPriority.Medium,
            CreatedByUserId = user.UserId, TaskTypeId = typeId,
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
        db.TaskTypes.Add(new TaskType { Id = typeId, TenantId = tenantId, Name = "Unused", Color = "#000000", IsActive = true });
        await db.SaveChangesAsync();

        var handler = new DeleteTaskTypeHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new DeleteTaskTypeCommand(typeId), default);

        result.IsSuccess.Should().BeTrue();
        db.TaskTypes.Find(typeId).Should().BeNull();
    }
}
