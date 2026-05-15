using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Domain.Entities.Crm;

namespace TravelCrm.Api.Infrastructure.Persistence;

/// <summary>
/// Phase 1 seeder. Idempotent. Runs after PlanSeeder in SeedData.SeedAsync.
/// Responsibilities:
///   1. Every tenant without any Pipeline gets a default "Sales" + 6 stages.
///   2. Legacy LeadStatus.Converted rows are demoted to Qualified (one-shot).
/// </summary>
public static class PipelineSeeder
{
    private sealed record StageDef(string Name, int SortOrder, int Probability, PipelineStageKind Kind, string Color);

    private static readonly StageDef[] DefaultStages =
    {
        new("Prospect",      10,  10, PipelineStageKind.Open, "#94a3b8"),
        new("Qualification", 20,  25, PipelineStageKind.Open, "#3b82f6"),
        new("Proposal",      30,  50, PipelineStageKind.Open, "#f59e0b"),
        new("Negotiation",   40,  75, PipelineStageKind.Open, "#8b5cf6"),
        new("Closed Won",    50, 100, PipelineStageKind.Won,  "#16a34a"),
        new("Closed Lost",   60,   0, PipelineStageKind.Lost, "#dc2626"),
    };

    public static async Task SeedAsync(ApplicationDbContext db, CancellationToken ct = default)
    {
        // 1. Default pipeline per tenant
        var tenantIds = await db.Tenants.Select(t => t.Id).ToListAsync(ct);
        foreach (var tid in tenantIds)
        {
            var hasAny = await db.Pipelines.AnyAsync(p => p.TenantId == tid, ct);
            if (hasAny) continue;

            db.Pipelines.Add(new Pipeline
            {
                Id          = Guid.NewGuid(),
                TenantId    = tid,
                Name        = "Sales",
                Description = "Default sales pipeline. Edit stages in CRM → Pipelines.",
                IsDefault   = true,
                IsActive    = true,
                SortOrder   = 10,
                CreatedAt   = DateTime.UtcNow,
                Stages      = DefaultStages.Select(sd => new PipelineStage
                {
                    Id                 = Guid.NewGuid(),
                    TenantId           = tid,
                    Name               = sd.Name,
                    SortOrder          = sd.SortOrder,
                    DefaultProbability = sd.Probability,
                    Kind               = sd.Kind,
                    ColorHex           = sd.Color,
                    IsActive           = true,
                    CreatedAt          = DateTime.UtcNow,
                }).ToList(),
            });
        }
        await db.SaveChangesAsync(ct);

        // 2. Backfill legacy Lead.Status = Converted → Qualified
#pragma warning disable CS0618
        var converted = await db.Leads
            .Where(l => l.Status == LeadStatus.Converted)
            .ExecuteUpdateAsync(s => s.SetProperty(l => l.Status, LeadStatus.Qualified), ct);
#pragma warning restore CS0618

        if (converted > 0)
            Console.WriteLine($"[PipelineSeeder] Demoted {converted} legacy Converted leads to Qualified.");
    }
}
