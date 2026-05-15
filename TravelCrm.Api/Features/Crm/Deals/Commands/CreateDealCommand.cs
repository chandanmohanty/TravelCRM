using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Domain.Entities.Crm;
using TravelCrm.Api.Features.Crm.Deals.Queries;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.Deals.Commands;

public sealed record CreateDealCommand(
    Guid? LeadId,
    string Title,
    string ContactName,
    string? ContactEmail,
    string? ContactPhone,
    string? CompanyName,
    Guid? PipelineId,
    Guid? StageId,
    decimal? Value,
    string? Currency,
    int? Probability,
    DateOnly? ExpectedCloseDate,
    Guid? OwnerUserId,
    IReadOnlyList<string>? Tags,
    string? Notes
) : IRequest<Result<DealDto>>;

public sealed class CreateDealValidator : AbstractValidator<CreateDealCommand>
{
    public CreateDealValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.ContactName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.ContactEmail).MaximumLength(256).EmailAddress()
            .When(x => !string.IsNullOrEmpty(x.ContactEmail));
        RuleFor(x => x.ContactPhone).MaximumLength(50);
        RuleFor(x => x.CompanyName).MaximumLength(200);
        RuleFor(x => x.Currency).MaximumLength(5);
        RuleFor(x => x.Value).GreaterThanOrEqualTo(0).When(x => x.Value.HasValue);
        RuleFor(x => x.Probability).InclusiveBetween(0, 100).When(x => x.Probability.HasValue);
        RuleFor(x => x.Notes).MaximumLength(4000);
    }
}

public sealed class CreateDealHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<CreateDealCommand, Result<DealDto>>
{
    public async Task<Result<DealDto>> Handle(CreateDealCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.deals.manage"))
            return Result.Failure<DealDto>("Forbidden");
        if (!tenant.IsResolved || !user.IsAuthenticated)
            return Result.Failure<DealDto>("Tenant or user not resolved");

        var tid = tenant.TenantId!.Value;

        // Resolve pipeline (default if omitted)
        var pipeline = cmd.PipelineId is Guid pid
            ? await db.Pipelines.FirstOrDefaultAsync(p => p.Id == pid && p.TenantId == tid, ct)
            : await db.Pipelines
                .Where(p => p.TenantId == tid && p.IsActive)
                .OrderByDescending(p => p.IsDefault).ThenBy(p => p.SortOrder)
                .FirstOrDefaultAsync(ct);
        if (pipeline is null) return Result.Failure<DealDto>("Pipeline not found");

        // Resolve stage (first Open by SortOrder if omitted; fall back to first active)
        PipelineStage? stage = null;
        if (cmd.StageId is Guid sid)
        {
            stage = await db.PipelineStages.FirstOrDefaultAsync(
                s => s.Id == sid && s.PipelineId == pipeline.Id && s.TenantId == tid, ct);
            if (stage is null) return Result.Failure<DealDto>("Stage not found in pipeline");
        }
        else
        {
            stage = await db.PipelineStages
                .Where(s => s.PipelineId == pipeline.Id && s.IsActive && s.Kind == PipelineStageKind.Open)
                .OrderBy(s => s.SortOrder).FirstOrDefaultAsync(ct);
            stage ??= await db.PipelineStages
                .Where(s => s.PipelineId == pipeline.Id && s.IsActive)
                .OrderBy(s => s.SortOrder).FirstOrDefaultAsync(ct);
            if (stage is null) return Result.Failure<DealDto>("Pipeline has no active stages");
        }

        // Lead snapshot — if leadId provided, overlay user-supplied fields on lead snapshot
        Lead? lead = null;
        if (cmd.LeadId is Guid lid)
        {
            lead = await db.Leads.FirstOrDefaultAsync(l => l.Id == lid && l.TenantId == tid, ct);
            if (lead is null) return Result.Failure<DealDto>("Lead not found");
        }

        var tenantRow = await db.Tenants.FirstOrDefaultAsync(t => t.Id == tid, ct);
        var defaultCurrency = tenantRow?.DefaultCurrencyCode ?? "USD";

        var deal = new Deal
        {
            Id          = Guid.NewGuid(),
            TenantId    = tid,
            Title       = cmd.Title,
            PipelineId  = pipeline.Id,
            StageId     = stage.Id,
            LeadId      = cmd.LeadId,
            ContactName = string.IsNullOrWhiteSpace(cmd.ContactName)
                ? (lead is not null ? $"{lead.FirstName} {lead.LastName}".Trim() : "")
                : cmd.ContactName,
            ContactEmail = cmd.ContactEmail ?? lead?.Email,
            ContactPhone = cmd.ContactPhone ?? lead?.Phone,
            CompanyName  = cmd.CompanyName  ?? lead?.Company,
            Value        = cmd.Value,
            Currency     = string.IsNullOrEmpty(cmd.Currency) ? defaultCurrency : cmd.Currency!,
            Probability  = cmd.Probability ?? stage.DefaultProbability,
            ExpectedCloseDate = cmd.ExpectedCloseDate,
            OwnerUserId  = cmd.OwnerUserId ?? user.UserId,
            Tags         = cmd.Tags?.ToList() ?? new(),
            Notes        = cmd.Notes,
            Status       = stage.Kind switch
            {
                PipelineStageKind.Won  => DealStatus.Won,
                PipelineStageKind.Lost => DealStatus.Lost,
                _                      => DealStatus.Open,
            },
            ActualCloseDate = stage.Kind == PipelineStageKind.Open
                ? null
                : DateOnly.FromDateTime(DateTime.UtcNow),
            CreatedAt = DateTime.UtcNow,
            CreatedBy = user.UserId,
        };

        db.Deals.Add(deal);
        db.DealActivities.Add(DealActivityLogger.Created(tid, deal.Id, user));

        await db.SaveChangesAsync(ct);

        // Return via inline projection for consistency (avoids permission re-check in GetDealHandler)
        var owner = await db.Users
            .Where(u => u.Id == deal.OwnerUserId)
            .Select(u => (u.FirstName + " " + u.LastName).Trim())
            .FirstOrDefaultAsync(ct);

        return Result.Success(new DealDto(
            deal.Id, deal.Title, deal.PipelineId, pipeline.Name, deal.StageId, stage.Name,
            stage.Kind.ToString(), stage.ColorHex,
            deal.LeadId, deal.ContactName, deal.ContactEmail, deal.ContactPhone, deal.CompanyName,
            deal.Value, deal.Currency, deal.Probability,
            deal.ExpectedCloseDate, deal.ActualCloseDate,
            deal.OwnerUserId, owner,
            deal.Tags, deal.Notes, deal.Status.ToString(),
            Convert.ToBase64String(deal.RowVersion),
            deal.CreatedAt, deal.UpdatedAt,
            RecentActivity: null
        ));
    }
}
