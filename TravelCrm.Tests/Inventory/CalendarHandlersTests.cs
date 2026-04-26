using FluentAssertions;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Features.Inventory.Calendar.Commands;
using TravelCrm.Api.Features.Inventory.Calendar.Queries;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Tests.Inventory;

public class CalendarHandlersTests
{
    private static Guid SeedPool(ApplicationDbContext db, Guid tenantId, int capacity = 10)
    {
        var id = Guid.NewGuid();
        db.PoolResources.Add(new PoolResource
        {
            Id = id, TenantId = tenantId, Type = "RoomType", Name = "Deluxe",
            DefaultCapacity = capacity, Status = ResourceStatus.Active,
        });
        db.SaveChanges();
        return id;
    }

    [Fact]
    public async Task SetCapacity_InsertsRow()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var resourceId = SeedPool(db, tenantId);

        var handler = new SetCapacityHandler(db, new FakeTenantContext(tenantId), user);
        var date = new DateOnly(2026, 5, 1);
        var result = await handler.Handle(new SetCapacityCommand(resourceId, date, null, 25, "festival"), default);

        result.IsSuccess.Should().BeTrue();
        var row = db.ResourceCalendar.Single();
        row.Capacity.Should().Be(25);
        row.Notes.Should().Be("festival");
    }

    [Fact]
    public async Task SetCapacity_Upserts_ExistingRow()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var resourceId = SeedPool(db, tenantId);
        var date = new DateOnly(2026, 5, 1);
        db.ResourceCalendar.Add(new ResourceCalendar
        {
            Id = Guid.NewGuid(), TenantId = tenantId,
            ResourceId = resourceId, Date = date, Slot = null, Capacity = 5,
        });
        await db.SaveChangesAsync();

        var handler = new SetCapacityHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new SetCapacityCommand(resourceId, date, null, 50, null), default);

        result.IsSuccess.Should().BeTrue();
        db.ResourceCalendar.Should().ContainSingle();
        db.ResourceCalendar.Single().Capacity.Should().Be(50);
    }

    [Fact]
    public async Task BlockDate_FlagsRowAsBlocked()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var resourceId = SeedPool(db, tenantId);

        var handler = new BlockDateHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(
            new BlockDateCommand(resourceId, new DateOnly(2026, 5, 1), null, "stop sale"), default);

        result.IsSuccess.Should().BeTrue();
        var row = db.ResourceCalendar.Single();
        row.IsBlocked.Should().BeTrue();
        row.Notes.Should().Be("stop sale");
    }

    [Fact]
    public async Task UnblockDate_ClearsBlockedFlag()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var resourceId = SeedPool(db, tenantId);
        var date = new DateOnly(2026, 5, 1);
        db.ResourceCalendar.Add(new ResourceCalendar
        {
            Id = Guid.NewGuid(), TenantId = tenantId,
            ResourceId = resourceId, Date = date, Slot = null, Capacity = 10, IsBlocked = true,
        });
        await db.SaveChangesAsync();

        var handler = new UnblockDateHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new UnblockDateCommand(resourceId, date, null), default);

        result.IsSuccess.Should().BeTrue();
        db.ResourceCalendar.Single().IsBlocked.Should().BeFalse();
    }

    [Fact]
    public async Task CheckAvailability_ReturnsPerDateBuckets()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var resourceId = SeedPool(db, tenantId, 10);

        var handler = new CheckAvailabilityHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(
            new CheckAvailabilityQuery(resourceId, new DateOnly(2026, 5, 1), new DateOnly(2026, 5, 3)), default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Should().HaveCount(3);
        result.Value!.All(a => a.Capacity == 10 && a.Available == 10 && !a.IsBlocked).Should().BeTrue();
    }
}
