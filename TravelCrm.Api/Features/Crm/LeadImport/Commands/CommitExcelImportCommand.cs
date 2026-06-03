using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.LeadImport.Commands;

public sealed record CommitExcelImportCommand(
    Guid StagingId, Dictionary<string, string> Mapping, string MatchKeyField)
    : IRequest<Result<LeadImportResult>>;

public sealed class CommitExcelImportCommandHandler(
    ApplicationDbContext db, ITenantContext tenant, ICurrentUser user, ILeadImportEngine engine)
    : IRequestHandler<CommitExcelImportCommand, Result<LeadImportResult>>
{
    public async Task<Result<LeadImportResult>> Handle(CommitExcelImportCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.leads.manage"))
            return Result.Failure<LeadImportResult>("You don't have permission to import leads.");
        if (!tenant.IsResolved) return Result.Failure<LeadImportResult>("Tenant context not resolved.");

        var staging = await db.LeadImportStagings.FirstOrDefaultAsync(
            s => s.Id == cmd.StagingId && s.TenantId == tenant.TenantId!.Value, ct);
        if (staging is null) return Result.Failure<LeadImportResult>("Upload session expired. Please re-upload.");

        var rows = JsonSerializer.Deserialize<List<Dictionary<string, string>>>(staging.RowsJson)!
            .Select(d => (IReadOnlyDictionary<string, string>)d).ToList();

        var result = await engine.ApplyAsync(
            tenant.TenantId!.Value, rows, cmd.Mapping, cmd.MatchKeyField,
            sourceId: null,
            actingUserId: user.IsAuthenticated ? user.UserId : null, ct);

        db.LeadImportStagings.Remove(staging);
        await db.SaveChangesAsync(ct);
        return Result.Success(result);
    }
}
