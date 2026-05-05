using FluentAssertions;
using Hangfire;
using Hangfire.Common;
using Hangfire.States;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Reminders.Commands;
using TravelCrm.Api.Features.Reminders.Queries;
using TravelCrm.Api.Infrastructure.Jobs;

namespace TravelCrm.Tests.Reminders;

// ── Hangfire fakes ──────────────────────────────────────────────────────────

internal sealed class FakeRecurringJobManager : IRecurringJobManager
{
    public readonly List<string> Added   = new();
    public readonly List<string> Removed = new();

    public void AddOrUpdate(string recurringJobId, Job job, string cronExpression,
        RecurringJobOptions? options = null)
        => Added.Add(recurringJobId);

    public void RemoveIfExists(string recurringJobId) => Removed.Add(recurringJobId);

    public void Trigger(string recurringJobId) { }
}

internal sealed class FakeBackgroundJobClient : IBackgroundJobClient
{
    public readonly List<string> StateChanges = new();
    private int _counter;

    public string Create(Job job, IState state) => $"job-{++_counter}";

    public bool ChangeState(string jobId, IState state, string? expectedState = null)
    {
        StateChanges.Add($"{jobId}:{state.Name}");
        return true;
    }
}

// ── Tests ───────────────────────────────────────────────────────────────────

public class ReminderHandlersTests
{
    private static (
        TravelCrm.Api.Infrastructure.Persistence.ApplicationDbContext db,
        FakeTenantContext tenant,
        Guid tenantId,
        FakeRecurringJobManager recurring,
        FakeBackgroundJobClient bgClient)
        Setup()
    {
        var (db, tenant, tenantId) = TestDb.New();
        return (db, tenant, tenantId, new FakeRecurringJobManager(), new FakeBackgroundJobClient());
    }

    [Fact]
    public async Task Create_rejects_caller_without_permission()
    {
        var (db, tenant, _, recurring, bgClient) = Setup();
        var h = new CreateReminderCommandHandler(
            db, tenant,
            new FakeCurrentUser(Guid.NewGuid(), hasPermission: false),
            recurring, bgClient);

        var r = await h.Handle(new CreateReminderCommand(
            Title: "Test", MessageTemplate: "Hello",
            TriggerType: ReminderTriggerType.EventTriggered,
            Channel: ReminderChannel.WhatsApp,
            CronExpression: null, ScheduledAt: null,
            EventName: "lead.created", DelayMinutes: 0,
            RecipientPhone: "+919876543210",
            RecipientEmail: null, RecipientName: null), default);

        r.IsSuccess.Should().BeFalse();
        r.Error.Should().Contain("permission");
    }

    [Fact]
    public async Task Create_TimeBased_cron_registers_recurring_job()
    {
        var (db, tenant, tenantId, recurring, bgClient) = Setup();
        var h = new CreateReminderCommandHandler(
            db, tenant, new FakeCurrentUser(Guid.NewGuid()), recurring, bgClient);

        var r = await h.Handle(new CreateReminderCommand(
            Title: "Daily Briefing", MessageTemplate: "Good morning!",
            TriggerType: ReminderTriggerType.TimeBased,
            Channel: ReminderChannel.WhatsApp,
            CronExpression: "0 9 * * *", ScheduledAt: null,
            EventName: null, DelayMinutes: null,
            RecipientPhone: "+919876543210",
            RecipientEmail: null, RecipientName: "Bob"), default);

        r.IsSuccess.Should().BeTrue();
        recurring.Added.Should().HaveCount(1, "one recurring job should be registered");
        r.Value!.HangfireJobId.Should().StartWith("reminder-");
    }

