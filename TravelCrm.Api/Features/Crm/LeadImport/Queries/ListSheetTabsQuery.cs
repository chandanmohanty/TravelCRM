using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Google;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.LeadImport.Queries;

public sealed record ListSheetTabsQuery(string SpreadsheetId) : IRequest<Result<IReadOnlyList<SheetTabDto>>>;

public sealed class ListSheetTabsQueryHandler(
    ApplicationDbContext db,
    ITenantContext tenant,
    ICurrentUser user,
    IGoogleTokenProvider tokenProvider,
    ISheetsReader sheetsReader)
    : IRequestHandler<ListSheetTabsQuery, Result<IReadOnlyList<SheetTabDto>>>
{
    public async Task<Result<IReadOnlyList<SheetTabDto>>> Handle(ListSheetTabsQuery q, CancellationToken ct)
    {
        if (!user.HasPermission("crm.leads.manage"))
            return Result.Failure<IReadOnlyList<SheetTabDto>>("You don't have permission to import leads.");
        if (!tenant.IsResolved)
            return Result.Failure<IReadOnlyList<SheetTabDto>>("Tenant context not resolved.");

        var token = await db.GoogleOAuthTokens
            .FirstOrDefaultAsync(t => t.TenantId == tenant.TenantId!.Value, ct);
        if (token is null)
            return Result.Failure<IReadOnlyList<SheetTabDto>>("Google not connected.");

        try
        {
            var access = await tokenProvider.GetAccessTokenAsync(tenant.TenantId!.Value, token.RefreshToken!, ct);
            var tabs = await sheetsReader.ListTabsAsync(access, q.SpreadsheetId, ct);
            return Result.Success<IReadOnlyList<SheetTabDto>>(
                tabs.Select(t => new SheetTabDto(t.Title)).ToList());
        }
        catch (Exception ex)
        {
            return Result.Failure<IReadOnlyList<SheetTabDto>>(
                $"Could not read spreadsheet tabs: {ex.Message}");
        }
    }
}
