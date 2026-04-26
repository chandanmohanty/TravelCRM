using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.TaskTypes.Commands;

public sealed record DeleteTaskTypeCommand(Guid Id) : IRequest<Result>;

public sealed class DeleteTaskTypeHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<DeleteTaskTypeCommand, Result>
{
    public async Task<Result> Handle(DeleteTaskTypeCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.tasks.admin"))
            return Result.Failure("Forbidden");

        if (!tenantContext.IsResolved)
            return Result.Failure("Tenant not resolved");

        var entity = await db.TaskTypes.FirstOrDefaultAsync(
            t => t.Id == cmd.Id && t.TenantId == tenantContext.TenantId, ct);
        if (entity is null) return Result.Failure("Task type not found");

        var inUse = await db.TenantTasks.AnyAsync(
            t => t.TaskTypeId == cmd.Id && t.TenantId == tenantContext.TenantId, ct);
        if (inUse) return Result.Failure("Task type is in use by existing tasks");

        db.TaskTypes.Remove(entity);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
