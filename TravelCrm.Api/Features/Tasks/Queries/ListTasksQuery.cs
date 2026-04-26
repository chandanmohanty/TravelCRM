using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Tasks.Queries;

public sealed record ListTasksQuery(
    string? Search,
    string? Status,
    string? Priority,
    Guid? AssignedToUserId,
    Guid? TaskTypeId,
    bool IncludeDeleted
) : IRequest<Result<List<TaskDto>>>;

public sealed class ListTasksHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<ListTasksQuery, Result<List<TaskDto>>>
{
    public async Task<Result<List<TaskDto>>> Handle(ListTasksQuery q, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.tasks.view"))
            return Result.Failure<List<TaskDto>>("Forbidden");

        if (!tenantContext.IsResolved)
            return Result.Failure<List<TaskDto>>("Tenant not resolved");

        var query = db.TenantTasks
            .Include(t => t.TaskType)
            .Include(t => t.TimeEntries)
            .Where(t => t.TenantId == tenantContext.TenantId);

        if (!q.IncludeDeleted)
            query = query.Where(t => !t.IsDeleted);

        if (!string.IsNullOrWhiteSpace(q.Search))
            query = query.Where(t => t.Title.ToLower().Contains(q.Search.ToLower()));

        if (!string.IsNullOrWhiteSpace(q.Status)
            && Enum.TryParse<TenantTaskStatus>(q.Status, ignoreCase: true, out var status))
            query = query.Where(t => t.Status == status);

        if (!string.IsNullOrWhiteSpace(q.Priority)
            && Enum.TryParse<TenantTaskPriority>(q.Priority, ignoreCase: true, out var priority))
            query = query.Where(t => t.Priority == priority);

        if (q.AssignedToUserId.HasValue)
            query = query.Where(t => t.AssignedToUserId == q.AssignedToUserId.Value);

        if (q.TaskTypeId.HasValue)
            query = query.Where(t => t.TaskTypeId == q.TaskTypeId.Value);

        var tasks = await query
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync(ct);

        var dtos = tasks.Select(t => TaskMapper.ToDto(t)).ToList();
        return Result.Success(dtos);
    }
}
