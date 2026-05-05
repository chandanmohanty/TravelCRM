using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Infrastructure.Email;

/// <summary>
/// Per-request factory that resolves the correct <see cref="IEmailSender"/>
/// by reading the active <see cref="EmailConfiguration"/> from the database.
/// Fallback: tenant active → platform active → null (no email configured).
/// </summary>
public sealed class EmailSenderResolver(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    IHttpClientFactory httpClientFactory,
    ILoggerFactory loggerFactory)
{
    /// <summary>
    /// Returns the <see cref="IEmailSender"/> for the current request's scope,
    /// or <c>null</c> if no email config is active.
    /// </summary>
    public IEmailSender? Resolve()
    {
        EmailConfiguration? config = null;

        if (tenantContext.TenantId.HasValue)
        {
            config = db.EmailConfigurations
                .AsNoTracking()
                .FirstOrDefault(c => c.TenantId == tenantContext.TenantId && c.IsActive);
        }

        config ??= db.EmailConfigurations
            .AsNoTracking()
            .FirstOrDefault(c => c.TenantId == null && c.IsActive);

        if (config is null) return null;

        return CreateFromConfig(config);
    }

    /// <summary>
    /// Creates an <see cref="IEmailSender"/> from a specific config row.
    /// Used by both <see cref="Resolve"/> and the test-email flow.
    /// </summary>
    public IEmailSender CreateFromConfig(EmailConfiguration config)
    {
        return config.Provider switch
        {
            // All SMTP-based providers use the same SmtpEmailSender
            EmailProvider.Smtp
                or EmailProvider.Office365
                or EmailProvider.Outlook
                or EmailProvider.Gmail
                or EmailProvider.Exchange
                or EmailProvider.AmazonSes
                => new SmtpEmailSender(config, loggerFactory.CreateLogger<SmtpEmailSender>()),

            EmailProvider.SendGridApi
                => new SendGridEmailSender(config, httpClientFactory, loggerFactory.CreateLogger<SendGridEmailSender>()),

            EmailProvider.MailgunApi
                => new MailgunEmailSender(config, httpClientFactory, loggerFactory.CreateLogger<MailgunEmailSender>()),

            _ => throw new InvalidOperationException($"Unknown email provider: {config.Provider}")
        };
    }
}
