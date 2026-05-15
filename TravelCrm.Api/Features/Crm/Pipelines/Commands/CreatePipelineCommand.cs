using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Crm;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.Pipelines.Commands;

public sealed record CreatePipelineCommand(
    string Name,
    string? Description,
    bool IsDefault,
    IReadOnlyList<InitialStage>? InitialStages
) : IRequest<Result<PipelineDto>>;

public sealed record InitialStage(
    string Name, int Probability, string Kind, string ColorHex);

public sealed class CreatePipelineValidator : AbstractValidator<CreatePipelineCommand>
{
    public CreatePipelineValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Description).MaximumLength(500);
        RuleForEach(x => x.InitialStages!).ChildRules(s =>
        {
            s.RuleFor(i => i.Name).NotEmpty().MaximumLength(100);
            s.RuleFor(i => i.Probability).InclusiveBetween(0, 100);
            s.RuleFor(i => i.Kind).Must(k => k is "Open" or "Won" or "Lost");
            s.RuleFor(i => i.ColorHex).Matches("^#[0-9A-Fa-f]{6}$");
        }).When(x => x.InitialStages is { Count: > 0 });
    }
}

public sealed class CreatePipelineHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<CreatePipelineCommand, Result<PipelineDto>>
{
    public async Task<Result<PipelineDto>> Handle(CreatePipelineCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.pipelines.manage"))
            return Result.Failure<PipelineDto>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<PipelineDto>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;

        var dup = await db.Pipelines.AnyAsync(
            p => p.TenantId == tid && p.Name == cmd.Name, ct);
        if (dup) return Result.Failure<PipelineDto>("A pipeline with this name already exists");

        var nextSort = (await db.Pipelines.Where(p => p.TenantId == tid)
            .MaxAsync(p => (int?)p.SortOrder, ct) ?? 0) + 10;

        var pipeline = new Pipeline
        {
            Id          = Guid.NewGuid(),
            TenantId    = tid,
            Name        = cmd.Name,
            Description = cmd.Description,
            IsDefault   = cmd.IsDefault,
            IsActive    = true,
            SortOrder   = nextSort,
            CreatedAt   = DateTime.UtcNow,
        };

        // Default 6 stages if none supplied
        var stages = (cmd.InitialStages is { Count: > 0 }
            ? cmd.InitialStages.Select((s, i) => (s.Name, sort: (i + 1) * 10, s.Probability, s.Kind, s.ColorHex))
            : new (string Name, int sort, int Probability, string Kind, string ColorHex)[]
              {
                  ("Prospect",      10,  10, "Open", "#94a3b8"),
                  ("Qualification", 20,  25, "Open", "#3b82f6"),
                  ("Proposal",      30,  50, "Open", "#f59e0b"),
                  ("Negotiation",   40,  75, "Open", "#8b5cf6"),
                  ("Closed Won",    50, 100, "Won",  "#16a34a"),
                  ("Closed Lost",   60,   0, "Lost", "#dc2626"),
              }).ToList();

        pipeline.Stages = stages.Select(s => new PipelineStage
        {
            Id                 = Guid.NewGuid(),
            TenantId           = tid,
            Name               = s.Name,
            SortOrder          = s.sort,
            DefaultProbability = s.Probability,
            Kind               = Enum.Parse<PipelineStageKind>(s.Kind),
            ColorHex           = s.ColorHex,
            IsActive           = true,
        }).ToList();

        await using var tx = await db.Database.BeginTransactionAsync(ct);

        // If this is marked default, unset any existing default
        if (cmd.IsDefault)
        {
            await db.Pipelines
                .Where(p => p.TenantId == tid && p.IsDefault)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.IsDefault, false), ct);
        }

        db.Pipelines.Add(pipeline);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return Result.Success(new PipelineDto(
            pipeline.Id, pipeline.Name, pipeline.Description, pipeline.IsDefault, pipeline.IsActive, pipeline.SortOrder,
            0,
            pipeline.Stages.OrderBy(s => s.SortOrder).Select(s => new PipelineStageDto(
                s.Id, s.PipelineId, s.Name, s.SortOrder, s.DefaultProbability,
                s.Kind.ToString(), s.ColorHex, s.IsActive, 0
            )).ToList()
        ));
    }
}
