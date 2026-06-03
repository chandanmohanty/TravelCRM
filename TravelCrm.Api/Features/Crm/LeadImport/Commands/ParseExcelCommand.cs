using System.Text.Json;
using MediatR;
using Microsoft.AspNetCore.Http;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Crm;
using TravelCrm.Api.Features.Crm.LeadImport.Parsing;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.LeadImport.Commands;

public sealed record ParseExcelCommand(IFormFile File) : IRequest<Result<ParseResultDto>>;

public sealed class ParseExcelCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user,
    IEnumerable<ITabularLeadParser> parsers)
    : IRequestHandler<ParseExcelCommand, Result<ParseResultDto>>
{
    private const long MaxBytes = 5 * 1024 * 1024;

    public async Task<Result<ParseResultDto>> Handle(ParseExcelCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.leads.manage"))
            return Result.Failure<ParseResultDto>("You don't have permission to import leads.");
        if (!tenant.IsResolved) return Result.Failure<ParseResultDto>("Tenant context not resolved.");

        var file = cmd.File;
        if (file is null || file.Length == 0) return Result.Failure<ParseResultDto>("No file uploaded.");
        if (file.Length > MaxBytes) return Result.Failure<ParseResultDto>("File exceeds the 5 MB limit.");

        var parser = parsers.FirstOrDefault(p => p.CanParse(file.FileName));
        if (parser is null)
            return Result.Failure<ParseResultDto>("Unsupported file type. Upload .xlsx, .xlsm or .csv.");

        TabularData data;
        try
        {
            await using var s = file.OpenReadStream();
            using var ms = new MemoryStream();
            await s.CopyToAsync(ms, ct); ms.Position = 0;
            data = parser.Parse(ms, file.FileName);
        }
        catch (LeadImportParseException ex) { return Result.Failure<ParseResultDto>(ex.Message); }

        var staging = new LeadImportStaging
        {
            TenantId    = tenant.TenantId!.Value,
            HeadersJson = JsonSerializer.Serialize(data.Headers),
            RowsJson    = JsonSerializer.Serialize(data.Rows),
        };
        db.LeadImportStagings.Add(staging);
        await db.SaveChangesAsync(ct);

        return Result.Success(new ParseResultDto(
            staging.Id, data.Headers, data.Rows.Take(5).ToList(), data.Rows.Count));
    }
}
