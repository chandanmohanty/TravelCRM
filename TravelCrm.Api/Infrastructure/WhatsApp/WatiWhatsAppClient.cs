using System.Net.Http.Headers;
using System.Net.Http.Json;
using TravelCrm.Api.Domain.Entities;

namespace TravelCrm.Api.Infrastructure.WhatsApp;

/// <summary>
/// Sends messages via the <b>WATI</b> (WhatsApp Team Inbox) REST gateway.
/// Reference: https://docs.wati.io/reference/post_api-v2-sendSessionMessage
/// </summary>
public sealed class WatiWhatsAppClient : IWhatsAppClient
{
    public const string HttpClientName = "Wati";

    private const string DefaultBase = "https://live-server.wati.io";

    private readonly WhatsAppProviderConfiguration _cfg;
    private readonly HttpClient _http;
    private readonly ILogger<WatiWhatsAppClient> _logger;
    private readonly string _baseUrl;

    public WatiWhatsAppClient(
        WhatsAppProviderConfiguration cfg,
        IHttpClientFactory httpClientFactory,
        ILogger<WatiWhatsAppClient> logger)
    {
        _cfg     = cfg;
        _http    = httpClientFactory.CreateClient(HttpClientName);
        _logger  = logger;
        _baseUrl = cfg.BaseUrl?.TrimEnd('/') ?? DefaultBase;
    }

    public WhatsAppProvider Provider => WhatsAppProvider.Wati;

    public async Task<WhatsAppSendResult> SendTextAsync(
        string toPhone, string message, CancellationToken ct = default)
    {
        try
        {
            // WATI session message API — requires an active conversation window.
            var phone    = toPhone.TrimStart('+');
            var endpoint = $"{_baseUrl}/api/v1/sendSessionMessage/{phone}";

            var payload = new { message };
            var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
            {
                Content = JsonContent.Create(payload),
            };
            request.Headers.Authorization =
                new AuthenticationHeaderValue("Bearer", _cfg.ApiKey);

            var response = await _http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("WATI send failed {Status}: {Body}", response.StatusCode, body);
                return new WhatsAppSendResult(false, null, $"HTTP {(int)response.StatusCode}: {body}");
            }

            var result = await response.Content.ReadFromJsonAsync<WatiSendResponse>(ct);
            return new WhatsAppSendResult(true, result?.Id, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "WATI send exception");
            return new WhatsAppSendResult(false, null, ex.Message);
        }
    }

    public async Task<WhatsAppPingResult> PingAsync(CancellationToken ct = default)
    {
        try
        {
            var endpoint = $"{_baseUrl}/api/v1/contacts?pageSize=1&pageIndex=1";
            var request  = new HttpRequestMessage(HttpMethod.Get, endpoint);
            request.Headers.Authorization =
                new AuthenticationHeaderValue("Bearer", _cfg.ApiKey);

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

    private sealed record WatiSendResponse(string? Id, bool? Result);
}
