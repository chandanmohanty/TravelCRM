using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Reminders.DTOs;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Reminders.Queries;

public sealed record ListRemindersQuery : IRequest<Result<IReadOnlyList<ReminderDto>>>;

public sealed class ListRemindersQueryHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<ListRemindersQuery, Result<IReadOnlyList<ReminderDto>>>
{
    public async Task<Result<IReadOnlyList<ReminderDto>>> Handle(
        ListRemindersQuery _, CancellationToken ct)
    {
        if (!currentUser.HasPermission("admin.reminders.view"))
            return Result.Failure<IReadOnlyList<ReminderDto>>("You don't have permission to view reminders.");

        var tenantId = tenantContext.TenantId;
        var rows = await db.Reminders
            .AsNoTracking()
            .Where(r => r.TenantId == tenantId)
            .OrderBy(r => r.Title)
            .ToListAsync(ct);

        var dtos = rows.Select(ReminderMapper.ToDto).ToList();
        return Result.Success<IReadOnlyList<ReminderDto>>(dtos);
    }
}

internal static class ReminderMapper
{
    internal static ReminderDto ToDto(Reminder r) =>
        new(r.Id, r.TenantId, r.Title, r.MessageTemplate,
            r.TriggerType.ToString(), r.Channel.ToString(), r.Status.ToString(),
            r.CronExpression, r.ScheduledAt, r.EventName, r.DelayMinutes,
            r.RecipientPhone, r.RecipientEmail, r.RecipientName,
            r.HangfireJobId, r.CreatedAt, r.UpdatedAt);
}
