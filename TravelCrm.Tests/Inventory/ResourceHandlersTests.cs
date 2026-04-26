using FluentAssertions;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Features.Inventory.Resources.Commands;
using TravelCrm.Api.Features.Inventory.Resources.Queries;

namespace TravelCrm.Tests.Inventory;

public class ResourceHandlersTests
{
    [Fact]
    public async Task CreatePoolResource_Persists()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var handler = new CreateResourceHandler(db, new FakeTenantContext(tenantId), user);

        var result = await handler.Handle(
            new CreateResourceCommand("Pool", "RoomType", "Deluxe Room @ Taj", null, 10, null, null), default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Kind.Should().Be("Pool");
        result.Value!.DefaultCapacity.Should().Be(10);
        db.PoolResources.Should().ContainSingle(r => r.Name == "Deluxe Room @ Taj");
    }

    [Fact]
    public async Task CreateAssetResource_Persists()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var handler = new CreateResourceHandler(db, new FakeTenantContext(tenantId), user);

        var result = await handler.Handle(
            new CreateResourceCommand("Asset", "Vehicle", "Toyota Innova", null, null, "KA-01-AB-1234", null), default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Kind.Should().Be("Asset");
        result.Value!.AssetCode.Should().Be("KA-01-AB-1234");
    }

    [Fact]
    public async Task CreateResource_PoolWithoutCapacity_Fails()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var handler = new CreateResourceHandler(db, new FakeTenantContext(tenantId), user);

        var result = await handler.Handle(
            new CreateResourceCommand("Pool", "RoomType", "X", null, null, null, null), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("DefaultCapacity");
    }

    [Fact]
    public async Task BlockResource_SetsStatusBlocked()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var id = Guid.NewGuid();
        db.PoolResources.Add(new PoolResource
        {
            Id = id, TenantId = tenantId, Type = "RoomType", Name = "X",
            Status = ResourceStatus.Active, DefaultCapacity = 10,
        });
        await db.SaveChangesAsync();

        var handler = new BlockResourceHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new BlockResourceCommand(id), default);

        result.IsSuccess.Should().BeTrue();
        db.Resources.Find(id)!.Status.Should().Be(ResourceStatus.Blocked);
    }

    [Fact]
    public async Task ListResources_FilteredByType()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        db.PoolResources.Add(new PoolResource { Id = Guid.NewGuid(), TenantId = tenantId, Type = "Hotel", Name = "Taj", DefaultCapacity = 1, Status = ResourceStatus.Active });
        db.PoolResources.Add(new PoolResource { Id = Guid.NewGuid(), TenantId = tenantId, Type = "RoomType", Name = "Deluxe", DefaultCapacity = 10, Status = ResourceStatus.Active });
        await db.SaveChangesAsync();

        var handler = new ListResourcesHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new ListResourcesQuery("Hotel", null, null), default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Should().HaveCount(1);
        result.Value!.Single().Type.Should().Be("Hotel");
    }

    [Fact]
    public async Task GetResource_FromOtherTenant_ReturnsNotFound()
    {
        var (db, _, tenantId) = TestDb.New();
        var otherTenantId = Guid.NewGuid();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var id = Guid.NewGuid();
        db.PoolResources.Add(new PoolResource { Id = id, TenantId = otherTenantId, Type = "Hotel", Name = "Theirs", DefaultCapacity = 1, Status = ResourceStatus.Active });
        await db.SaveChangesAsync();

        var handler = new GetResourceHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new GetResourceQuery(id), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("not found");
    }
}