    [Fact]
    public async Task Create_TimeBased_scheduledAt_schedules_background_job()
    {
        var (db, tenant, tenantId, recurring, bgClient) = Setup();
        var h = new CreateReminderCommandHandler(
            db, tenant, new FakeCurrentUser(Guid.NewGuid()), recurring, bgClient);

        var future = DateTime.UtcNow.AddHours(2);
        var r = await h.Handle(new CreateReminderCommand(
            Title: "One-off", MessageTemplate: "Check in",
            TriggerType: ReminderTriggerType.TimeBased,
            Channel: ReminderChannel.Email,
            CronExpression: null, ScheduledAt: future,
            EventName: null, DelayMinutes: null,
            RecipientPhone: null,
            RecipientEmail: "user@example.com", RecipientName: null), default);

        r.IsSuccess.Should().BeTrue();
        recurring.Added.Should().BeEmpty("no recurring job for one-shot reminder");
        r.Value!.HangfireJobId.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task Create_EventTriggered_does_not_schedule_job()
    {
        var (db, tenant, tenantId, recurring, bgClient) = Setup();
        var h = new CreateReminderCommandHandler(
            db, tenant, new FakeCurrentUser(Guid.NewGuid()), recurring, bgClient);

        var r = await h.Handle(new CreateReminderCommand(
            Title: "Lead Follow-up", MessageTemplate: "Follow up with lead",
            TriggerType: ReminderTriggerType.EventTriggered,
            Channel: ReminderChannel.Both,
            CronExpression: null, ScheduledAt: null,
            EventName: "lead.status_changed", DelayMinutes: 60,
            RecipientPhone: "+919876543210",
            RecipientEmail: "agent@company.com", RecipientName: null), default);

        r.IsSuccess.Should().BeTrue();
        recurring.Added.Should().BeEmpty("event-triggered reminders have no Hangfire job");
        r.Value!.HangfireJobId.Should().BeNull();
    }

    [Fact]
    public async Task Update_removes_old_job_and_reschedules()
    {
        var (db, tenant, tenantId, recurring, bgClient) = Setup();
        var id = Guid.NewGuid();
        db.Reminders.Add(new Reminder
        {
            Id = id, TenantId = tenantId,
            Title = "Old", MessageTemplate = "msg",
            TriggerType = ReminderTriggerType.TimeBased,
            Channel = ReminderChannel.WhatsApp, Status = ReminderStatus.Active,
            CronExpression = "0 8 * * *",
            RecipientPhone = "+919999999999",
            HangfireJobId = $"reminder-{id}",
        });
        await db.SaveChangesAsync();

        var h = new UpdateReminderCommandHandler(
            db, tenant, new FakeCurrentUser(Guid.NewGuid()), recurring, bgClient);
        var r = await h.Handle(new UpdateReminderCommand(
            Id: id, Title: "Updated", MessageTemplate: "new msg",
            TriggerType: ReminderTriggerType.TimeBased,
            Channel: ReminderChannel.WhatsApp, Status: ReminderStatus.Active,
            CronExpression: "0 10 * * *", ScheduledAt: null,
            EventName: null, DelayMinutes: null,
            RecipientPhone: "+919999999999",
            RecipientEmail: null, RecipientName: null), default);

        r.IsSuccess.Should().BeTrue();
        recurring.Removed.Should().Contain($"reminder-{id}", "old job should be removed");
        recurring.Added.Should().ContainSingle("new cron job registered");
    }

    [Fact]
    public async Task Delete_removes_hangfire_job_and_row()
    {
        var (db, tenant, tenantId, recurring, bgClient) = Setup();
        var id = Guid.NewGuid();
        db.Reminders.Add(new Reminder
        {
            Id = id, TenantId = tenantId,
            Title = "To delete", MessageTemplate = "bye",
            TriggerType = ReminderTriggerType.TimeBased,
            Channel = ReminderChannel.Email, Status = ReminderStatus.Active,
            CronExpression = "0 9 * * *",
            RecipientEmail = "x@y.com",
            HangfireJobId = $"reminder-{id}",
        });
        await db.SaveChangesAsync();

        var h = new DeleteReminderCommandHandler(
            db, tenant, new FakeCurrentUser(Guid.NewGuid()), recurring, bgClient);
        var r = await h.Handle(new DeleteReminderCommand(id), default);

        r.IsSuccess.Should().BeTrue();
        // Recurring job should have been removed
        recurring.Removed.Should().Contain($"reminder-{id}");
        // DB row gone
        (await db.Reminders.AnyAsync(r2 => r2.Id == id)).Should().BeFalse();
    }

    [Fact]
    public async Task List_returns_tenant_reminders_only()
    {
        var (db, tenant, tenantId, _, _) = Setup();
        var otherId = Guid.NewGuid();
        db.Reminders.AddRange(
            new Reminder
            {
                Id = Guid.NewGuid(), TenantId = tenantId,
                Title = "Mine", MessageTemplate = "msg",
                TriggerType = ReminderTriggerType.EventTriggered,
                Channel = ReminderChannel.Email, Status = ReminderStatus.Active,
                EventName = "ev", RecipientEmail = "a@b.com",
            },
            new Reminder
            {
                Id = Guid.NewGuid(), TenantId = otherId,
                Title = "Not mine", MessageTemplate = "msg",
                TriggerType = ReminderTriggerType.EventTriggered,
                Channel = ReminderChannel.Email, Status = ReminderStatus.Active,
                EventName = "ev", RecipientEmail = "c@d.com",
            });
        await db.SaveChangesAsync();

        var h = new ListRemindersQueryHandler(db, tenant, new FakeCurrentUser(Guid.NewGuid()));
        var r = await h.Handle(new ListRemindersQuery(), default);

        r.IsSuccess.Should().BeTrue();
        r.Value!.Should().ContainSingle().Which.Title.Should().Be("Mine");
    }
}
