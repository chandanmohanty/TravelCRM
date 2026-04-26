using FluentAssertions;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.TimeEntries.Commands;
using TravelCrm.Api.Features.TimeEntries.Queries;
using TravelCrm.Api.Infrastructure.Persistence;

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
        var task = SeedTask(db, tenantId, user.UserId);
        var handler = new LogTimeHandler(db, new FakeTenantContext(tenantId), user);

        var result = await handler.Handle(new LogTimeCommand(task.Id, 30, "did stuff"), default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Minutes.Should().Be(30);
        db.TimeEntries.Should().ContainSingle(te =>
            te.TaskId == task.Id && te.Minutes == 30 && te.UserId == user.UserId);
    }

    [Fact]
    public async Task LogTime_OnDeletedTask_ReturnsFailure()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var task = SeedTask(db, tenantId, user.UserId);
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
        var task = SeedTask(db, tenantId, user.UserId);
        db.TimeEntries.Add(new TimeEntry
        {
            Id = Guid.NewGuid(), TenantId = tenantId, TaskId = task.Id, UserId = user.UserId,
            Minutes = 15, LoggedAt = DateTime.UtcNow,
        });
        db.TimeEntries.Add(new TimeEntry
        {
            Id = Guid.NewGuid(), TenantId = tenantId, TaskId = task.Id, UserId = user.UserId,
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
        var task = SeedTask(db, tenantId, user.UserId);
        var teId = Guid.NewGuid();
        db.TimeEntries.Add(new TimeEntry
        {
            Id = teId, TenantId = tenantId, TaskId = task.Id, UserId = user.UserId,
            Minutes = 15, LoggedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var handler = new DeleteTimeEntryHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new DeleteTimeEntryCommand(task.Id, teId), default);

        result.IsSuccess.Should().BeTrue();
        db.TimeEntries.Find(teId).Should().BeNull();
    }
}
