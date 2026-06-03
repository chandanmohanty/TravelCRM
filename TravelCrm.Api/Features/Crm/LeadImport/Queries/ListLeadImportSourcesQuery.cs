using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.LeadImport.Queries;

public sealed record ListLeadImportSourcesQuery : IRequest<Result<IReadOnlyList<LeadImportSourceDto>>>;

public sealed class ListLeadImportSourcesQueryHandler(
    ApplicationDbContext db, ITenantContext tenant, ICurrentUser user)
    : IRequestHandler<ListLeadImportSourcesQuery, Result<IReadOnlyList<LeadImportSourceDto>>>
{
    public async Task<Result<IReadOnlyList<LeadImportSourceDto>>> Handle(
        ListLeadImportSourcesQuery q, CancellationToken ct)
    {
        if (!user.HasPermission("crm.leads.view"))
            return Result.Failure<IReadOnlyList<LeadImportSourceDto>>(
                "You don't have permission to view lead sources.");
        if (!tenant.IsResolved)
            return Result.Failure<IReadOnlyList<LeadImportSourceDto>>("Tenant context not resolved.");

        var sources = await db.LeadImportSources
            .Where(s => s.TenantId == tenant.TenantId!.Value)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(ct);

        var dtos = sources.Select(LeadImportSourceMapper.ToDto).ToList();

        return Result.Success<IReadOnlyList<LeadImportSourceDto>>(dtos);
    }
}
