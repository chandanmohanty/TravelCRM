using Google.Apis.Auth.OAuth2;
using Google.Apis.Services;
using Google.Apis.Sheets.v4;
using TravelCrm.Api.Features.Crm.LeadImport.Parsing;

namespace TravelCrm.Api.Infrastructure.Google;

/// <summary>
/// Default <see cref="ISheetsReader"/> backed by the official Google Sheets v4
/// SDK. Read-only — we only ever request the spreadsheets.readonly scope.
/// </summary>
public sealed class GoogleSheetsReader : ISheetsReader
{
    /// <summary>Matches the row cap used by the CSV/xlsx parsers (T5).</summary>
    private const int MaxRows = 10_000;

    private static SheetsService NewService(string accessToken) =>
        new(new BaseClientService.Initializer
        {
            HttpClientInitializer = GoogleCredential.FromAccessToken(accessToken),
            ApplicationName = "TravelCRMPlus",
        });

    /// <summary>
    /// A1 notation requires sheet names containing anything other than
    /// [A-Za-z0-9_] to be wrapped in single quotes, with embedded single
    /// quotes doubled. Without this, "Form Responses 1" → 400 from Sheets.
    /// </summary>
    private static string QuoteA1(string tab)
    {
        var needsQuote = string.IsNullOrEmpty(tab)
            || tab.Any(c => !(char.IsLetterOrDigit(c) || c == '_'));
        return needsQuote ? "'" + tab.Replace("'", "''") + "'" : tab;
    }

    public async Task<IReadOnlyList<SheetTab>> ListTabsAsync(string accessToken, string spreadsheetId, CancellationToken ct)
    {
        using var svc = NewService(accessToken);
        var req = svc.Spreadsheets.Get(spreadsheetId);
        req.Fields = "sheets.properties.title";
        var result = await req.ExecuteAsync(ct);
        return (result.Sheets ?? Array.Empty<global::Google.Apis.Sheets.v4.Data.Sheet>())
            .Select(s => new SheetTab(s.Properties.Title))
            .ToList();
    }

    public async Task<SheetValues> ReadAsync(string accessToken, string spreadsheetId, string tab, CancellationToken ct)
    {
        using var svc = NewService(accessToken);
        var req = svc.Spreadsheets.Values.Get(spreadsheetId, $"{QuoteA1(tab)}!A:Z");
        var resp = await req.ExecuteAsync(ct);
        var raw = resp.Values;
        if (raw is null || raw.Count == 0)
            throw new LeadImportParseException("The sheet has no data.");

        // Drop fully-blank rows up front (Sheets sometimes returns trailing empties).
        var nonEmpty = raw
            .Where(r => r.Any(c => !string.IsNullOrWhiteSpace(c?.ToString())))
            .ToList();
        if (nonEmpty.Count == 0)
            throw new LeadImportParseException("The sheet has no data.");

        var headers = nonEmpty[0]
            .Select(c => (c?.ToString() ?? string.Empty).Trim())
            .ToList();
        var dataRows = nonEmpty.Skip(1).ToList();
        if (dataRows.Count > MaxRows)
            throw new LeadImportParseException(
                $"Too many rows ({dataRows.Count:N0}). The limit is 10,000 data rows.");

        var rows = new List<Dictionary<string, string>>(dataRows.Count);
        foreach (var r in dataRows)
        {
            var d = new Dictionary<string, string>(headers.Count);
            for (var i = 0; i < headers.Count; i++)
            {
                d[headers[i]] = i < r.Count
                    ? (r[i]?.ToString() ?? string.Empty).Trim()
                    : string.Empty;
            }
            if (d.Values.Any(v => !string.IsNullOrWhiteSpace(v)))
                rows.Add(d);
        }
        return new SheetValues(headers, rows);
    }
}
