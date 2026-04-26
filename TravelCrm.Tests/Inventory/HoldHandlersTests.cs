using FluentAssertions;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Features.Inventory.Holds.Commands;
using TravelCrm.Api.Features.Inventory.Holds.Queries;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Tests.Inventory;

public class HoldHandlersTests
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
    public async Task CreateHold_WithCapacity_PersistsHeldStatus()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var resourceId = SeedPool(db, tenantId);
        var handler = new CreateHoldHandler(db, new FakeTenantContext(tenantId), user);

        var result = await handler.Handle(
            new CreateHoldCommand(resourceId, new DateOnly(2026, 5, 1), new DateOnly(2026, 5, 3), null, 2, null), default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be("Held");
        result.Value!.ExpiresAt.Should().NotBeNull();
        db.ResourceHolds.Should().ContainSingle();
    }

    [Fact]
    public async Task CreateHold_BlockedDate_Rejects()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var resourceId = SeedPool(db, tenantId);
        db.ResourceCalendar.Add(new ResourceCalendar
        {
            Id = Guid.NewGuid(), TenantId = tenantId,
            ResourceId = resourceId, Date = new DateOnly(2026, 5, 2),
            Slot = null, Capacity = 10, IsBlocked = true,
        });
        await db.SaveChangesAsync();

        var handler = new CreateHoldHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(
            new CreateHoldCommand(resourceId, new DateOnly(2026, 5, 1), new DateOnly(2026, 5, 3), null, 1, null), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("blocked");
    }

    [Fact]
    public async Task CreateHold_OnAssetWithQuantityNot1_Rejects()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var resourceId = Guid.NewGuid();
        db.AssetResources.Add(new AssetResource
        {
            Id = resourceId, TenantId = tenantId, Type = "Vehicle", Name = "X", Status = ResourceStatus.Active,
        });
        await db.SaveChangesAsync();

        var handler = new CreateHoldHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(
            new CreateHoldCommand(resourceId, new DateOnly(2026, 5, 1), new DateOnly(2026, 5, 1), null, 2, null), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("Asset");
    }

    [Fact]
    public async Task ConfirmHold_OnHeld_TransitionsToConfirmed()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var resourceId = SeedPool(db, tenantId);
        var holdId = Guid.NewGuid();
        db.ResourceHolds.Add(new ResourceHold
        {
            Id = holdId, TenantId = tenantId, ResourceId = resourceId,
            StartDate = new DateOnly(2026, 5, 1), EndDate = new DateOnly(2026, 5, 1),
            Quantity = 1, Status = ResourceHoldStatus.Held,
            ExpiresAt = DateTime.UtcNow.AddHours(12), HeldByUserId = user.UserId,
        });
        await db.SaveChangesAsync();

        var handler = new ConfirmHoldHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new ConfirmHoldCommand(holdId, "BK-001"), default);

        result.IsSuccess.Should().BeTrue();
        var fresh = db.ResourceHolds.Find(holdId)!;
        fresh.Status.Should().Be(ResourceHoldStatus.Confirmed);
        fresh.ExpiresAt.Should().BeNull();
        fresh.BookingRef.Should().Be("BK-001");
    }

    [Fact]
    public async Task ConfirmHold_AfterExpiry_ReturnsFailure()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var resourceId = SeedPool(db, tenantId);
        var holdId = Guid.NewGuid();
        db.ResourceHolds.Add(new ResourceHold
        {
            Id = holdId, TenantId = tenantId, ResourceId = resourceId,
            StartDate = new DateOnly(2026, 5, 1), EndDate = new DateOnly(2026, 5, 1),
            Quantity = 1, Status = ResourceHoldStatus.Held,
            ExpiresAt = DateTime.UtcNow.AddHours(-1), HeldByUserId = user.UserId,
        });
        await db.SaveChangesAsync();

        var handler = new ConfirmHoldHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new ConfirmHoldCommand(holdId, null), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("expired");
    }

    [Fact]
    public async Task ReleaseHold_OnHeld_TransitionsToReleased()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var resourceId = SeedPool(db, tenantId);
        var holdId = Guid.NewGuid();
        db.ResourceHolds.Add(new ResourceHold
        {
            Id = holdId, TenantId = tenantId, ResourceId = resourceId,
            StartDate = new DateOnly(2026, 5, 1), EndDate = new DateOnly(2026, 5, 1),
            Quantity = 1, Status = ResourceHoldStatus.Held,
            ExpiresAt = DateTime.UtcNow.AddHours(12), HeldByUserId = user.UserId,
        });
        await db.SaveChangesAsync();

        var handler = new ReleaseHoldHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new ReleaseHoldCommand(holdId, "customer cancelled"), default);

        result.IsSuccess.Should().BeTrue();
        db.ResourceHolds.Find(holdId)!.Status.Should().Be(ResourceHoldStatus.Released);
    }

    [Fact]
    public async Task ReleaseHold_OnReleased_ReturnsConflict()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var resourceId = SeedPool(db, tenantId);
        var holdId = Guid.NewGuid();
        db.ResourceHolds.Add(new ResourceHold
        {
            Id = holdId, TenantId = tenantId, ResourceId = resourceId,
            StartDate = new DateOnly(2026, 5, 1), EndDate = new DateOnly(2026, 5, 1),
            Quantity = 1, Status = ResourceHoldStatus.Released, HeldByUserId = user.UserId,
        });
        await db.SaveChangesAsync();

        var handler = new ReleaseHoldHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new ReleaseHoldCommand(holdId, null), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("terminal");
    }

    [Fact]
    public async Task ExtendHold_BumpsExpiresAt_AndIncrementsCount()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var resourceId = SeedPool(db, tenantId);
        var holdId = Guid.NewGuid();
        var originalExpiry = DateTime.UtcNow.AddHours(2);
        db.ResourceHolds.Add(new ResourceHold
        {
            Id = holdId, TenantId = tenantId, ResourceId = resourceId,
            StartDate = new DateOnly(2026, 5, 1), EndDate = new DateOnly(2026, 5, 1),
            Quantity = 1, Status = ResourceHoldStatus.Held,
            ExpiresAt = originalExpiry, ExtensionCount = 0, HeldByUserId = user.UserId,
        });
        await db.SaveChangesAsync();

        var handler = new ExtendHoldHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new ExtendHoldCommand(holdId), default);

        result.IsSuccess.Should().BeTrue();
        var fresh = db.ResourceHolds.Find(holdId)!;
        fresh.ExtensionCount.Should().Be(1);
        fresh.ExpiresAt.Should().BeAfter(originalExpiry);
    }

    [Fact]
    public async Task ExtendHold_AfterThreeExtensions_Rejects()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var resourceId = SeedPool(db, tenantId);
        var holdId = Guid.NewGuid();
        db.ResourceHolds.Add(new ResourceHold
        {
            Id = holdId, TenantId = tenantId, ResourceId = resourceId,
            StartDate = new DateOnly(2026, 5, 1), EndDate = new DateOnly(2026, 5, 1),
            Quantity = 1, Status = ResourceHoldStatus.Held,
            ExpiresAt = DateTime.UtcNow.AddHours(2), ExtensionCount = 3, HeldByUserId = user.UserId,
        });
        await db.SaveChangesAsync();

        var handler = new ExtendHoldHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new ExtendHoldCommand(holdId), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("limit");
    }

    [Fact]
    public async Task ListHolds_FiltersByStatus()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var resourceId = SeedPool(db, tenantId);
        db.ResourceHolds.Add(new ResourceHold { Id = Guid.NewGuid(), TenantId = tenantId, ResourceId = resourceId,
            StartDate = new DateOnly(2026, 5, 1), EndDate = new DateOnly(2026, 5, 1),
            Quantity = 1, Status = ResourceHoldStatus.Held, HeldByUserId = user.UserId, ExpiresAt = DateTime.UtcNow.AddHours(1) });
        db.ResourceHolds.Add(new ResourceHold { Id = Guid.NewGuid(), TenantId = tenantId, ResourceId = resourceId,
            StartDate = new DateOnly(2026, 5, 2), EndDate = new DateOnly(2026, 5, 2),
            Quantity = 1, Status = ResourceHoldStatus.Confirmed, HeldByUserId = user.UserId });
        await db.SaveChangesAsync();

        var handler = new ListHoldsHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new ListHoldsQuery(null, "Confirmed", null, null), default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Should().HaveCount(1);
        result.Value!.Single().Status.Should().Be("Confirmed");
    }
}
