using FluentValidation;
using Hangfire;
using MediatR;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Reminders.DTOs;
using TravelCrm.Api.Features.Reminders.Queries;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Jobs;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Reminders.Commands;

public sealed record CreateReminderCommand(
    string               Title,
    string               MessageTemplate,
    ReminderTriggerType  TriggerType,
    ReminderChannel      Channel,
    string?              CronExpression,
    DateTime?            ScheduledAt,
    string?              EventName,
    int?                 DelayMinutes,
    string?              RecipientPhone,
    string?              RecipientEmail,
    string?              RecipientName
) : IRequest<Result<ReminderDto>>;

public sealed class CreateReminderCommandValidator : AbstractValidator<CreateReminderCommand>
{
    public CreateReminderCommandValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.MessageTemplate).NotEmpty().MaximumLength(2000);

        // TimeBased needs either cron or scheduledAt
        When(x => x.TriggerType == ReminderTriggerType.TimeBased, () =>
        {
            RuleFor(x => x).Must(x => !string.IsNullOrWhiteSpace(x.CronExpression) || x.ScheduledAt.HasValue)
                .WithName("TriggerType")
                .WithMessage("TimeBased reminders require either CronExpression or ScheduledAt.");
            RuleFor(x => x.ScheduledAt)
                .GreaterThan(DateTime.UtcNow).When(x => x.ScheduledAt.HasValue)
                .WithMessage("ScheduledAt must be in the future.");
        });

        // EventTriggered needs event name
        When(x => x.TriggerType == ReminderTriggerType.EventTriggered, () =>
        {
            RuleFor(x => x.EventName).NotEmpty().MaximumLength(100)
                .WithMessage("EventName is required for EventTriggered reminders.");
            RuleFor(x => x.DelayMinutes).GreaterThanOrEqualTo(0).When(x => x.DelayMinutes.HasValue);
        });

        // Channel-specific recipient validation
        When(x => x.Channel is ReminderChannel.WhatsApp or ReminderChannel.Both, () =>
            RuleFor(x => x.RecipientPhone).NotEmpty()
                .WithMessage("RecipientPhone is required when channel includes WhatsApp."));
        When(x => x.Channel is ReminderChannel.Email or ReminderChannel.Both, () =>
            RuleFor(x => x.RecipientEmail).NotEmpty().EmailAddress()
                .WithMessage("A valid RecipientEmail is required when channel includes Email."));
    }
}

public sealed class CreateReminderCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser,
    IRecurringJobManager recurringJobManager,
    IBackgroundJobClient backgroundJobClient)
    : IRequestHandler<CreateReminderCommand, Result<ReminderDto>>
{
    public async Task<Result<ReminderDto>> Handle(CreateReminderCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure<ReminderDto>("Tenant context not resolved.");
        if (!currentUser.HasPermission("admin.reminders.update"))
            return Result.Failure<ReminderDto>("You don't have permission to manage reminders.");

        var actor = currentUser.UserId == Guid.Empty ? (Guid?)null : currentUser.UserId;

        var row = new Reminder
        {
            Id              = Guid.NewGuid(),
            TenantId        = tenantId,
            Title           = cmd.Title,
            MessageTemplate = cmd.MessageTemplate,
            TriggerType     = cmd.TriggerType,
            Channel         = cmd.Channel,
            Status          = ReminderStatus.Active,
            CronExpression  = cmd.CronExpression,
            ScheduledAt     = cmd.ScheduledAt,
            EventName       = cmd.EventName,
            DelayMinutes    = cmd.DelayMinutes,
            RecipientPhone  = cmd.RecipientPhone,
            RecipientEmail  = cmd.RecipientEmail,
            RecipientName   = cmd.RecipientName,
            CreatedBy       = actor,
        };

        db.Reminders.Add(row);
        await db.SaveChangesAsync(ct);

        // Schedule in Hangfire for time-based reminders
        ScheduleJob(row);

        // Persist the job ID
        if (row.HangfireJobId is not null)
            await db.SaveChangesAsync(ct);

        return Result.Success(ReminderMapper.ToDto(row));
    }

    private void ScheduleJob(Reminder row)
    {
        if (row.TriggerType != ReminderTriggerType.TimeBased) return;

        if (!string.IsNullOrWhiteSpace(row.CronExpression))
        {
            var jobId = $"reminder-{row.Id}";
            recurringJobManager.AddOrUpdate<ReminderJob>(
                jobId,
                job => job.ExecuteAsync(row.Id),
                row.CronExpression);
            row.HangfireJobId = jobId;
        }
        else if (row.ScheduledAt.HasValue)
        {
            var delay = row.ScheduledAt.Value - DateTime.UtcNow;
            if (delay < TimeSpan.Zero) delay = TimeSpan.Zero;
            var jobId = backgroundJobClient.Schedule<ReminderJob>(
                job => job.ExecuteAsync(row.Id), delay);
            row.HangfireJobId = jobId;
        }
    }
}
