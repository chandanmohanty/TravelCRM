namespace TravelCrm.Api.Features.Crm.LeadImport;

public sealed record ImportFieldDto(string Key, string Label, bool Required);

public enum LeadImportRowStatus { Created, Updated, Skipped, Failed }

public sealed record LeadImportRowOutcome(int RowNumber, string Key, LeadImportRowStatus Status, string? Reason);

public sealed record LeadImportResult(
    int Created, int Updated, int Skipped, int Failed,
    IReadOnlyList<LeadImportRowOutcome> Errors); // first 100 non-success rows

public sealed record ParseResultDto(
    Guid StagingId, IReadOnlyList<string> Headers,
    IReadOnlyList<Dictionary<string, string>> PreviewRows, int TotalRows);

public sealed record PreviewResultDto(int WillCreate, int WillUpdate, int WillSkip,
    IReadOnlyList<LeadImportRowOutcome> SampleErrors);

public sealed record GoogleStatusDto(bool Configured, bool Connected, string GrantedScopes);

public sealed record SheetTabDto(string Title);
public sealed record SheetHeadersDto(IReadOnlyList<string> Headers,
    IReadOnlyList<Dictionary<string, string>> PreviewRows);

public sealed record LeadImportSourceDto(
    Guid Id, string DisplayName, string SpreadsheetId, string SheetName,
    Dictionary<string, string> ColumnMapping, string MatchKeyField,
    string SyncCadence, string Status, DateTime? LastPolledAt, DateTime? LastSuccessAt,
    string? LastResultJson, string? LastError, string RowVersion);
