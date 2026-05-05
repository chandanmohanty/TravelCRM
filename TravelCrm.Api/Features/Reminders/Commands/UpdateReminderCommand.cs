using FluentValidation;
using Hangfire;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Reminders.DTOs;
using TravelCrm.Api.Features.Reminders.Queries;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Jobs;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Reminders.Commands;

public sealed record UpdateReminderCommand(
    Guid                 Id,
    string               Title,
    string               MessageTemplate,
    ReminderTriggerType  TriggerType,
    ReminderChannel      Channel,
    ReminderStatus       Status,
    string?              CronExpression,
    DateTime?            ScheduledAt,
    string?              EventName,
    int?                 DelayMinutes,
    string?              RecipientPhone,
    string?              RecipientEmail,
    string?              RecipientName
) : IRequest<Result<ReminderDto>>;

public sealed class UpdateReminderCommandValidator : AbstractValidator<UpdateReminderCommand>
{
    public UpdateReminderCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.MessageTemplate).NotEmpty().MaximumLength(2000);

        When(x => x.TriggerType == ReminderTriggerType.TimeBased, () =>
        {
            RuleFor(x => x).Must(x => !string.IsNullOrWhiteSpace(x.CronExpression) || x.ScheduledAt.HasValue)
                .WithName("TriggerType")
                .WithMessage("TimeBased reminders require either CronExpression or ScheduledAt.");
        });

        When(x => x.TriggerType == ReminderTriggerType.EventTriggered, () =>
        {
            RuleFor(x => x.EventName).NotEmpty().MaximumLength(100);
            RuleFor(x => x.DelayMinutes).GreaterThanOrEqualTo(0).When(x => x.DelayMinutes.HasValue);
        });

        When(x => x.Channel is ReminderChannel.WhatsApp or ReminderChannel.Both, () =>
            RuleFor(x => x.RecipientPhone).NotEmpty());
        When(x => x.Channel is ReminderChannel.Email or ReminderChannel.Both, () =>
            RuleFor(x => x.RecipientEmail).NotEmpty().EmailAddress());
    }
}

public sealed class UpdateReminderCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser,
    IRecurringJobManager recurringJobManager,
    IBackgroundJobClient backgroundJobClient)
    : IRequestHandler<UpdateReminderCommand, Result<ReminderDto>>
{
    public async Task<Result<ReminderDto>> Handle(UpdateReminderCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure<ReminderDto>("Tenant context not resolved.");
        if (!currentUser.HasPermission("admin.reminders.update"))
            return Result.Failure<ReminderDto>("You don't have permission to manage reminders.");

        var row = await db.Reminders
            .FirstOrDefaultAsync(r => r.Id == cmd.Id && r.TenantId == tenantId, ct);
        if (row is null) return Result.Failure<ReminderDto>("Reminder not found.");

        // Remove old Hangfire job if schedule changed
        RemoveOldJob(row);

        row.Title           = cmd.Title;
        row.MessageTemplate = cmd.MessageTemplate;
        row.TriggerType     = cmd.TriggerType;
        row.Channel         = cmd.Channel;
        row.Status          = cmd.Status;
        row.CronExpression  = cmd.CronExpression;
        row.ScheduledAt     = cmd.ScheduledAt;
        row.EventName       = cmd.EventName;
        row.DelayMinutes    = cmd.DelayMinutes;
        row.RecipientPhone  = cmd.RecipientPhone;
        row.RecipientEmail  = cmd.RecipientEmail;
        row.RecipientName   = cmd.RecipientName;
        row.HangfireJobId   = null;
        row.UpdatedAt       = DateTime.UtcNow;
        row.UpdatedBy       = currentUser.UserId == Guid.Empty ? null : currentUser.UserId;

        await db.SaveChangesAsync(ct);

        // Re-schedule if still active + time-based
        if (row.Status == ReminderStatus.Active)
            ScheduleJob(row);

        if (row.HangfireJobId is not null)
            await db.SaveChangesAsync(ct);

        return Result.Success(ReminderMapper.ToDto(row));
    }

    private void RemoveOldJob(Reminder row)
    {
        if (string.IsNullOrEmpty(row.HangfireJobId)) return;
        try { recurringJobManager.RemoveIfExists(row.HangfireJobId); } catch { /* best-effort */ }
        try { backgroundJobClient.Delete(row.HangfireJobId); } catch { /* best-effort */ }
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
