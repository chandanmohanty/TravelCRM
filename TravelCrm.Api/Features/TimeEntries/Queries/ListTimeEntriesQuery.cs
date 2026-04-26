using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.TimeEntries.Queries;

public sealed record ListTimeEntriesQuery(Guid TaskId) : IRequest<Result<List<TimeEntryDto>>>;

public sealed class ListTimeEntriesHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<ListTimeEntriesQuery, Result<List<TimeEntryDto>>>
{
    public async Task<Result<List<TimeEntryDto>>> Handle(ListTimeEntriesQuery q, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.tasks.view"))
            return Result.Failure<List<TimeEntryDto>>("Forbidden");

        if (!tenantContext.IsResolved)
            return Result.Failure<List<TimeEntryDto>>("Tenant not resolved");

        var taskExists = await db.TenantTasks.AnyAsync(
            t => t.Id == q.TaskId && t.TenantId == tenantContext.TenantId, ct);
        if (!taskExists) return Result.Failure<List<TimeEntryDto>>("Task not found");

        var entries = await db.TimeEntries
            .AsNoTracking()
            .Where(te => te.TaskId == q.TaskId && te.TenantId == tenantContext.TenantId)
            .OrderByDescending(te => te.LoggedAt)
            .ToListAsync(ct);

        return Result.Success(entries.Select(te => TimeEntryMapper.ToDto(te)).ToList());
    }
}
