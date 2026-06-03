using System.Text.Json;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Crm;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.LeadImport.Commands;

public sealed record UpdateLeadImportSourceCommand(
    Guid Id,
    string RowVersion,
    string DisplayName,
    string SheetName,
    Dictionary<string, string> ColumnMapping,
    string MatchKeyField,
    string SyncCadence)
    : IRequest<Result<LeadImportSourceDto>>;

public sealed class UpdateLeadImportSourceCommandValidator
    : AbstractValidator<UpdateLeadImportSourceCommand>
{
    public UpdateLeadImportSourceCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.RowVersion).NotEmpty();
        RuleFor(x => x.DisplayName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.SheetName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.MatchKeyField).NotEmpty().MaximumLength(50);
        RuleFor(x => x.SyncCadence).NotEmpty();
        RuleFor(x => x.ColumnMapping)
            .NotNull()
            .Must(m => m != null && m.ContainsKey("email") && !string.IsNullOrWhiteSpace(m["email"]))
            .WithMessage("ColumnMapping must include a mapping for 'email'.");
    }
}

public sealed class UpdateLeadImportSourceCommandHandler(
    ApplicationDbContext db, ITenantContext tenant, ICurrentUser user)
    : IRequestHandler<UpdateLeadImportSourceCommand, Result<LeadImportSourceDto>>
{
    public async Task<Result<LeadImportSourceDto>> Handle(
        UpdateLeadImportSourceCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.leads.manage"))
            return Result.Failure<LeadImportSourceDto>("You don't have permission to manage lead sources.");
        if (!tenant.IsResolved)
            return Result.Failure<LeadImportSourceDto>("Tenant context not resolved.");

        if (!Enum.TryParse<SyncCadence>(cmd.SyncCadence, ignoreCase: true, out var cadence))
            return Result.Failure<LeadImportSourceDto>(
                $"Unknown sync cadence '{cmd.SyncCadence}'.");

        var src = await db.LeadImportSources
            .FirstOrDefaultAsync(s => s.Id == cmd.Id && s.TenantId == tenant.TenantId!.Value, ct);
        if (src is null) return Result.Failure<LeadImportSourceDto>("Source not found.");

        byte[] clientRowVersion;
        try { clientRowVersion = Convert.FromBase64String(cmd.RowVersion); }
        catch { return Result.Failure<LeadImportSourceDto>("Invalid RowVersion."); }

        db.Entry(src).Property(s => s.RowVersion).OriginalValue = clientRowVersion;

        src.DisplayName = cmd.DisplayName;
        src.SheetName = cmd.SheetName;
        src.ColumnMapping = JsonSerializer.Serialize(cmd.ColumnMapping);
        src.MatchKeyField = cmd.MatchKeyField;
        src.SyncCadence = cadence;
        src.UpdatedAt = DateTime.UtcNow;
        src.UpdatedBy = user.IsAuthenticated ? user.UserId : null;

        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<LeadImportSourceDto>(
                "This connection was changed elsewhere. Reload and retry.");
        }
        return Result.Success(LeadImportSourceMapper.ToDto(src));
    }
}
