using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.Pipelines.Commands;

public sealed record DeletePipelineCommand(Guid Id) : IRequest<Result<bool>>;

public sealed class DeletePipelineHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<DeletePipelineCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(DeletePipelineCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.pipelines.manage"))
            return Result.Failure<bool>("Forbidden");
        if (!tenant.IsResolved)
            return Result.Failure<bool>("Tenant not resolved");

        var tid = tenant.TenantId!.Value;
        var p = await db.Pipelines.FirstOrDefaultAsync(
            x => x.Id == cmd.Id && x.TenantId == tid, ct);
        if (p is null) return Result.Failure<bool>("Pipeline not found");

        var dealCount = await db.Deals.CountAsync(
            d => d.TenantId == tid && d.PipelineId == p.Id && !d.IsDeleted, ct);
        if (dealCount > 0)
            return Result.Failure<bool>($"Pipeline has {dealCount} deal(s) — move or close them first");

        if (p.IsDefault)
            return Result.Failure<bool>("Cannot delete the default pipeline. Mark another pipeline as default first.");

        db.Pipelines.Remove(p);
        await db.SaveChangesAsync(ct);
        return Result.Success(true);
    }
}
