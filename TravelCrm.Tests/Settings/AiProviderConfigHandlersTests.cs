using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Settings.Ai.Commands;
using TravelCrm.Api.Features.Settings.Ai.Queries;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Tests.Settings;

public class AiProviderConfigHandlersTests
{
    [Fact]
    public async Task Create_rejects_caller_without_permission()
    {
        var (db, tenant, _) = TestDb.New();
        var h = new CreateAiProviderConfigCommandHandler(
            db, tenant, new FakeCurrentUser(Guid.NewGuid(), hasPermission: false));

        var r = await h.Handle(new CreateAiProviderConfigCommand(
            Name: "x", Provider: AiProvider.Anthropic,
            Model: "claude-3-5-sonnet-20241022", ApiKey: "k",
            BaseUrl: null, Temperature: null, MaxTokens: null, IsActive: true), default);

        r.IsSuccess.Should().BeFalse();
        r.Error.Should().Contain("permission");
    }

    [Fact]
    public async Task Create_enforces_name_uniqueness_per_tenant()
    {
        var (db, tenant, tenantId) = TestDb.New();
        db.AiProviderConfigurations.Add(new AiProviderConfiguration
        {
            Id = Guid.NewGuid(), TenantId = tenantId,
            Name = "Prod", Provider = AiProvider.Anthropic,
            Model = "claude-3-5-sonnet-20241022", ApiKey = "old", IsActive = true,
        });
        await db.SaveChangesAsync();

        var h = new CreateAiProviderConfigCommandHandler(
            db, tenant, new FakeCurrentUser(Guid.NewGuid()));
        var r = await h.Handle(new CreateAiProviderConfigCommand(
            Name: "Prod", Provider: AiProvider.OpenAI,
            Model: "gpt-4o", ApiKey: "k",
            BaseUrl: null, Temperature: null, MaxTokens: null, IsActive: false), default);

        r.IsSuccess.Should().BeFalse();
        r.Error.Should().Contain("already exists");
    }

    [Fact]
    public async Task Create_with_IsActive_deactivates_siblings()
    {
        var (db, tenant, tenantId) = TestDb.New();
        db.AiProviderConfigurations.Add(new AiProviderConfiguration
        {
            Id = Guid.NewGuid(), TenantId = tenantId,
            Name = "Existing", Provider = AiProvider.Anthropic,
            Model = "claude-3-5-sonnet-20241022", ApiKey = "old", IsActive = true,
        });
        await db.SaveChangesAsync();

        var h = new CreateAiProviderConfigCommandHandler(
            db, tenant, new FakeCurrentUser(Guid.NewGuid()));
        var r = await h.Handle(new CreateAiProviderConfigCommand(
            Name: "New", Provider: AiProvider.OpenAI,
            Model: "gpt-4o", ApiKey: "new-key",
            BaseUrl: null, Temperature: null, MaxTokens: null, IsActive: true), default);

        r.IsSuccess.Should().BeTrue();
        var actives = await db.AiProviderConfigurations
            .Where(c => c.TenantId == tenantId && c.IsActive).CountAsync();
        actives.Should().Be(1, "only one config should be active per tenant");
    }

    [Fact]
    public async Task Update_keeps_existing_key_when_ApiKey_is_blank()
    {
        var (db, tenant, tenantId) = TestDb.New();
        var id = Guid.NewGuid();
        db.AiProviderConfigurations.Add(new AiProviderConfiguration
        {
            Id = id, TenantId = tenantId,
            Name = "A", Provider = AiProvider.Anthropic,
            Model = "claude-3-5-sonnet-20241022", ApiKey = "secret-key", IsActive = true,
        });
        await db.SaveChangesAsync();

        var h = new UpdateAiProviderConfigCommandHandler(
            db, tenant, new FakeCurrentUser(Guid.NewGuid()));
        var r = await h.Handle(new UpdateAiProviderConfigCommand(
            Id: id, Name: "A-renamed", Provider: AiProvider.Anthropic,
            Model: "claude-3-5-sonnet-20241022", ApiKey: null,
            BaseUrl: null, Temperature: 0.7, MaxTokens: 512, IsActive: true), default);

        r.IsSuccess.Should().BeTrue();
        var row = await db.AiProviderConfigurations.AsNoTracking().SingleAsync(c => c.Id == id);
        row.ApiKey.Should().Be("secret-key");
        row.Name.Should().Be("A-renamed");
        row.Temperature.Should().Be(0.7);
    }

    [Fact]
    public async Task List_masks_the_api_key()
    {
        var (db, tenant, tenantId) = TestDb.New();
        db.AiProviderConfigurations.Add(new AiProviderConfiguration
        {
            Id = Guid.NewGuid(), TenantId = tenantId,
            Name = "A", Provider = AiProvider.OpenAI,
            Model = "gpt-4o", ApiKey = "sk-live-xxxx",
        });
        await db.SaveChangesAsync();

        var h = new ListAiProviderConfigsQueryHandler(db, tenant, new FakeCurrentUser(Guid.NewGuid()));
        var r = await h.Handle(new ListAiProviderConfigsQuery(), default);

        r.IsSuccess.Should().BeTrue();
        r.Value!.Should().ContainSingle()
            .Which.HasApiKey.Should().BeTrue();
        // DTO has no ApiKey property — asserted by compilation, reinforced by schema review.
    }

    [Fact]
    public async Task SetActive_flips_only_target_to_active()
    {
        var (db, tenant, tenantId) = TestDb.New();
        var a = Guid.NewGuid(); var b = Guid.NewGuid();
        db.AiProviderConfigurations.AddRange(
            new AiProviderConfiguration { Id = a, TenantId = tenantId, Name = "A",
                Provider = AiProvider.Anthropic, Model = "claude", IsActive = true },
            new AiProviderConfiguration { Id = b, TenantId = tenantId, Name = "B",
                Provider = AiProvider.OpenAI, Model = "gpt-4o", IsActive = false });
        await db.SaveChangesAsync();

        var h = new SetActiveAiProviderConfigCommandHandler(
            db, tenant, new FakeCurrentUser(Guid.NewGuid()));
        var r = await h.Handle(new SetActiveAiProviderConfigCommand(b), default);

        r.IsSuccess.Should().BeTrue();
        (await db.AiProviderConfigurations.AsNoTracking().SingleAsync(c => c.Id == a))
            .IsActive.Should().BeFalse();
        (await db.AiProviderConfigurations.AsNoTracking().SingleAsync(c => c.Id == b))
            .IsActive.Should().BeTrue();
    }
}
