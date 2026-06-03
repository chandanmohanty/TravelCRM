using System.Text;

namespace TravelCrm.Api.Features.Crm.LeadImport.Parsing;

public sealed class CsvLeadParser : ITabularLeadParser
{
    private const int MaxRows = 10_000;

    public bool CanParse(string fileName) =>
        fileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase);

    public TabularData Parse(Stream stream, string fileName)
    {
        using var reader = new StreamReader(stream, Encoding.UTF8, true);
        var lines = new List<List<string>>();
        var fields = new List<string>();
        var sb = new StringBuilder();
        bool inQuotes = false;
        int ch;
        void EndField() { fields.Add(sb.ToString()); sb.Clear(); }
        void EndLine() { EndField(); lines.Add(new List<string>(fields)); fields.Clear(); }

        while ((ch = reader.Read()) != -1)
        {
            var c = (char)ch;
            if (inQuotes)
            {
                if (c == '"')
                {
                    if (reader.Peek() == '"') { reader.Read(); sb.Append('"'); }
                    else inQuotes = false;
                }
                else sb.Append(c);
            }
            else
            {
                if (c == '"') inQuotes = true;
                else if (c == ',') EndField();
                else if (c == '\r')
                {
                    if (reader.Peek() == '\n') reader.Read();  // CRLF: consume the LF too
                    EndLine();                                  // CR-only: end line at the CR
                }
                else if (c == '\n') EndLine();
                else sb.Append(c);
            }
        }
        if (inQuotes) throw new LeadImportParseException("Unterminated quoted field in CSV.");
        if (sb.Length > 0 || fields.Count > 0) EndLine();

        var nonEmpty = lines.Where(l => l.Any(c => !string.IsNullOrWhiteSpace(c))).ToList();
        if (nonEmpty.Count == 0) throw new LeadImportParseException("The file has no data.");

        var headers = nonEmpty[0].Select(h => h.Trim()).ToList();
        var dataLines = nonEmpty.Skip(1).ToList();
        if (dataLines.Count > MaxRows)
            throw new LeadImportParseException($"Too many rows ({dataLines.Count:N0}). The limit is 10,000 data rows.");

        var rows = dataLines.Select(l =>
        {
            var d = new Dictionary<string, string>();
            for (var i = 0; i < headers.Count; i++)
                d[headers[i]] = i < l.Count ? l[i] : string.Empty;
            return d;
        }).ToList();

        return new TabularData(headers, rows);
    }
}
