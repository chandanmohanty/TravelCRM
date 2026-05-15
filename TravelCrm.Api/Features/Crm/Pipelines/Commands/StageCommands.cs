using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Crm;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.Pipelines.Commands;

// ── AddStage ────────────────────────────────────────────────────────────────

public sealed record AddStageCommand(
    Guid PipelineId,
    string Name,
    int Probability,
    string Kind,
    string ColorHex,
    int? SortOrder
) : IRequest<Result<PipelineStageDto>>;

public sealed class AddStageValidator : AbstractValidator<AddStageCommand>
{
    public AddStageValidator()
    {
        RuleFor(x => x.PipelineId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Probability).InclusiveBetween(0, 100);
        RuleFor(x => x.Kind).Must(k => k is "Open" or "Won" or "Lost");
        RuleFor(x => x.ColorHex).Matches("^#[0-9A-Fa-f]{6}$");
    }
}

public sealed class AddStageHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<AddStageCommand, Result<PipelineStageDto>>
{
    public async Task<Result<PipelineStageDto>> Handle(AddStageCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.pipelines.manage"))
            return Result.Failure<PipelineStageDto>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<PipelineStageDto>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;
        var pipeline = await db.Pipelines.FirstOrDefaultAsync(
            p => p.Id == cmd.PipelineId && p.TenantId == tid, ct);
        if (pipeline is null) return Result.Failure<PipelineStageDto>("Pipeline not found");

        var dup = await db.PipelineStages.AnyAsync(
            s => s.PipelineId == cmd.PipelineId && s.Name == cmd.Name, ct);
        if (dup) return Result.Failure<PipelineStageDto>("A stage with this name already exists on the pipeline");

        var sortOrder = cmd.SortOrder ?? (
            (await db.PipelineStages.Where(s => s.PipelineId == cmd.PipelineId)
                .MaxAsync(s => (int?)s.SortOrder, ct) ?? 0) + 10);

        var stage = new PipelineStage
        {
            Id                 = Guid.NewGuid(),
            TenantId           = tid,
            PipelineId         = cmd.PipelineId,
            Name               = cmd.Name,
            SortOrder          = sortOrder,
            DefaultProbability = cmd.Probability,
            Kind               = Enum.Parse<PipelineStageKind>(cmd.Kind),
            ColorHex           = cmd.ColorHex,
            IsActive           = true,
        };
        db.PipelineStages.Add(stage);
        await db.SaveChangesAsync(ct);

        return Result.Success(new PipelineStageDto(
            stage.Id, stage.PipelineId, stage.Name, stage.SortOrder, stage.DefaultProbability,
            stage.Kind.ToString(), stage.ColorHex, stage.IsActive, 0));
    }
}

// ── UpdateStage ─────────────────────────────────────────────────────────────

public sealed record UpdateStageCommand(
    Guid PipelineId,
    Guid StageId,
    string Name,
    int Probability,
    string Kind,
    string ColorHex,
    bool IsActive
) : IRequest<Result<Guid>>;

public sealed class UpdateStageValidator : AbstractValidator<UpdateStageCommand>
{
    public UpdateStageValidator()
    {
        RuleFor(x => x.PipelineId).NotEmpty();
        RuleFor(x => x.StageId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Probability).InclusiveBetween(0, 100);
        RuleFor(x => x.Kind).Must(k => k is "Open" or "Won" or "Lost");
        RuleFor(x => x.ColorHex).Matches("^#[0-9A-Fa-f]{6}$");
    }
}

public sealed class UpdateStageHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<UpdateStageCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(UpdateStageCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.pipelines.manage"))
            return Result.Failure<Guid>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<Guid>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;
        var stage = await db.PipelineStages.FirstOrDefaultAsync(
            s => s.Id == cmd.StageId && s.PipelineId == cmd.PipelineId && s.TenantId == tid, ct);
        if (stage is null) return Result.Failure<Guid>("Stage not found");

        var dup = await db.PipelineStages.AnyAsync(
            s => s.PipelineId == cmd.PipelineId && s.Id != cmd.StageId && s.Name == cmd.Name, ct);
        if (dup) return Result.Failure<Guid>("Another stage on this pipeline already uses this name");

        stage.Name               = cmd.Name;
        stage.DefaultProbability = cmd.Probability;
        stage.Kind               = Enum.Parse<PipelineStageKind>(cmd.Kind);
        stage.ColorHex           = cmd.ColorHex;
        stage.IsActive           = cmd.IsActive;

        await db.SaveChangesAsync(ct);
        return Result.Success(stage.Id);
    }
}

// ── DeleteStage ─────────────────────────────────────────────────────────────

public sealed record DeleteStageCommand(Guid PipelineId, Guid StageId) : IRequest<Result<bool>>;

public sealed class DeleteStageHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<DeleteStageCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(DeleteStageCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.pipelines.manage"))
            return Result.Failure<bool>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<bool>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;
        var stage = await db.PipelineStages.FirstOrDefaultAsync(
            s => s.Id == cmd.StageId && s.PipelineId == cmd.PipelineId && s.TenantId == tid, ct);
        if (stage is null) return Result.Failure<bool>("Stage not found");

        var dealCount = await db.Deals.CountAsync(
            d => d.TenantId == tid && d.StageId == cmd.StageId && !d.IsDeleted, ct);
        if (dealCount > 0)
            return Result.Failure<bool>($"Stage has {dealCount} deal(s) — move them first");

        db.PipelineStages.Remove(stage);
        await db.SaveChangesAsync(ct);
        return Result.Success(true);
    }
}

// ── ReorderStages ───────────────────────────────────────────────────────────

public sealed record ReorderStagesCommand(
    Guid PipelineId,
    IReadOnlyList<Guid> StageIds
) : IRequest<Result<bool>>;

public sealed class ReorderStagesValidator : AbstractValidator<ReorderStagesCommand>
{
    public ReorderStagesValidator()
    {
        RuleFor(x => x.PipelineId).NotEmpty();
        RuleFor(x => x.StageIds).NotEmpty();
    }
}

public sealed class ReorderStagesHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<ReorderStagesCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(ReorderStagesCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.pipelines.manage"))
            return Result.Failure<bool>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<bool>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;
        var stages = await db.PipelineStages
            .Where(s => s.PipelineId == cmd.PipelineId && s.TenantId == tid)
            .ToListAsync(ct);

        if (stages.Count != cmd.StageIds.Count ||
            stages.Any(s => !cmd.StageIds.Contains(s.Id)))
            return Result.Failure<bool>("Stage ID list doesn't match the pipeline's stages");

        var lookup = stages.ToDictionary(s => s.Id);
        for (int i = 0; i < cmd.StageIds.Count; i++)
            lookup[cmd.StageIds[i]].SortOrder = (i + 1) * 10;

        await db.SaveChangesAsync(ct);
        return Result.Success(true);
    }
}
