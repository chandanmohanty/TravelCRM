namespace TravelCrm.Api.Domain.Entities;

/// <summary>How a reminder is triggered.</summary>
public enum ReminderTriggerType
{
    /// <summary>Fires on a cron schedule (recurring) or a specific date/time (one-shot).</summary>
    TimeBased = 1,

    /// <summary>
    /// Fires when a named domain event occurs, optionally after a delay.
    /// e.g. "lead.status_changed" + 60 min delay.
    /// </summary>
    EventTriggered = 2,
}

/// <summary>Which channel(s) to send through.</summary>
public enum ReminderChannel { WhatsApp = 1, Email = 2, Both = 3 }

/// <summary>Lifecycle state of a reminder rule.</summary>
public enum ReminderStatus { Active = 1, Paused = 2 }

/// <summary>
/// A configurable reminder rule. Supports two trigger strategies:
/// <list type="bullet">
///   <item><description>TimeBased — Hangfire recurring job (CronExpression) or
///     one-shot job (ScheduledAt).</description></item>
///   <item><description>EventTriggered — fired by a domain event publisher;
///     optional DelayMinutes defers the actual send.</description></item>
/// </list>
/// </summary>
public sealed class Reminder : IAuditableEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Null = platform-scoped; non-null = tenant-scoped.</summary>
    public Guid? TenantId { get; set; }

    public string Title { get; set; } = default!;

    /// <summary>
    /// Message body. Supports simple {token} substitution where the event publisher
    /// provides a dictionary of values (future).
    /// </summary>
    public string MessageTemplate { get; set; } = default!;

    public ReminderTriggerType TriggerType { get; set; }
    public ReminderChannel Channel { get; set; }
    public ReminderStatus Status { get; set; } = ReminderStatus.Active;

    // ── Time-based fields ────────────────────────────────────────────
    /// <summary>
    /// Quartz/Hangfire cron expression for recurring reminders.
    /// E.g. "0 9 * * *" = every day at 9am.
    /// Null for one-shot or event-triggered reminders.
    /// </summary>
    public string? CronExpression { get; set; }

    /// <summary>
    /// UTC timestamp for a one-shot reminder.
    /// Null for recurring or event-triggered reminders.
    /// </summary>
    public DateTime? ScheduledAt { get; set; }

    // ── Event-triggered fields ────────────────────────────────────────
    /// <summary>
    /// Named domain event that triggers this reminder.
    /// E.g. "lead.status_changed", "booking.created".
    /// </summary>
    public string? EventName { get; set; }

    /// <summary>Delay in minutes after the event fires before sending. 0 = immediate.</summary>
    public int? DelayMinutes { get; set; }

    // ── Recipient (static config; dynamic resolution is a future enhancement) ─
    public string? RecipientPhone { get; set; }
    public string? RecipientEmail { get; set; }
    public string? RecipientName { get; set; }

    // ── Hangfire tracking ────────────────────────────────────────────
    /// <summary>Recurring job ID registered in Hangfire for TimeBased+Cron reminders.</summary>
    public string? HangfireJobId { get; set; }

    // ── Audit ────────────────────────────────────────────────────────
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
}
