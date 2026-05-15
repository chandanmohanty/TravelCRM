using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Leads.DTOs;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Leads.Queries;

public sealed record ListLeadsQuery(
    int    PageSize = 20,
    int    Page     = 1,
    bool?  HasDeals = null
) : IRequest<Result<IReadOnlyList<LeadDto>>>;

public sealed class ListLeadsQueryHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<ListLeadsQuery, Result<IReadOnlyList<LeadDto>>>
{
    public async Task<Result<IReadOnlyList<LeadDto>>> Handle(
        ListLeadsQuery q, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.leads.view"))
            return Result.Failure<IReadOnlyList<LeadDto>>("You don't have permission to view leads.");

        if (!tenantContext.IsResolved)
            return Result.Failure<IReadOnlyList<LeadDto>>("Tenant context is not resolved.");

        var tenantId = tenantContext.TenantId!.Value;

        var query = db.Leads
            .AsNoTracking()
            .Where(l => l.TenantId == tenantId)
            .OrderByDescending(l => l.CreatedAt)
            .AsQueryable();

        // hasDeals filter
        if (q.HasDeals == true)
            query = query.Where(l => db.Deals.Any(d => d.LeadId == l.Id && !d.IsDeleted));
        else if (q.HasDeals == false)
            query = query.Where(l => !db.Deals.Any(d => d.LeadId == l.Id && !d.IsDeleted));

        // Single query with correlated subquery count — avoids N+1
        var rows = await query
            .Select(l => new
            {
                Lead     = l,
                DealCount = db.Deals.Count(d => d.LeadId == l.Id && !d.IsDeleted)
            })
            .ToListAsync(ct);

        var items = rows
            .Select(r => LeadMapper.ToDto(r.Lead) with { DealCount = r.DealCount })
            .ToList();

        return Result.Success<IReadOnlyList<LeadDto>>(items);
    }
}

internal static class LeadMapper
{
    internal static LeadDto ToDto(Lead l) => new(
        l.Id, l.TenantId, l.FirstName, l.LastName, l.Email, l.Phone,
        l.Company, l.JobTitle,
        l.Status.ToString(),
        l.Source switch
        {
            LeadSource.Website       => "Website",
            LeadSource.Referral      => "Referral",
            LeadSource.SocialMedia   => "Social Media",
            LeadSource.EmailCampaign => "Email Campaign",
            LeadSource.TradeShow     => "Trade Show",
            LeadSource.ColdCall      => "Cold Call",
            LeadSource.Partner       => "Partner",
            LeadSource.Other         => "Other",
            _                        => throw new ArgumentOutOfRangeException(nameof(l.Source), l.Source, null),
        },
        l.Score, l.AssignedTo, l.Tags.AsReadOnly(), l.Notes,
        l.EstimatedValue, l.CreatedAt, l.UpdatedAt);
}
