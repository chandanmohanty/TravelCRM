using FluentAssertions;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Features.Inventory.Suppliers.Commands;
using TravelCrm.Api.Features.Inventory.Suppliers.Queries;

namespace TravelCrm.Tests.Inventory;

public class SupplierHandlersTests
{
    [Fact]
    public async Task CreateSupplier_Persists_AndReturnsDto()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var handler = new CreateSupplierHandler(db, new FakeTenantContext(tenantId), user);

        var result = await handler.Handle(
            new CreateSupplierCommand("Taj Hotels", "Hotel", null, null, null, null, null, null), default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Name.Should().Be("Taj Hotels");
        db.Suppliers.Should().ContainSingle(s => s.Name == "Taj Hotels" && s.TenantId == tenantId);
    }

    [Fact]
    public async Task CreateSupplier_DuplicateName_ReturnsFailure()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        db.Suppliers.Add(new Supplier { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Taj", SupplierType = SupplierType.Hotel });
        await db.SaveChangesAsync();

        var handler = new CreateSupplierHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(
            new CreateSupplierCommand("Taj", "Hotel", null, null, null, null, null, null), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("already exists");
    }

    [Fact]
    public async Task ListSuppliers_FiltersByTenant()
    {
        var (db, _, tenantId) = TestDb.New();
        var otherTenantId = Guid.NewGuid();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        db.Suppliers.Add(new Supplier { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Mine", SupplierType = SupplierType.Hotel });
        db.Suppliers.Add(new Supplier { Id = Guid.NewGuid(), TenantId = otherTenantId, Name = "Theirs", SupplierType = SupplierType.Hotel });
        await db.SaveChangesAsync();

        var handler = new ListSuppliersHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new ListSuppliersQuery(null), default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Should().HaveCount(1);
        result.Value!.Single().Name.Should().Be("Mine");
    }

    [Fact]
    public async Task UpdateSupplier_ChangesFields()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var id = Guid.NewGuid();
        db.Suppliers.Add(new Supplier { Id = id, TenantId = tenantId, Name = "Old", SupplierType = SupplierType.Hotel, IsActive = true });
        await db.SaveChangesAsync();

        var handler = new UpdateSupplierHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(
            new UpdateSupplierCommand(id, "New Name", "Transport", "John", "j@x.io", "+91", "Addr", null, null, false), default);

        result.IsSuccess.Should().BeTrue();
        var fresh = db.Suppliers.Find(id)!;
        fresh.Name.Should().Be("New Name");
        fresh.SupplierType.Should().Be(SupplierType.Transport);
        fresh.IsActive.Should().BeFalse();
    }

    [Fact]
    public async Task DeleteSupplier_WhenInUse_ReturnsConflict()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var supplierId = Guid.NewGuid();
        db.Suppliers.Add(new Supplier { Id = supplierId, TenantId = tenantId, Name = "InUse", SupplierType = SupplierType.Hotel });
        db.PoolResources.Add(new PoolResource
        {
            Id = Guid.NewGuid(), TenantId = tenantId, Type = "Hotel", Name = "Taj Goa",
            SupplierId = supplierId, DefaultCapacity = 10,
        });
        await db.SaveChangesAsync();

        var handler = new DeleteSupplierHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new DeleteSupplierCommand(supplierId), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("in use");
    }
}
