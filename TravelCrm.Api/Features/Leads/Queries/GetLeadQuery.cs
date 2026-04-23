using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Leads.DTOs;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Leads.Queries;

public sealed record GetLeadQuery(Guid Id) : IRequest<Result<LeadDto>>;

public sealed class GetLeadQueryHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<GetLeadQuery, Result<LeadDto>>
{
    public async Task<Result<LeadDto>> Handle(GetLeadQuery query, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.leads.view"))
            return Result.Failure<LeadDto>("You don't have permission to view leads.");

        var tenantId = tenantContext.TenantId;
        var row = await db.Leads
            .AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == query.Id && l.TenantId == tenantId, ct);

        if (row is null) return Result.Failure<LeadDto>("Lead not found.");
        return Result.Success(LeadMapper.ToDto(row));
    }
}
