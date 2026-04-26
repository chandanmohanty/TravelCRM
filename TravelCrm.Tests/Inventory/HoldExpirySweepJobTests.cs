using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Jobs;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Tests.Inventory;

public class HoldExpirySweepJobTests
{
    private static Guid SeedPool(ApplicationDbContext db, Guid tenantId)
    {
        var id = Guid.NewGuid();
        db.PoolResources.Add(new PoolResource
        {
            Id = id, TenantId = tenantId, Type = "RoomType", Name = "X",
            DefaultCapacity = 10, Status = ResourceStatus.Active,
        });
        db.SaveChanges();
        return id;
    }

    [Fact]
    public async Task Sweep_ExpiresHeldRowsWithPastExpiry()
    {
        var (db, _, tenantId) = TestDb.New();
        var resourceId = SeedPool(db, tenantId);
        var stale = Guid.NewGuid();
        db.ResourceHolds.Add(new ResourceHold
        {
            Id = stale, TenantId = tenantId, ResourceId = resourceId,
            StartDate = new DateOnly(2026, 5, 1), EndDate = new DateOnly(2026, 5, 1),
            Quantity = 1, Status = ResourceHoldStatus.Held,
            ExpiresAt = DateTime.UtcNow.AddHours(-1), HeldByUserId = Guid.NewGuid(),
        });
        await db.SaveChangesAsync();

        var job = new HoldExpirySweepJob(db, NullLogger<HoldExpirySweepJob>.Instance);
        await job.ExecuteAsync(default);

        db.ResourceHolds.Find(stale)!.Status.Should().Be(ResourceHoldStatus.Expired);
    }

    [Fact]
    public async Task Sweep_IgnoresConfirmedHolds()
    {
        var (db, _, tenantId) = TestDb.New();
        var resourceId = SeedPool(db, tenantId);
        var confirmed = Guid.NewGuid();
        db.ResourceHolds.Add(new ResourceHold
        {
            Id = confirmed, TenantId = tenantId, ResourceId = resourceId,
            StartDate = new DateOnly(2026, 5, 1), EndDate = new DateOnly(2026, 5, 1),
            Quantity = 1, Status = ResourceHoldStatus.Confirmed,
            ExpiresAt = null, HeldByUserId = Guid.NewGuid(),
        });
        await db.SaveChangesAsync();

        var job = new HoldExpirySweepJob(db, NullLogger<HoldExpirySweepJob>.Instance);
        await job.ExecuteAsync(default);

        db.ResourceHolds.Find(confirmed)!.Status.Should().Be(ResourceHoldStatus.Confirmed);
    }

    [Fact]
    public async Task Sweep_IgnoresFutureExpiry()
    {
        var (db, _, tenantId) = TestDb.New();
        var resourceId = SeedPool(db, tenantId);
        var future = Guid.NewGuid();
        db.ResourceHolds.Add(new ResourceHold
        {
            Id = future, TenantId = tenantId, ResourceId = resourceId,
            StartDate = new DateOnly(2026, 5, 1), EndDate = new DateOnly(2026, 5, 1),
            Quantity = 1, Status = ResourceHoldStatus.Held,
            ExpiresAt = DateTime.UtcNow.AddHours(1), HeldByUserId = Guid.NewGuid(),
        });
        await db.SaveChangesAsync();

        var job = new HoldExpirySweepJob(db, NullLogger<HoldExpirySweepJob>.Instance);
        await job.ExecuteAsync(default);

        db.ResourceHolds.Find(future)!.Status.Should().Be(ResourceHoldStatus.Held);
    }
}
