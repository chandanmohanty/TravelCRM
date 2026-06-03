namespace TravelCrm.Api.Features.Crm.LeadImport;

public interface ILeadImportEngine
{
    /// <param name="sourceId">null = Excel stateless always-update; non-null =
    /// Sheets path using LeadImportRowState hash-skip + A3 update-only-when-changed.</param>
    Task<LeadImportResult> ApplyAsync(
        Guid tenantId,
        IReadOnlyList<IReadOnlyDictionary<string, string>> rows,
        IReadOnlyDictionary<string, string> mapping,
        string matchKeyField,
        Guid? sourceId,
        Guid? actingUserId,
        CancellationToken ct);
}
