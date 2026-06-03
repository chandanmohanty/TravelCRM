using System.Text.Json;
using TravelCrm.Api.Domain.Entities.Crm;

namespace TravelCrm.Api.Features.Crm.LeadImport;

/// <summary>
/// Shared projection between LeadImportSource (entity) and LeadImportSourceDto (wire).
/// Centralised so Create/Update/List handlers (and the T13 sync job) project consistently.
/// </summary>
internal static class LeadImportSourceMapper
{
    public static Dictionary<string, string> DeserialiseMapping(string json) =>
        string.IsNullOrWhiteSpace(json)
            ? new Dictionary<string, string>()
            : JsonSerializer.Deserialize<Dictionary<string, string>>(json)
              ?? new Dictionary<string, string>();

    public static LeadImportSourceDto ToDto(LeadImportSource s) => new(
        s.Id,
        s.DisplayName,
        s.SpreadsheetId,
        s.SheetName,
        DeserialiseMapping(s.ColumnMapping),
        s.MatchKeyField,
        s.SyncCadence.ToString(),
        s.Status.ToString(),
        s.LastPolledAt,
        s.LastSuccessAt,
        s.LastResultJson,
        s.LastError,
        Convert.ToBase64String(s.RowVersion));
}
