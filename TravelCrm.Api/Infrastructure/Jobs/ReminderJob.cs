using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Infrastructure.Email;
using TravelCrm.Api.Infrastructure.Persistence;
using TravelCrm.Api.Infrastructure.WhatsApp;

namespace TravelCrm.Api.Infrastructure.Jobs;

/// <summary>
/// Hangfire job that executes a single <see cref="Reminder"/> — sends via the
/// configured channel (WhatsApp, Email, or both). Resolved from DI so all
/// per-request services are properly scoped.
/// </summary>
public sealed class ReminderJob(
    ApplicationDbContext db,
    WhatsAppClientResolver whatsAppResolver,
    EmailSenderResolver emailResolver,
    ILogger<ReminderJob> logger)
{
    /// <summary>Called by Hangfire. <paramref name="reminderId"/> is serialized in the job payload.</summary>
    public async Task ExecuteAsync(Guid reminderId)
    {
        var reminder = await db.Reminders.AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == reminderId);

        if (reminder is null)
        {
            logger.LogWarning("ReminderJob: reminder {Id} not found — skipping.", reminderId);
            return;
        }
        if (reminder.Status != ReminderStatus.Active)
        {
            logger.LogInformation("ReminderJob: reminder {Id} is {Status} — skipping.", reminderId, reminder.Status);
            return;
        }

        logger.LogInformation("ReminderJob: sending reminder '{Title}' ({Id})", reminder.Title, reminderId);

        if (reminder.Channel is ReminderChannel.WhatsApp or ReminderChannel.Both)
            await SendWhatsAppAsync(reminder);

        if (reminder.Channel is ReminderChannel.Email or ReminderChannel.Both)
            await SendEmailAsync(reminder);
    }

    private async Task SendWhatsAppAsync(Reminder reminder)
    {
        if (string.IsNullOrWhiteSpace(reminder.RecipientPhone))
        {
            logger.LogWarning("ReminderJob: no RecipientPhone on reminder {Id}", reminder.Id);
            return;
        }

        var client = whatsAppResolver.Resolve();
        if (client is null)
        {
            logger.LogWarning("ReminderJob: no active WhatsApp provider for reminder {Id}", reminder.Id);
            return;
        }

        var result = await client.SendTextAsync(reminder.RecipientPhone, reminder.MessageTemplate);
        if (!result.Success)
            logger.LogError("ReminderJob: WhatsApp send failed for {Id}: {Error}", reminder.Id, result.Error);
    }

    private async Task SendEmailAsync(Reminder reminder)
    {
        if (string.IsNullOrWhiteSpace(reminder.RecipientEmail))
        {
            logger.LogWarning("ReminderJob: no RecipientEmail on reminder {Id}", reminder.Id);
            return;
        }

        var sender = emailResolver.Resolve();
        if (sender is null)
        {
            logger.LogWarning("ReminderJob: no active email provider for reminder {Id}", reminder.Id);
            return;
        }

        var html = $"<p>{System.Net.WebUtility.HtmlEncode(reminder.MessageTemplate)}</p>";
        await sender.SendAsync(reminder.RecipientEmail, reminder.Title, html);
    }
}
