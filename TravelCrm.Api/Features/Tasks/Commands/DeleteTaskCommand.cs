using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Tasks.Commands;

public sealed record DeleteTaskCommand(Guid Id) : IRequest<Result>;

public sealed class DeleteTaskHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<DeleteTaskCommand, Result>
{
    public async Task<Result> Handle(DeleteTaskCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.tasks.manage"))
            return Result.Failure("Forbidden");

        if (!tenantContext.IsResolved)
            return Result.Failure("Tenant not resolved");

        var task = await db.TenantTasks
            .FirstOrDefaultAsync(t => t.Id == cmd.Id && t.TenantId == tenantContext.TenantId, ct);

        if (task is null) return Result.Failure("Task not found");

        task.IsDeleted = true;
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
