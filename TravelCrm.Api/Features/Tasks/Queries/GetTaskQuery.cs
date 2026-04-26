using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Tasks.Queries;

public sealed record GetTaskQuery(Guid Id) : IRequest<Result<TaskDto>>;

public sealed class GetTaskHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<GetTaskQuery, Result<TaskDto>>
{
    public async Task<Result<TaskDto>> Handle(GetTaskQuery q, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.tasks.view"))
            return Result.Failure<TaskDto>("Forbidden");

        if (!tenantContext.IsResolved)
            return Result.Failure<TaskDto>("Tenant not resolved");

        // Eager-load 3 levels of subtasks (sufficient for typical use)
        var task = await db.TenantTasks
            .Include(t => t.TaskType)
            .Include(t => t.TimeEntries)
            .Include(t => t.Children).ThenInclude(c => c.TaskType)
            .Include(t => t.Children).ThenInclude(c => c.TimeEntries)
            .Include(t => t.Children).ThenInclude(c => c.Children).ThenInclude(gc => gc.TaskType)
            .Include(t => t.Children).ThenInclude(c => c.Children).ThenInclude(gc => gc.TimeEntries)
            .FirstOrDefaultAsync(t => t.Id == q.Id && t.TenantId == tenantContext.TenantId, ct);

        if (task is null)
            return Result.Failure<TaskDto>("Task not found");

        return Result.Success(TaskMapper.ToDto(task, includeChildren: true));
    }
}
