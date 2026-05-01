using FluentAssertions;
using TravelCrm.Api.Features.Inventory.TenantSettingsFeature.Commands;
using TravelCrm.Api.Features.Inventory.TenantSettingsFeature.Queries;
using EntityTenantSettings = TravelCrm.Api.Domain.Entities.TenantSettings;

namespace TravelCrm.Tests.Inventory;

public class TenantSettingsHandlersTests
{
    [Fact]
    public async Task Get_NoRow_ReturnsDefault24()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var handler = new GetTenantSettingsHandler(db, new FakeTenantContext(tenantId), user);

        var result = await handler.Handle(new GetTenantSettingsQuery(), default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.HoldTtlHours.Should().Be(24);
    }

    [Fact]
    public async Task Update_NoRow_LazyCreatesAndPersists()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var handler = new UpdateTenantSettingsHandler(db, new FakeTenantContext(tenantId), user);

        var before = DateTime.UtcNow;
        var result = await handler.Handle(new UpdateTenantSettingsCommand(48), default);
        var after = DateTime.UtcNow;

        result.IsSuccess.Should().BeTrue();
        result.Value!.HoldTtlHours.Should().Be(48);
        var row = db.TenantSettings.Single(s => s.TenantId == tenantId);
        row.HoldTtlHours.Should().Be(48);
        row.CreatedAt.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);
        row.UpdatedAt.Should().NotBeNull();
        row.UpdatedAt!.Value.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);
    }

    [Fact]
    public async Task Update_ExistingRow_UpdatesValueOnly()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: true);
        var originalCreatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        db.TenantSettings.Add(new EntityTenantSettings
        {
            Id = Guid.NewGuid(), TenantId = tenantId,
            HoldTtlHours = 24, CreatedAt = originalCreatedAt, UpdatedAt = null,
        });
        await db.SaveChangesAsync();

        var beforeUpdate = DateTime.UtcNow;
        var handler = new UpdateTenantSettingsHandler(db, new FakeTenantContext(tenantId), user);
        var result = await handler.Handle(new UpdateTenantSettingsCommand(12), default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.HoldTtlHours.Should().Be(12);
        var row = db.TenantSettings.Single(s => s.TenantId == tenantId);
        row.HoldTtlHours.Should().Be(12);
        row.CreatedAt.Should().Be(originalCreatedAt);
        row.UpdatedAt.Should().NotBeNull();
        row.UpdatedAt!.Value.Should().BeOnOrAfter(beforeUpdate);
    }

    [Fact]
    public async Task Update_TtlOutOfRange_FailsValidation()
    {
        var validator = new UpdateTenantSettingsValidator();

        var resultZero = await validator.ValidateAsync(new UpdateTenantSettingsCommand(0));
        resultZero.IsValid.Should().BeFalse();
        resultZero.Errors.Should().ContainSingle(e => e.PropertyName == "HoldTtlHours");

        var result721 = await validator.ValidateAsync(new UpdateTenantSettingsCommand(721));
        result721.IsValid.Should().BeFalse();

        var resultValid = await validator.ValidateAsync(new UpdateTenantSettingsCommand(48));
        resultValid.IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task Update_WithoutPermission_ReturnsForbidden()
    {
        var (db, _, tenantId) = TestDb.New();
        var user = new FakeCurrentUser(Guid.NewGuid(), hasPermission: false);
        var handler = new UpdateTenantSettingsHandler(db, new FakeTenantContext(tenantId), user);

        var result = await handler.Handle(new UpdateTenantSettingsCommand(48), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Be("Forbidden");
    }
}
