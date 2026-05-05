namespace TravelCrm.Api.Infrastructure.Email;

/// <summary>
/// Abstraction for sending emails. Implementations are constructed per-request
/// by <see cref="EmailSenderResolver"/> based on the active
/// <see cref="Domain.Entities.EmailConfiguration"/>.
/// </summary>
public interface IEmailSender
{
    /// <summary>Send a single email.</summary>
    Task<EmailSendResult> SendAsync(
        string toEmail,
        string subject,
        string htmlBody,
        CancellationToken ct = default);
}

/// <summary>Result of an email send attempt.</summary>
public sealed record EmailSendResult(bool Success, string Message);
