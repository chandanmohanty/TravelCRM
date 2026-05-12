using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Features.Subscriptions;
using TravelCrm.Api.Features.Subscriptions.Commands;
using TravelCrm.Api.Features.Subscriptions.Queries;

namespace TravelCrm.Api.Controllers.Platform;

/// <summary>
/// Platform-admin management of subscription plans. Lets the platform team
/// edit pricing, limits, and feature lists without a code deploy.
/// </summary>
[ApiController]
[Route("api/platform/plans")]
[Authorize(Policy = "PlatformAdmin")]
public sealed class PlatformPlansController(IMediator mediator) : ControllerBase
{
    /// <summary>List every plan, including inactive and contact-sales tiers.</summary>
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var r = await mediator.Send(
            new ListPlansQuery(IncludeInactive: true, IncludeContactSales: true), ct);
        return r.IsSuccess ? Ok(r.Value) : BadRequest(new { error = r.Error });
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var r = await mediator.Send(
            new ListPlansQuery(IncludeInactive: true, IncludeContactSales: true), ct);
        if (!r.IsSuccess) return BadRequest(new { error = r.Error });
        var plan = r.Value!.FirstOrDefault(p => p.Id == id);
        return plan is null ? NotFound() : Ok(plan);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] PlanUpdateRequest body,
        CancellationToken ct)
    {
        var r = await mediator.Send(new UpdatePlanCommand(
            Id:                  id,
            Name:                body.Name,
            Description:         body.Description,
            MonthlyPrice:        body.MonthlyPrice,
            AnnualPricePerMonth: body.AnnualPricePerMonth,
            FlatMonthlyPrice:    body.FlatMonthlyPrice,
            Currency:            body.Currency,
            SeatLimit:           body.SeatLimit,
            StorageGbLimit:      body.StorageGbLimit,
            WebhookLimit:        body.WebhookLimit,
            WorkflowRuleLimit:   body.WorkflowRuleLimit,
            MarketingRuleLimit:  body.MarketingRuleLimit,
            ChatLicenseLimit:    body.ChatLicenseLimit,
            DepartmentLimit:     body.DepartmentLimit,
            RoleLimit:           body.RoleLimit,
            IsActive:            body.IsActive,
            IsContactSalesOnly:  body.IsContactSalesOnly,
            SortOrder:           body.SortOrder,
            FeatureCodes:        body.FeatureCodes ?? Array.Empty<string>()
        ), ct);

        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : BadRequest(new { error = r.Error });
    }

    /// <summary>Assign a tenant onto a plan. Platform-admin only.</summary>
    [HttpPost("assign")]
    public async Task<IActionResult> Assign(
        [FromBody] AssignPlanRequest body,
        CancellationToken ct)
    {
        var r = await mediator.Send(new ChangeTenantPlanCommand(body.TenantId, body.PlanId), ct);
        return r.IsSuccess
            ? Ok(new { subscriptionId = r.Value })
            : BadRequest(new { error = r.Error });
    }
}

public sealed record PlanUpdateRequest(
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
    IReadOnlyList<string>? FeatureCodes);

public sealed record AssignPlanRequest(Guid TenantId, Guid PlanId);
