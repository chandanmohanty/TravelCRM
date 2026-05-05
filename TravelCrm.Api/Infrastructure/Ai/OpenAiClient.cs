using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using TravelCrm.Api.Domain.Entities;

namespace TravelCrm.Api.Infrastructure.Ai;

/// <summary>
/// Talks to OpenAI's Chat Completions API. Docs: https://platform.openai.com/docs/api-reference/chat
/// Uses raw HTTP — no SDK dependency.
/// </summary>
public sealed class OpenAiClient : IAiClient
{
    public const string HttpClientName = "OpenAI";
    private const string DefaultBaseUrl = "https://api.openai.com";

    private readonly AiProviderConfiguration _config;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<OpenAiClient> _logger;

    public OpenAiClient(
        AiProviderConfiguration config,
        IHttpClientFactory httpClientFactory,
        ILogger<OpenAiClient> logger)
    {
        _config = config;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public AiProvider Provider => AiProvider.OpenAI;

    public async Task<AiCompletionResult> CompleteAsync(string prompt, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_config.ApiKey))
            return new AiCompletionResult(false, null, "OpenAI API key is missing.");

        var baseUrl = string.IsNullOrWhiteSpace(_config.BaseUrl) ? DefaultBaseUrl : _config.BaseUrl.TrimEnd('/');
        var http    = _httpClientFactory.CreateClient(HttpClientName);

        using var req = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/v1/chat/completions");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _config.ApiKey);

        var payload = new
        {
            model       = _config.Model,
            max_tokens  = _config.MaxTokens,
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
                _logger.LogWarning("OpenAI API error {Status}: {Body}", res.StatusCode, body);
                return new AiCompletionResult(false, null, $"OpenAI error ({res.StatusCode}): {Truncate(body, 300)}");
            }

            // OpenAI chat.completions: { choices: [{ message: { content: "..." } }] }
            using var doc = JsonDocument.Parse(body);
            var text = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString();
            return new AiCompletionResult(true, text, null);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "OpenAI request failed");
            return new AiCompletionResult(false, null, $"OpenAI error: {ex.Message}");
        }
    }

    private static string Truncate(string s, int max) => s.Length <= max ? s : s[..max] + "…";
}
