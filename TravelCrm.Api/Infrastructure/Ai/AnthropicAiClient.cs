using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using TravelCrm.Api.Domain.Entities;

namespace TravelCrm.Api.Infrastructure.Ai;

/// <summary>
/// Talks to Anthropic's Messages API. Docs: https://docs.anthropic.com/
/// Uses raw HTTP — no SDK dependency — so the app stays multi-provider
/// without dragging in an Anthropic-specific client library.
/// </summary>
public sealed class AnthropicAiClient : IAiClient
{
    public const string HttpClientName = "Anthropic";
    private const string DefaultBaseUrl = "https://api.anthropic.com";

    private readonly AiProviderConfiguration _config;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<AnthropicAiClient> _logger;

    public AnthropicAiClient(
        AiProviderConfiguration config,
        IHttpClientFactory httpClientFactory,
        ILogger<AnthropicAiClient> logger)
    {
        _config = config;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public AiProvider Provider => AiProvider.Anthropic;

    public async Task<AiCompletionResult> CompleteAsync(string prompt, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_config.ApiKey))
            return new AiCompletionResult(false, null, "Anthropic API key is missing.");

        var baseUrl = string.IsNullOrWhiteSpace(_config.BaseUrl) ? DefaultBaseUrl : _config.BaseUrl.TrimEnd('/');
        var http    = _httpClientFactory.CreateClient(HttpClientName);

        using var req = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/v1/messages");
        req.Headers.Add("x-api-key", _config.ApiKey);
        req.Headers.Add("anthropic-version", "2023-06-01");

        var payload = new
        {
            model       = _config.Model,
            max_tokens  = _config.MaxTokens ?? 256,
            temperature = _config.Temperature,
            messages    = new[] { new { role = "user", content = prompt } }
        };
        req.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        try
        {
            using var res = await http.SendAsync(req, ct);
            var body = await res.Content.ReadAsStringAsync(ct);
            if (!res.IsSuccessStatusCode)
            {
                _logger.LogWarning("Anthropic API error {Status}: {Body}", res.StatusCode, body);
                return new AiCompletionResult(false, null, $"Anthropic error ({res.StatusCode}): {Truncate(body, 300)}");
            }

            // Anthropic messages API: { content: [{ type: "text", text: "..." }], ... }
            using var doc = JsonDocument.Parse(body);
            var text = doc.RootElement
                .GetProperty("content")[0]
                .GetProperty("text")
                .GetString();
            return new AiCompletionResult(true, text, null);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Anthropic request failed");
            return new AiCompletionResult(false, null, $"Anthropic error: {ex.Message}");
        }
    }

    private static string Truncate(string s, int max) => s.Length <= max ? s : s[..max] + "…";
}
