using TravelCrm.Api.Domain.Entities;

namespace TravelCrm.Api.Infrastructure.WhatsApp;

/// <summary>Thin abstraction over WhatsApp gateway vendors.</summary>
public interface IWhatsAppClient
{
    WhatsAppProvider Provider { get; }

    /// <summary>Sends a plain-text message. Returns success/failure with optional error detail.</summary>
    Task<WhatsAppSendResult> SendTextAsync(string toPhone, string message, CancellationToken ct = default);

    /// <summary>Verifies credentials without sending a message. Used by "Test Connection".</summary>
    Task<WhatsAppPingResult> PingAsync(CancellationToken ct = default);
}

public sealed record WhatsAppSendResult(bool Success, string? MessageId, string? Error);
public sealed record WhatsAppPingResult(bool Success, string? Error);
