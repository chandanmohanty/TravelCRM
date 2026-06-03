using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.LeadImport.Commands;

public sealed record PreviewImportCommand(
    Guid StagingId, Dictionary<string, string> Mapping, string MatchKeyField)
    : IRequest<Result<PreviewResultDto>>;

public sealed class PreviewImportCommandHandler(
    ApplicationDbContext db, ITenantContext tenant, ICurrentUser user)
    : IRequestHandler<PreviewImportCommand, Result<PreviewResultDto>>
{
    public async Task<Result<PreviewResultDto>> Handle(PreviewImportCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.leads.manage"))
            return Result.Failure<PreviewResultDto>("You don't have permission to import leads.");
        if (!tenant.IsResolved) return Result.Failure<PreviewResultDto>("Tenant context not resolved.");

        var staging = await db.LeadImportStagings.FirstOrDefaultAsync(
            s => s.Id == cmd.StagingId && s.TenantId == tenant.TenantId!.Value, ct);
        if (staging is null) return Result.Failure<PreviewResultDto>("Upload session expired. Please re-upload.");

        // Defensive: treat a literal "null" / corrupt payload as empty rather than NRE.
        var rows = JsonSerializer.Deserialize<List<Dictionary<string, string>>>(staging.RowsJson)
                   ?? new List<Dictionary<string, string>>();

        // Existing emails are already canonical (Task 6 follow-up B normalised the column),
        // so a plain hash lookup is enough.
        var existingSet = await db.Leads
            .Where(l => l.TenantId == tenant.TenantId!.Value)
            .Select(l => l.Email).ToListAsync(ct);
        var existingHash = existingSet.ToHashSet(StringComparer.Ordinal);

        int willCreate = 0, willUpdate = 0, willSkip = 0;
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var sample = new List<LeadImportRowOutcome>();
        var n = 1;
        foreach (var r in rows)
        {
            n++;
            var (lead, error) = LeadFieldMap.Project(r, cmd.Mapping);
            if (error != null)
            {
                willSkip++;
                if (sample.Count < 20)
                    sample.Add(new LeadImportRowOutcome(n, "", LeadImportRowStatus.Failed, error));
                continue;
            }
            var key = lead!.Email;
            if (!seen.Add(key)) { willSkip++; continue; }
            if (existingHash.Contains(key)) willUpdate++; else willCreate++;
        }
        return Result.Success(new PreviewResultDto(willCreate, willUpdate, willSkip, sample));
    }
}
