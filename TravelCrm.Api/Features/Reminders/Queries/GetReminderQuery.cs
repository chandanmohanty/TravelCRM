using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Reminders.DTOs;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Reminders.Queries;

public sealed record GetReminderQuery(Guid Id) : IRequest<Result<ReminderDto>>;

public sealed class GetReminderQueryHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<GetReminderQuery, Result<ReminderDto>>
{
    public async Task<Result<ReminderDto>> Handle(GetReminderQuery query, CancellationToken ct)
    {
        if (!currentUser.HasPermission("admin.reminders.view"))
            return Result.Failure<ReminderDto>("You don't have permission to view reminders.");

        var tenantId = tenantContext.TenantId;
        var row = await db.Reminders
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == query.Id && r.TenantId == tenantId, ct);

        if (row is null) return Result.Failure<ReminderDto>("Reminder not found.");

        return Result.Success(ReminderMapper.ToDto(row));
    }
}
