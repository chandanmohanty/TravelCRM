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

        // NOTE: We Include(TimeEntries) here so TaskMapper can compute TotalLoggedMinutes.
        // This is acceptable for v1 dataset sizes. Future optimization: project TotalMinutes
        // server-side via a correlated subquery (.Select(t => new { t, total = t.TimeEntries.Sum(te => te.Minutes) }))
        // and pass it explicitly to TaskMapper.ToDto via an overload.
        var query = db.TenantTasks
            .AsNoTracking()
            .Include(t => t.TaskType)
            .Include(t => t.TimeEntries)
            .Where(t => t.TenantId == tenantContext.TenantId);

        if (!q.IncludeDeleted)
            query = query.Where(t => !t.IsDeleted);

        // TODO(perf): For PostgreSQL we should use EF.Functions.ILike with a pg_trgm index.
        // ToLower().Contains is portable across providers (incl. EF InMemory used in tests),
        // but on PostgreSQL it emits LOWER(title) LIKE '%x%' which can't use a btree index.
        // Defer until the search dataset grows large enough to matter.
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
