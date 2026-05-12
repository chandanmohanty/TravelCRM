using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Subscriptions;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Subscriptions.Commands;

/// <summary>
/// Platform-admin operation: move a tenant onto a different plan. Used by
/// the Platform → Tenants management page and as the backbone of any future
/// self-serve billing-portal upgrade flow.
///
/// <para>The lifecycle status follows the new plan: moving to <c>free</c>
/// flips Status → <see cref="SubscriptionStatus.Free"/>; any paid plan goes
/// to <see cref="SubscriptionStatus.Active"/>. Trial conversion would set
/// <see cref="SubscriptionStatus.Trial"/>; that path is added when the
/// signup flow is wired (Phase 14).</para>
/// </summary>
public sealed record ChangeTenantPlanCommand(
    Guid TenantId,
    Guid PlanId
) : IRequest<Result<Guid>>;

public sealed class ChangeTenantPlanValidator : AbstractValidator<ChangeTenantPlanCommand>
{
    public ChangeTenantPlanValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.PlanId).NotEmpty();
    }
}

public sealed class ChangeTenantPlanHandler(ApplicationDbContext db)
    : IRequestHandler<ChangeTenantPlanCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(ChangeTenantPlanCommand cmd, CancellationToken ct)
    {
        var plan = await db.Plans.FirstOrDefaultAsync(p => p.Id == cmd.PlanId, ct);
        if (plan is null)     return Result.Failure<Guid>("Plan not found");
        if (!plan.IsActive)   return Result.Failure<Guid>("Plan is not active");

        // Tenant must exist (FK would reject anyway, but produce a friendlier error)
        var tenantExists = await db.Tenants.AnyAsync(t => t.Id == cmd.TenantId, ct);
        if (!tenantExists) return Result.Failure<Guid>("Tenant not found");

        var sub = await db.TenantSubscriptions
            .FirstOrDefaultAsync(s => s.TenantId == cmd.TenantId, ct);

        var now = DateTime.UtcNow;
        var newStatus = plan.Code == "free"
            ? SubscriptionStatus.Free
            : SubscriptionStatus.Active;

        if (sub is null)
        {
            sub = new TenantSubscription
            {
                TenantId           = cmd.TenantId,
                PlanId             = plan.Id,
                PlanCode           = plan.Code,
                Status             = newStatus,
                CurrentPeriodStart = now,
                CurrentPeriodEnd   = now.AddYears(1),
                ActivatedAt        = now,
                CreatedAt          = now,
            };
            db.TenantSubscriptions.Add(sub);
        }
        else
        {
            sub.PlanId             = plan.Id;
            sub.PlanCode           = plan.Code;
            sub.Status             = newStatus;
            sub.CurrentPeriodStart = now;
            sub.CurrentPeriodEnd   = now.AddYears(1);
            sub.ActivatedAt       ??= now;
            sub.CancelledAt        = null;
            sub.UpdatedAt          = now;
        }

        // Keep legacy Tenant.Plan string in sync until it's fully retired
        var tenant = await db.Tenants.FirstAsync(t => t.Id == cmd.TenantId, ct);
        tenant.Plan = plan.Code;

        await db.SaveChangesAsync(ct);
        return Result.Success(sub.Id);
    }
}
