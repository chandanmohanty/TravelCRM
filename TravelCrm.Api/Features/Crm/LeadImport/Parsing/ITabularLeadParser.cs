namespace TravelCrm.Api.Features.Crm.LeadImport.Parsing;

public sealed record TabularData(
    IReadOnlyList<string> Headers,
    IReadOnlyList<Dictionary<string, string>> Rows);

public interface ITabularLeadParser
{
    /// <summary>True if this parser handles the given file extension (".xlsx" etc.).</summary>
    bool CanParse(string fileName);

    /// <summary>
    /// Parse the stream. Throws <see cref="LeadImportParseException"/> with a
    /// human message on caps/format violations. First non-empty row = headers.
    /// </summary>
    TabularData Parse(Stream stream, string fileName);
}

public sealed class LeadImportParseException(string message) : Exception(message);
