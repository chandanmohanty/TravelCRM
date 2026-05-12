using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Subscriptions;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Subscriptions.Commands;

/// <summary>
/// Platform-admin update of a plan's pricing, limits, or feature list. Used
/// by the Platform → Plans admin UI to fine-tune entitlements without
/// requiring a deploy.
///
/// <para>The <see cref="FeatureCodes"/> list is the <b>exact</b> new set —
/// codes not in the list are removed, codes already on the plan are kept,
/// codes new to the list are added. Unknown codes (not in
/// <see cref="FeatureCatalog"/>) are rejected.</para>
/// </summary>
public sealed record UpdatePlanCommand(
    Guid Id,
    string Name,
    string? Description,
    decimal? MonthlyPrice,
    decimal? AnnualPricePerMonth,
    decimal? FlatMonthlyPrice,
    string Currency,
    int? SeatLimit,
    int? StorageGbLimit,
    int? WebhookLimit,
    int? WorkflowRuleLimit,
    int? MarketingRuleLimit,
    int? ChatLicenseLimit,
    int? DepartmentLimit,
    int? RoleLimit,
    bool IsActive,
    bool IsContactSalesOnly,
    int SortOrder,
    IReadOnlyList<string> FeatureCodes
) : IRequest<Result<PlanDto>>;

public sealed class UpdatePlanValidator : AbstractValidator<UpdatePlanCommand>
{
    public UpdatePlanValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Description).MaximumLength(500);
        RuleFor(x => x.Currency).NotEmpty().Length(3, 5);
        RuleFor(x => x.SortOrder).GreaterThanOrEqualTo(0);

        // All numeric limits must be > 0 when set (null = unlimited)
        RuleFor(x => x.SeatLimit).GreaterThan(0).When(x => x.SeatLimit.HasValue);
        RuleFor(x => x.StorageGbLimit).GreaterThan(0).When(x => x.StorageGbLimit.HasValue);
        RuleFor(x => x.WebhookLimit).GreaterThanOrEqualTo(0).When(x => x.WebhookLimit.HasValue);
        RuleFor(x => x.WorkflowRuleLimit).GreaterThanOrEqualTo(0).When(x => x.WorkflowRuleLimit.HasValue);

        RuleFor(x => x.MonthlyPrice).GreaterThanOrEqualTo(0).When(x => x.MonthlyPrice.HasValue);
        RuleFor(x => x.AnnualPricePerMonth).GreaterThanOrEqualTo(0).When(x => x.AnnualPricePerMonth.HasValue);
        RuleFor(x => x.FlatMonthlyPrice).GreaterThanOrEqualTo(0).When(x => x.FlatMonthlyPrice.HasValue);

        RuleForEach(x => x.FeatureCodes)
            .Must(FeatureCatalog.IsKnown)
            .WithMessage("Unknown feature code. Declare it in FeatureCatalog before use.");
    }
}

public sealed class UpdatePlanHandler(ApplicationDbContext db)
    : IRequestHandler<UpdatePlanCommand, Result<PlanDto>>
{
    public async Task<Result<PlanDto>> Handle(UpdatePlanCommand cmd, CancellationToken ct)
    {
        var plan = await db.Plans
            .Include(p => p.Features)
            .FirstOrDefaultAsync(p => p.Id == cmd.Id, ct);
        if (plan is null) return Result.Failure<PlanDto>("Plan not found");

        plan.Name                = cmd.Name;
        plan.Description         = cmd.Description;
        plan.MonthlyPrice        = cmd.MonthlyPrice;
        plan.AnnualPricePerMonth = cmd.AnnualPricePerMonth;
        plan.FlatMonthlyPrice    = cmd.FlatMonthlyPrice;
        plan.Currency            = cmd.Currency;
        plan.SeatLimit           = cmd.SeatLimit;
        plan.StorageGbLimit      = cmd.StorageGbLimit;
        plan.WebhookLimit        = cmd.WebhookLimit;
        plan.WorkflowRuleLimit   = cmd.WorkflowRuleLimit;
        plan.MarketingRuleLimit  = cmd.MarketingRuleLimit;
        plan.ChatLicenseLimit    = cmd.ChatLicenseLimit;
        plan.DepartmentLimit     = cmd.DepartmentLimit;
        plan.RoleLimit           = cmd.RoleLimit;
        plan.IsActive            = cmd.IsActive;
        plan.IsContactSalesOnly  = cmd.IsContactSalesOnly;
        plan.SortOrder           = cmd.SortOrder;
        plan.UpdatedAt           = DateTime.UtcNow;

        // Sync feature codes: add new, remove dropped
        var have   = plan.Features.Select(f => f.FeatureCode).ToHashSet(StringComparer.Ordinal);
        var wanted = cmd.FeatureCodes.ToHashSet(StringComparer.Ordinal);
        foreach (var code in wanted.Except(have))
            plan.Features.Add(new PlanFeature { PlanId = plan.Id, FeatureCode = code });
        foreach (var f in plan.Features.Where(f => !wanted.Contains(f.FeatureCode)).ToList())
            plan.Features.Remove(f);

        await db.SaveChangesAsync(ct);

        var dto = new PlanDto(
            plan.Id, plan.Code, plan.Name, plan.Description,
            plan.MonthlyPrice, plan.AnnualPricePerMonth, plan.FlatMonthlyPrice, plan.Currency,
            plan.SeatLimit, plan.StorageGbLimit, plan.WebhookLimit, plan.WorkflowRuleLimit,
            plan.MarketingRuleLimit, plan.ChatLicenseLimit, plan.DepartmentLimit, plan.RoleLimit,
            plan.IsActive, plan.IsContactSalesOnly, plan.SortOrder,
            plan.Features.Select(f => f.FeatureCode).OrderBy(c => c).ToList()
        );
        return Result.Success(dto);
    }
}
