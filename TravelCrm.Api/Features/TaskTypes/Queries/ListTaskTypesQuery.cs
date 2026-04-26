using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.TaskTypes.Queries;

public sealed record ListTaskTypesQuery() : IRequest<Result<List<TaskTypeDto>>>;

public sealed class ListTaskTypesHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<ListTaskTypesQuery, Result<List<TaskTypeDto>>>
{
    public async Task<Result<List<TaskTypeDto>>> Handle(ListTaskTypesQuery q, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.tasks.view"))
            return Result.Failure<List<TaskTypeDto>>("Forbidden");

        if (!tenantContext.IsResolved)
            return Result.Failure<List<TaskTypeDto>>("Tenant not resolved");

        var types = await db.TaskTypes
            .AsNoTracking()
            .Where(t => t.TenantId == tenantContext.TenantId)
            .OrderBy(t => t.Name)
            .ToListAsync(ct);

        return Result.Success(types.Select(TaskTypeMapper.ToDto).ToList());
    }
}
