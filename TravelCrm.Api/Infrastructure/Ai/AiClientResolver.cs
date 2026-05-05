using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Infrastructure.Ai;

/// <summary>
/// Per-request factory that resolves the current scope's active
/// <see cref="IAiClient"/> by reading <see cref="AiProviderConfiguration"/>.
/// Fallback order: tenant active → platform active → null.
/// Mirrors <c>EmailSenderResolver</c>.
/// </summary>
public sealed class AiClientResolver(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    IHttpClientFactory httpClientFactory,
    ILoggerFactory loggerFactory)
{
    /// <summary>Active client for the current request, or <c>null</c> when no config is active.</summary>
    public IAiClient? Resolve()
    {
        AiProviderConfiguration? config = null;

        if (tenantContext.TenantId.HasValue)
        {
            config = db.AiProviderConfigurations
                .AsNoTracking()
                .FirstOrDefault(c => c.TenantId == tenantContext.TenantId && c.IsActive);
        }
        config ??= db.AiProviderConfigurations
            .AsNoTracking()
            .FirstOrDefault(c => c.TenantId == null && c.IsActive);

        return config is null ? null : CreateFromConfig(config);
    }

    /// <summary>Constructs a client from a specific config row. Used by the Test Connection flow.</summary>
    public IAiClient CreateFromConfig(AiProviderConfiguration config) => config.Provider switch
    {
        AiProvider.Anthropic => new AnthropicAiClient(
            config, httpClientFactory, loggerFactory.CreateLogger<AnthropicAiClient>()),
        AiProvider.OpenAI    => new OpenAiClient(
            config, httpClientFactory, loggerFactory.CreateLogger<OpenAiClient>()),
        _ => throw new InvalidOperationException($"Unknown AI provider: {config.Provider}")
    };
}
