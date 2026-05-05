using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Settings.WhatsApp.Commands;
using TravelCrm.Api.Features.Settings.WhatsApp.Queries;

namespace TravelCrm.Tests.Settings;

public class WhatsAppConfigHandlersTests
{
    [Fact]
    public async Task Create_rejects_caller_without_permission()
    {
        var (db, tenant, _) = TestDb.New();
        var h = new CreateWhatsAppConfigCommandHandler(
            db, tenant, new FakeCurrentUser(Guid.NewGuid(), hasPermission: false));

        var r = await h.Handle(new CreateWhatsAppConfigCommand(
            Name: "x", Provider: WhatsAppProvider.Gupshup,
            PhoneNumber: "+919876543210", ApiKey: "k",
            AppName: null, BaseUrl: null, IsActive: true), default);

        r.IsSuccess.Should().BeFalse();
        r.Error.Should().Contain("permission");
    }

    [Fact]
    public async Task Create_enforces_name_uniqueness_per_tenant()
    {
        var (db, tenant, tenantId) = TestDb.New();
        db.WhatsAppProviderConfigurations.Add(new WhatsAppProviderConfiguration
        {
            Id = Guid.NewGuid(), TenantId = tenantId,
            Name = "Prod", Provider = WhatsAppProvider.Gupshup,
            PhoneNumber = "+919999999999", ApiKey = "old", IsActive = true,
        });
        await db.SaveChangesAsync();

        var h = new CreateWhatsAppConfigCommandHandler(
            db, tenant, new FakeCurrentUser(Guid.NewGuid()));
        var r = await h.Handle(new CreateWhatsAppConfigCommand(
            Name: "Prod", Provider: WhatsAppProvider.Wati,
            PhoneNumber: "+911111111111", ApiKey: "new",
            AppName: null, BaseUrl: null, IsActive: false), default);

        r.IsSuccess.Should().BeFalse();
        r.Error.Should().Contain("already exists");
    }

    [Fact]
    public async Task Create_with_IsActive_deactivates_siblings()
    {
        var (db, tenant, tenantId) = TestDb.New();
        db.WhatsAppProviderConfigurations.Add(new WhatsAppProviderConfiguration
        {
            Id = Guid.NewGuid(), TenantId = tenantId,
            Name = "Existing", Provider = WhatsAppProvider.Gupshup,
            PhoneNumber = "+919999999999", ApiKey = "old", IsActive = true,
        });
        await db.SaveChangesAsync();

        var h = new CreateWhatsAppConfigCommandHandler(
            db, tenant, new FakeCurrentUser(Guid.NewGuid()));
        var r = await h.Handle(new CreateWhatsAppConfigCommand(
            Name: "New", Provider: WhatsAppProvider.Wati,
            PhoneNumber: "+911234567890", ApiKey: "new-key",
            AppName: null, BaseUrl: null, IsActive: true), default);

        r.IsSuccess.Should().BeTrue();
        var actives = await db.WhatsAppProviderConfigurations
            .Where(c => c.TenantId == tenantId && c.IsActive).CountAsync();
        actives.Should().Be(1, "only one config should be active per tenant");
    }

    [Fact]
    public async Task Update_keeps_existing_key_when_ApiKey_is_blank()
    {
        var (db, tenant, tenantId) = TestDb.New();
        var id = Guid.NewGuid();
        db.WhatsAppProviderConfigurations.Add(new WhatsAppProviderConfiguration
        {
            Id = id, TenantId = tenantId,
            Name = "A", Provider = WhatsAppProvider.Gupshup,
            PhoneNumber = "+919876543210", ApiKey = "secret-key", IsActive = true,
        });
        await db.SaveChangesAsync();

        var h = new UpdateWhatsAppConfigCommandHandler(
            db, tenant, new FakeCurrentUser(Guid.NewGuid()));
        var r = await h.Handle(new UpdateWhatsAppConfigCommand(
            Id: id, Name: "A-renamed", Provider: WhatsAppProvider.Gupshup,
            PhoneNumber: "+919876543210", ApiKey: null,
            AppName: "MyApp", BaseUrl: null, IsActive: true), default);

        r.IsSuccess.Should().BeTrue();
        var row = await db.WhatsAppProviderConfigurations.AsNoTracking().SingleAsync(c => c.Id == id);
        row.ApiKey.Should().Be("secret-key");
        row.Name.Should().Be("A-renamed");
        row.AppName.Should().Be("MyApp");
    }

    [Fact]
    public async Task List_masks_api_key()
    {
        var (db, tenant, tenantId) = TestDb.New();
        db.WhatsAppProviderConfigurations.Add(new WhatsAppProviderConfiguration
        {
            Id = Guid.NewGuid(), TenantId = tenantId,
            Name = "A", Provider = WhatsAppProvider.Wati,
            PhoneNumber = "+911234567890", ApiKey = "sk-live",
        });
        await db.SaveChangesAsync();

        var h = new ListWhatsAppConfigsQueryHandler(db, tenant, new FakeCurrentUser(Guid.NewGuid()));
        var r = await h.Handle(new ListWhatsAppConfigsQuery(), default);

        r.IsSuccess.Should().BeTrue();
        r.Value!.Should().ContainSingle().Which.HasApiKey.Should().BeTrue();
    }

    [Fact]
    public async Task SetActive_flips_only_target_to_active()
    {
        var (db, tenant, tenantId) = TestDb.New();
        var a = Guid.NewGuid(); var b = Guid.NewGuid();
        db.WhatsAppProviderConfigurations.AddRange(
            new WhatsAppProviderConfiguration
            {
                Id = a, TenantId = tenantId, Name = "A",
                Provider = WhatsAppProvider.Gupshup,
                PhoneNumber = "+911111111111", IsActive = true,
            },
            new WhatsAppProviderConfiguration
            {
                Id = b, TenantId = tenantId, Name = "B",
                Provider = WhatsAppProvider.Wati,
                PhoneNumber = "+912222222222", IsActive = false,
            });
        await db.SaveChangesAsync();

        var h = new SetActiveWhatsAppConfigCommandHandler(
            db, tenant, new FakeCurrentUser(Guid.NewGuid()));
        var r = await h.Handle(new SetActiveWhatsAppConfigCommand(b), default);

        r.IsSuccess.Should().BeTrue();
        (await db.WhatsAppProviderConfigurations.AsNoTracking().SingleAsync(c => c.Id == a))
            .IsActive.Should().BeFalse();
        (await db.WhatsAppProviderConfigurations.AsNoTracking().SingleAsync(c => c.Id == b))
            .IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task Delete_removes_config()
    {
        var (db, tenant, tenantId) = TestDb.New();
        var id = Guid.NewGuid();
        db.WhatsAppProviderConfigurations.Add(new WhatsAppProviderConfiguration
        {
            Id = id, TenantId = tenantId, Name = "A",
            Provider = WhatsAppProvider.Gupshup,
            PhoneNumber = "+919876543210", ApiKey = "key",
        });
        await db.SaveChangesAsync();

        var h = new DeleteWhatsAppConfigCommandHandler(
            db, tenant, new FakeCurrentUser(Guid.NewGuid()));
        var r = await h.Handle(new DeleteWhatsAppConfigCommand(id), default);

        r.IsSuccess.Should().BeTrue();
        (await db.WhatsAppProviderConfigurations.AnyAsync(c => c.Id == id)).Should().BeFalse();
    }
}
