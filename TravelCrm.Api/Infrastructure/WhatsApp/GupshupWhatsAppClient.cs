using System.Net.Http.Json;
using TravelCrm.Api.Domain.Entities;

namespace TravelCrm.Api.Infrastructure.WhatsApp;

/// <summary>
/// Sends messages via the <b>Gupshup</b> REST gateway.
/// Reference: https://docs.gupshup.io/docs/send-message-api
/// </summary>
public sealed class GupshupWhatsAppClient : IWhatsAppClient
{
    public const string HttpClientName = "Gupshup";

    private const string BaseEndpoint = "https://api.gupshup.io/sm/api/v1/msg";

    private readonly WhatsAppProviderConfiguration _cfg;
    private readonly HttpClient _http;
    private readonly ILogger<GupshupWhatsAppClient> _logger;

    public GupshupWhatsAppClient(
        WhatsAppProviderConfiguration cfg,
        IHttpClientFactory httpClientFactory,
        ILogger<GupshupWhatsAppClient> logger)
    {
        _cfg    = cfg;
        _http   = httpClientFactory.CreateClient(HttpClientName);
        _logger = logger;
    }

    public WhatsAppProvider Provider => WhatsAppProvider.Gupshup;

    public async Task<WhatsAppSendResult> SendTextAsync(
        string toPhone, string message, CancellationToken ct = default)
    {
        try
        {
            var form = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["channel"]      = "whatsapp",
                ["source"]       = _cfg.PhoneNumber.TrimStart('+'),
                ["destination"]  = toPhone.TrimStart('+'),
                ["message"]      = message,
                ["src.name"]     = _cfg.AppName ?? "TravelCRM",
            });

            var request = new HttpRequestMessage(HttpMethod.Post, _cfg.BaseUrl ?? BaseEndpoint)
            {
                Content = form,
                Headers = { { "apikey", _cfg.ApiKey } }
            };

            var response = await _http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("Gupshup send failed {Status}: {Body}", response.StatusCode, body);
                return new WhatsAppSendResult(false, null, $"HTTP {(int)response.StatusCode}: {body}");
            }

            var result = await response.Content.ReadFromJsonAsync<GupshupSendResponse>(ct);
            var msgId  = result?.MessageId ?? result?.Status;
            return new WhatsAppSendResult(true, msgId, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gupshup send exception");
            return new WhatsAppSendResult(false, null, ex.Message);
        }
    }

    public async Task<WhatsAppPingResult> PingAsync(CancellationToken ct = default)
    {
        // Gupshup has no dedicated health endpoint; we send a dry-run to a test number.
        // For "test connection" we just validate credentials by hitting the balance/account endpoint.
        try
        {
            var request = new HttpRequestMessage(HttpMethod.Get, "https://api.gupshup.io/wa/api/v1/account")
            {
                Headers = { { "apikey", _cfg.ApiKey } }
            };
            var response = await _http.SendAsync(request, ct);
            return response.IsSuccessStatusCode
                ? new WhatsAppPingResult(true, null)
                : new WhatsAppPingResult(false, $"HTTP {(int)response.StatusCode}");
        }
        catch (Exception ex)
        {
            return new WhatsAppPingResult(false, ex.Message);
        }
    }

    // Gupshup response shape (minimal fields we care about)
    private sealed record GupshupSendResponse(string? Status, string? MessageId);
}
