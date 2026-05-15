using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.Pipelines.Commands;

public sealed record UpdatePipelineCommand(
    Guid Id,
    string Name,
    string? Description,
    bool IsActive,
    bool IsDefault
) : IRequest<Result<Guid>>;

public sealed class UpdatePipelineValidator : AbstractValidator<UpdatePipelineCommand>
{
    public UpdatePipelineValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Description).MaximumLength(500);
    }
}

public sealed class UpdatePipelineHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<UpdatePipelineCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(UpdatePipelineCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.pipelines.manage"))
            return Result.Failure<Guid>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<Guid>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;
        var p = await db.Pipelines.FirstOrDefaultAsync(
            x => x.Id == cmd.Id && x.TenantId == tid, ct);
        if (p is null) return Result.Failure<Guid>("Pipeline not found");

        // Name uniqueness within tenant
        var dup = await db.Pipelines.AnyAsync(
            x => x.TenantId == tid && x.Id != cmd.Id && x.Name == cmd.Name, ct);
        if (dup) return Result.Failure<Guid>("Another pipeline already uses this name");

        await using var tx = await db.Database.BeginTransactionAsync(ct);

        // Toggling default — unset other default
        if (cmd.IsDefault && !p.IsDefault)
        {
            await db.Pipelines
                .Where(x => x.TenantId == tid && x.Id != cmd.Id && x.IsDefault)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.IsDefault, false), ct);
        }

        p.Name        = cmd.Name;
        p.Description = cmd.Description;
        p.IsActive    = cmd.IsActive;
        p.IsDefault   = cmd.IsDefault;
        p.UpdatedAt   = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Result.Success(p.Id);
    }
}
