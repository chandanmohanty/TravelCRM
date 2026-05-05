using TravelCrm.Api.Domain.Entities;

namespace TravelCrm.Api.Features.Reminders.DTOs;

public sealed record ReminderDto(
    Guid              Id,
    Guid?             TenantId,
    string            Title,
    string            MessageTemplate,
    string            TriggerType,    // "TimeBased" | "EventTriggered"
    string            Channel,        // "WhatsApp" | "Email" | "Both"
    string            Status,         // "Active" | "Paused"
    string?           CronExpression,
    DateTime?         ScheduledAt,
    string?           EventName,
    int?              DelayMinutes,
    string?           RecipientPhone,
    string?           RecipientEmail,
    string?           RecipientName,
    string?           HangfireJobId,
    DateTime          CreatedAt,
    DateTime?         UpdatedAt
);
