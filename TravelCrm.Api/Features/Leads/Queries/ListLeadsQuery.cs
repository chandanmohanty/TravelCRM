using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Leads.DTOs;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Leads.Queries;

public sealed record ListLeadsQuery : IRequest<Result<IReadOnlyList<LeadDto>>>;

public sealed class ListLeadsQueryHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<ListLeadsQuery, Result<IReadOnlyList<LeadDto>>>
{
    public async Task<Result<IReadOnlyList<LeadDto>>> Handle(
        ListLeadsQuery _, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.leads.view"))
            return Result.Failure<IReadOnlyList<LeadDto>>("You don't have permission to view leads.");

        if (!tenantContext.IsResolved)
            return Result.Failure<IReadOnlyList<LeadDto>>("Tenant context is not resolved.");
        var tenantId = tenantContext.TenantId!.Value;
        var rows = await db.Leads
            .AsNoTracking()
            .Where(l => l.TenantId == tenantId)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<LeadDto>>(rows.Select(LeadMapper.ToDto).ToList());
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
