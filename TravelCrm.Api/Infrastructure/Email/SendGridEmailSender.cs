using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using TravelCrm.Api.Domain.Entities;

namespace TravelCrm.Api.Infrastructure.Email;

/// <summary>
/// SendGrid Web API v3 email sender. Uses raw <see cref="HttpClient"/> —
/// no NuGet dependency on the SendGrid SDK.
/// </summary>
public sealed class SendGridEmailSender : IEmailSender
{
    // Named client registered in Program.cs (rule: IHttpClientFactory, not `new HttpClient()`).
    public const string HttpClientName = "SendGrid";
    private const string ApiUrl = "https://api.sendgrid.com/v3/mail/send";
    private readonly string _apiKey;
    private readonly string _senderEmail;
    private readonly string _senderName;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<SendGridEmailSender> _logger;

    public SendGridEmailSender(
        EmailConfiguration config,
        IHttpClientFactory httpClientFactory,
        ILogger<SendGridEmailSender> logger)
    {
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _apiKey = config.ApiKey
            ?? throw new InvalidOperationException("SendGrid API key is required.");
        _senderEmail = config.SenderEmail;
        _senderName = config.SenderName;
    }

    public async Task<EmailSendResult> SendAsync(
        string toEmail, string subject, string htmlBody, CancellationToken ct = default)
    {
        try
        {
            var httpClient = _httpClientFactory.CreateClient(HttpClientName);
            httpClient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", _apiKey);

            var payload = new
            {
                personalizations = new[]
                {
                    new { to = new[] { new { email = toEmail } } }
                },
                from = new { email = _senderEmail, name = _senderName },
                subject,
                content = new[]
                {
                    new { type = "text/html", value = htmlBody }
                }
            };

            var json = JsonSerializer.Serialize(payload);
            using var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await httpClient.PostAsync(ApiUrl, content, ct);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("SendGrid email sent to {To}", toEmail);
                return new EmailSendResult(true, $"Email sent to {toEmail} via SendGrid.");
            }

            var errorBody = await response.Content.ReadAsStringAsync(ct);
            _logger.LogWarning("SendGrid API error {Status}: {Body}",
                response.StatusCode, errorBody);
            return new EmailSendResult(false,
                $"SendGrid API error ({response.StatusCode}): {errorBody}");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "SendGrid send failed to {To}", toEmail);
            return new EmailSendResult(false, $"SendGrid error: {ex.Message}");
        }
    }
}
