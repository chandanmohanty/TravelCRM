namespace TravelCrm.Api.Domain.Entities;

/// <summary>
/// Supported email providers. SMTP-based providers (0–4, 6) all use the same
/// <see cref="System.Net.Mail.SmtpClient"/> transport with different preset defaults.
/// API-based providers (5, 7) use direct HTTP calls.
/// </summary>
public enum EmailProvider
{
    /// <summary>Generic SMTP — fully custom host/port/TLS.</summary>
    Smtp = 0,

    /// <summary>Microsoft Office 365 — smtp.office365.com:587 TLS.</summary>
    Office365 = 1,

    /// <summary>Outlook.com — smtp-mail.outlook.com:587 TLS.</summary>
    Outlook = 2,

    /// <summary>Gmail — smtp.gmail.com:587 TLS. Requires App Password for 2FA.</summary>
    Gmail = 3,

    /// <summary>Microsoft Exchange — custom on-prem SMTP relay.</summary>
    Exchange = 4,

    /// <summary>SendGrid Web API v3 — HTTP POST, API key auth.</summary>
    SendGridApi = 5,

    /// <summary>Amazon SES via SMTP relay — email-smtp.{region}.amazonaws.com:587.</summary>
    AmazonSes = 6,

    /// <summary>Mailgun REST API — HTTP POST, API key + domain.</summary>
    MailgunApi = 7,
}
