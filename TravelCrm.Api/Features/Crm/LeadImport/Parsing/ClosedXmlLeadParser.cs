using ClosedXML.Excel;

namespace TravelCrm.Api.Features.Crm.LeadImport.Parsing;

public sealed class ClosedXmlLeadParser : ITabularLeadParser
{
    private const int MaxRows = 10_000;

    public bool CanParse(string fileName) =>
        fileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase) ||
        fileName.EndsWith(".xlsm", StringComparison.OrdinalIgnoreCase);

    public TabularData Parse(Stream stream, string fileName)
    {
        if (fileName.EndsWith(".xls", StringComparison.OrdinalIgnoreCase))
            throw new LeadImportParseException("Legacy .xls files are not supported. Please save as .xlsx and retry.");

        XLWorkbook wb;
        try { wb = new XLWorkbook(stream); }
        catch (Exception ex) { throw new LeadImportParseException($"Could not read the workbook: {ex.Message}"); }

        using (wb)
        {
            var ws = wb.Worksheets.FirstOrDefault()
                ?? throw new LeadImportParseException("The workbook has no sheets.");
            var range = ws.RangeUsed();
            if (range == null) throw new LeadImportParseException("The first sheet has no data.");

            var allRows = range.RowsUsed().ToList();
            var headerRow = allRows.FirstOrDefault(r => r.Cells().Any(c => !string.IsNullOrWhiteSpace(c.GetString())))
                ?? throw new LeadImportParseException("Could not find a header row.");

            var headers = headerRow.Cells(1, range.ColumnCount())
                .Select(c => c.GetString().Trim()).ToList();

            var dataRows = allRows.SkipWhile(r => r.RowNumber() <= headerRow.RowNumber()).ToList();
            if (dataRows.Count > MaxRows)
                throw new LeadImportParseException($"Too many rows ({dataRows.Count:N0}). The limit is 10,000 data rows.");

            var rows = new List<Dictionary<string, string>>();
            foreach (var r in dataRows)
            {
                var d = new Dictionary<string, string>();
                for (var i = 0; i < headers.Count; i++)
                    d[headers[i]] = r.Cell(i + 1).GetString().Trim();
                if (d.Values.Any(v => !string.IsNullOrWhiteSpace(v))) rows.Add(d);
            }
            return new TabularData(headers, rows);
        }
    }
}
