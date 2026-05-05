using System.Net;
using System.Net.Mail;
using TravelCrm.Api.Domain.Entities;

namespace TravelCrm.Api.Infrastructure.Email;

/// <summary>
/// SMTP-based email sender. Handles all SMTP providers: generic SMTP, Office 365,
/// Outlook, Gmail, Exchange, and Amazon SES (via SMTP relay). The provider enum
/// determines preset host/port defaults when the user doesn't override them.
/// </summary>
public sealed class SmtpEmailSender : IEmailSender, IDisposable
{
    private readonly SmtpClient _client;
    private readonly string _senderEmail;
    private readonly string _senderName;
    private readonly ILogger<SmtpEmailSender> _logger;

    public SmtpEmailSender(EmailConfiguration config, ILogger<SmtpEmailSender> logger)
    {
        _logger = logger;
        _senderEmail = config.SenderEmail;
        _senderName = config.SenderName;

        var (host, port) = ResolveHostPort(config);

        _client = new SmtpClient(host, port)
        {
            EnableSsl = config.EnableSsl,
            DeliveryMethod = SmtpDeliveryMethod.Network,
            Timeout = 30_000, // 30 seconds
        };

        if (!string.IsNullOrWhiteSpace(config.Username))
        {
            _client.Credentials = new NetworkCredential(config.Username, config.Password);
        }
    }

    public async Task<EmailSendResult> SendAsync(
        string toEmail, string subject, string htmlBody, CancellationToken ct = default)
    {
        try
        {
            using var message = new MailMessage
            {
                From = new MailAddress(_senderEmail, _senderName),
                Subject = subject,
                Body = htmlBody,
                IsBodyHtml = true,
            };
            message.To.Add(new MailAddress(toEmail));

            await _client.SendMailAsync(message, ct);

            _logger.LogInformation("SMTP email sent to {To} via {Host}", toEmail, _client.Host);
            return new EmailSendResult(true, $"Email sent successfully to {toEmail}.");
        }
        catch (SmtpException ex)
        {
            _logger.LogWarning(ex, "SMTP send failed to {To}", toEmail);
            return new EmailSendResult(false, $"SMTP error: {ex.Message}");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Email send failed to {To}", toEmail);
            return new EmailSendResult(false, $"Send failed: {ex.Message}");
        }
    }

    public void Dispose() => _client.Dispose();

    /// <summary>
    /// Returns the SMTP host and port for the given provider, using config
    /// overrides when available or well-known defaults otherwise.
    /// </summary>
    private static (string Host, int Port) ResolveHostPort(EmailConfiguration config)
    {
        // If the user explicitly set host, respect it regardless of provider
        if (!string.IsNullOrWhiteSpace(config.SmtpHost))
            return (config.SmtpHost, config.SmtpPort > 0 ? config.SmtpPort : 587);

        return config.Provider switch
        {
            EmailProvider.Office365 => ("smtp.office365.com", 587),
            EmailProvider.Outlook   => ("smtp-mail.outlook.com", 587),
            EmailProvider.Gmail     => ("smtp.gmail.com", 587),
            EmailProvider.AmazonSes => ($"email-smtp.{config.AwsRegion ?? "us-east-1"}.amazonaws.com", 587),
            EmailProvider.Exchange  => throw new InvalidOperationException(
                "Exchange requires an explicit SMTP host. Please configure the SMTP Server field."),
            _ => throw new InvalidOperationException(
                "SMTP host is required. Please configure the SMTP Server field."),
        };
    }
}
