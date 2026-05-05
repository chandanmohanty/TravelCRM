using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Infrastructure.WhatsApp;

/// <summary>
/// Per-request factory that resolves the active <see cref="IWhatsAppClient"/>
/// for the current scope.
/// Fallback order: tenant active → platform active → null.
/// Mirrors <c>AiClientResolver</c> and <c>EmailSenderResolver</c>.
/// </summary>
public sealed class WhatsAppClientResolver(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    IHttpClientFactory httpClientFactory,
    ILoggerFactory loggerFactory)
{
    /// <summary>Active WhatsApp client for the current request, or <c>null</c>.</summary>
    public IWhatsAppClient? Resolve()
    {
        WhatsAppProviderConfiguration? config = null;

        if (tenantContext.TenantId.HasValue)
        {
            config = db.WhatsAppProviderConfigurations
                .AsNoTracking()
                .FirstOrDefault(c => c.TenantId == tenantContext.TenantId && c.IsActive);
        }
        config ??= db.WhatsAppProviderConfigurations
            .AsNoTracking()
            .FirstOrDefault(c => c.TenantId == null && c.IsActive);

        return config is null ? null : CreateFromConfig(config);
    }

    /// <summary>Constructs a client from a specific config row. Used by Test Connection.</summary>
    public IWhatsAppClient CreateFromConfig(WhatsAppProviderConfiguration config) =>
        config.Provider switch
        {
            WhatsAppProvider.Gupshup => new GupshupWhatsAppClient(
                config, httpClientFactory,
                loggerFactory.CreateLogger<GupshupWhatsAppClient>()),
            WhatsAppProvider.Wati    => new WatiWhatsAppClient(
                config, httpClientFactory,
                loggerFactory.CreateLogger<WatiWhatsAppClient>()),
            _ => throw new InvalidOperationException(
                $"Unknown WhatsApp provider: {config.Provider}")
        };
}
