using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Tasks.Commands;

public sealed record RestoreTaskCommand(Guid Id) : IRequest<Result<TaskDto>>;

public sealed class RestoreTaskHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<RestoreTaskCommand, Result<TaskDto>>
{
    public async Task<Result<TaskDto>> Handle(RestoreTaskCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.tasks.manage"))
            return Result.Failure<TaskDto>("Forbidden");

        if (!tenantContext.IsResolved)
            return Result.Failure<TaskDto>("Tenant not resolved");

        var task = await db.TenantTasks
            .Include(t => t.TaskType)
            .FirstOrDefaultAsync(t => t.Id == cmd.Id && t.TenantId == tenantContext.TenantId, ct);

        if (task is null) return Result.Failure<TaskDto>("Task not found");

        task.IsDeleted = false;
        await db.SaveChangesAsync(ct);
        return Result.Success(TaskMapper.ToDto(task));
    }
}
