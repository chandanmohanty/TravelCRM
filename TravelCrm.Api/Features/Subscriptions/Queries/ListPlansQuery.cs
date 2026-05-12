using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Subscriptions.Queries;

/// <summary>
/// Lists subscription plans. By default returns only active, non-contact-sales
/// plans (the public pricing page). Pass <paramref name="includeInactive"/>
/// or <paramref name="includeContactSales"/> = true for Platform Admin views.
/// </summary>
public sealed record ListPlansQuery(
    bool IncludeInactive = false,
    bool IncludeContactSales = false
) : IRequest<Result<List<PlanDto>>>;

public sealed class ListPlansHandler(ApplicationDbContext db)
    : IRequestHandler<ListPlansQuery, Result<List<PlanDto>>>
{
    public async Task<Result<List<PlanDto>>> Handle(ListPlansQuery q, CancellationToken ct)
    {
        var query = db.Plans.Include(p => p.Features).AsQueryable();
        if (!q.IncludeInactive)         query = query.Where(p => p.IsActive);
        if (!q.IncludeContactSales)     query = query.Where(p => !p.IsContactSalesOnly);

        var plans = await query
            .OrderBy(p => p.SortOrder)
            .AsNoTracking()
            .ToListAsync(ct);

        var dtos = plans.Select(p => new PlanDto(
            p.Id, p.Code, p.Name, p.Description,
            p.MonthlyPrice, p.AnnualPricePerMonth, p.FlatMonthlyPrice, p.Currency,
            p.SeatLimit, p.StorageGbLimit, p.WebhookLimit, p.WorkflowRuleLimit,
            p.MarketingRuleLimit, p.ChatLicenseLimit, p.DepartmentLimit, p.RoleLimit,
            p.IsActive, p.IsContactSalesOnly, p.SortOrder,
            p.Features.Select(f => f.FeatureCode).OrderBy(c => c).ToList()
        )).ToList();

        return Result.Success(dtos);
    }
}
