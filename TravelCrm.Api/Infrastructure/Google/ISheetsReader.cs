namespace TravelCrm.Api.Infrastructure.Google;

/// <summary>One tab in a Google spreadsheet.</summary>
public sealed record SheetTab(string Title);

/// <summary>
/// Headers + data rows read from a single tab. Each row is a header→value
/// dictionary; short rows are padded with empty strings so callers can index
/// by header name without bounds checks.
/// </summary>
public sealed record SheetValues(
    IReadOnlyList<string> Headers,
    IReadOnlyList<Dictionary<string, string>> Rows);

/// <summary>
/// Thin wrapper around <see cref="Google.Apis.Sheets.v4.SheetsService"/> so the
/// engine + sync jobs can be tested without network. Implementations accept an
/// already-minted access token (callers route through
/// <see cref="IGoogleTokenProvider.GetAccessTokenAsync"/>).
/// </summary>
public interface ISheetsReader
{
    Task<IReadOnlyList<SheetTab>> ListTabsAsync(string accessToken, string spreadsheetId, CancellationToken ct);
    Task<SheetValues> ReadAsync(string accessToken, string spreadsheetId, string tab, CancellationToken ct);
}
