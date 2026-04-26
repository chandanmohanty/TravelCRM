using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Resources.Queries;

public sealed record GetResourceQuery(Guid Id) : IRequest<Result<ResourceDto>>;

public sealed class GetResourceHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<GetResourceQuery, Result<ResourceDto>>
{
    public async Task<Result<ResourceDto>> Handle(GetResourceQuery q, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.resources.view"))
            return Result.Failure<ResourceDto>("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure<ResourceDto>("Tenant not resolved");

        var entity = await db.Resources
            .AsNoTracking()
            .Include(r => r.Supplier)
            .FirstOrDefaultAsync(r => r.Id == q.Id && r.TenantId == tenantContext.TenantId, ct);
        if (entity is null) return Result.Failure<ResourceDto>("Resource not found");

        return Result.Success(ResourceMapper.ToDto(entity));
    }
}
