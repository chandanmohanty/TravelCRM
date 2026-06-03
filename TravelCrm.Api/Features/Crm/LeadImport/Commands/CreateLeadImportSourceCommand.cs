using System.Text.Json;
using FluentValidation;
using Hangfire;
using MediatR;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Crm;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.LeadImport.Commands;

public sealed record CreateLeadImportSourceCommand(
    string DisplayName,
    string SpreadsheetId,
    string SheetName,
    Dictionary<string, string> ColumnMapping,
    string MatchKeyField,
    string SyncCadence)
    : IRequest<Result<LeadImportSourceDto>>;

public sealed class CreateLeadImportSourceCommandValidator
    : AbstractValidator<CreateLeadImportSourceCommand>
{
    public CreateLeadImportSourceCommandValidator()
    {
        RuleFor(x => x.DisplayName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.SpreadsheetId).NotEmpty().MaximumLength(200);
        RuleFor(x => x.SheetName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.MatchKeyField).NotEmpty().MaximumLength(50);
        RuleFor(x => x.ColumnMapping)
            .NotNull()
            .Must(m => m != null && m.ContainsKey("email") && !string.IsNullOrWhiteSpace(m["email"]))
            .WithMessage("ColumnMapping must include a mapping for 'email'.");
    }
}

public sealed class CreateLeadImportSourceCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user)
    : IRequestHandler<CreateLeadImportSourceCommand, Result<LeadImportSourceDto>>
{
    public async Task<Result<LeadImportSourceDto>> Handle(
        CreateLeadImportSourceCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.leads.manage"))
            return Result.Failure<LeadImportSourceDto>("You don't have permission to manage lead sources.");
        if (!tenant.IsResolved)
            return Result.Failure<LeadImportSourceDto>("Tenant context not resolved.");

        if (!Enum.TryParse<SyncCadence>(cmd.SyncCadence, ignoreCase: true, out var cadence))
            return Result.Failure<LeadImportSourceDto>(
                $"Unknown sync cadence '{cmd.SyncCadence}'. Allowed: Manual, Every15Min, Hourly, Daily.");

        var src = new LeadImportSource
        {
            TenantId = tenant.TenantId!.Value,
            Kind = LeadImportSourceKind.GoogleSheet,
            DisplayName = cmd.DisplayName,
            SpreadsheetId = cmd.SpreadsheetId,
            SheetName = cmd.SheetName,
            ColumnMapping = JsonSerializer.Serialize(cmd.ColumnMapping),
            MatchKeyField = cmd.MatchKeyField,
            SyncCadence = cadence,
            Status = LeadImportSourceStatus.Active,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = user.IsAuthenticated ? user.UserId : null,
        };
        db.LeadImportSources.Add(src);
        await db.SaveChangesAsync(ct);

        // Enqueue an immediate first sync. The stub job logs; T13 will do real work.
        BackgroundJob.Enqueue<TravelCrm.Api.Infrastructure.Jobs.RunLeadImportSyncJob>(
            j => j.ExecuteAsync(src.Id, CancellationToken.None));

        return Result.Success(LeadImportSourceMapper.ToDto(src));
    }
}
