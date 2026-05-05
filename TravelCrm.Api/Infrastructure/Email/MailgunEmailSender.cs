using System.Net.Http.Headers;
using System.Text;
using TravelCrm.Api.Domain.Entities;

namespace TravelCrm.Api.Infrastructure.Email;

/// <summary>
/// Mailgun REST API email sender. Uses raw <see cref="HttpClient"/> with
/// multipart form data — no NuGet dependency.
/// </summary>
public sealed class MailgunEmailSender : IEmailSender
{
    public const string HttpClientName = "Mailgun";
    private readonly string _apiKey;
    private readonly string _domain;
    private readonly string _senderEmail;
    private readonly string _senderName;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<MailgunEmailSender> _logger;

    public MailgunEmailSender(
        EmailConfiguration config,
        IHttpClientFactory httpClientFactory,
        ILogger<MailgunEmailSender> logger)
    {
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _apiKey = config.ApiKey
            ?? throw new InvalidOperationException("Mailgun API key is required.");
        _domain = config.ApiDomain
            ?? throw new InvalidOperationException("Mailgun sending domain is required.");
        _senderEmail = config.SenderEmail;
        _senderName = config.SenderName;
    }

    public async Task<EmailSendResult> SendAsync(
        string toEmail, string subject, string htmlBody, CancellationToken ct = default)
    {
        try
        {
            var httpClient = _httpClientFactory.CreateClient(HttpClientName);
            // Mailgun uses HTTP Basic Auth: api:{apiKey}
            var authValue = Convert.ToBase64String(Encoding.ASCII.GetBytes($"api:{_apiKey}"));
            httpClient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Basic", authValue);

            var url = $"https://api.mailgun.net/v3/{_domain}/messages";

            using var form = new MultipartFormDataContent
            {
                { new StringContent($"{_senderName} <{_senderEmail}>"), "from" },
                { new StringContent(toEmail), "to" },
                { new StringContent(subject), "subject" },
                { new StringContent(htmlBody), "html" },
            };

            var response = await httpClient.PostAsync(url, form, ct);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Mailgun email sent to {To} via {Domain}", toEmail, _domain);
                return new EmailSendResult(true, $"Email sent to {toEmail} via Mailgun.");
            }

            var errorBody = await response.Content.ReadAsStringAsync(ct);
            _logger.LogWarning("Mailgun API error {Status}: {Body}",
                response.StatusCode, errorBody);
            return new EmailSendResult(false,
                $"Mailgun API error ({response.StatusCode}): {errorBody}");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Mailgun send failed to {To}", toEmail);
            return new EmailSendResult(false, $"Mailgun error: {ex.Message}");
        }
    }
}
