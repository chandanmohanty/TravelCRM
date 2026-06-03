using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Google;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.LeadImport.Queries;

public sealed record GetSheetHeadersQuery(string SpreadsheetId, string Tab)
    : IRequest<Result<SheetHeadersDto>>;

public sealed class GetSheetHeadersQueryHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user,
    IGoogleTokenProvider tokenProvider,
    ISheetsReader sheetsReader)
    : IRequestHandler<GetSheetHeadersQuery, Result<SheetHeadersDto>>
{
    public async Task<Result<SheetHeadersDto>> Handle(GetSheetHeadersQuery q, CancellationToken ct)
    {
        if (!user.HasPermission("crm.leads.manage"))
            return Result.Failure<SheetHeadersDto>("You don't have permission to import leads.");
        if (!tenant.IsResolved)
            return Result.Failure<SheetHeadersDto>("Tenant context not resolved.");

        var token = await db.GoogleOAuthTokens
            .FirstOrDefaultAsync(t => t.TenantId == tenant.TenantId!.Value, ct);
        if (token is null)
            return Result.Failure<SheetHeadersDto>("Google not connected.");

        try
        {
            var access = await tokenProvider.GetAccessTokenAsync(tenant.TenantId!.Value, token.RefreshToken!, ct);
            var values = await sheetsReader.ReadAsync(access, q.SpreadsheetId, q.Tab, ct);
            var preview = values.Rows.Take(5).ToList();
            return Result.Success(new SheetHeadersDto(values.Headers, preview));
        }
        catch (Exception ex)
        {
            return Result.Failure<SheetHeadersDto>(
                $"Could not read sheet headers: {ex.Message}");
        }
    }
}
