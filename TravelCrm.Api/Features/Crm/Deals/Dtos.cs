namespace TravelCrm.Api.Features.Crm.Deals;

public sealed record DealDto(
    Guid Id,
    string Title,
    Guid PipelineId,
    string PipelineName,
    Guid StageId,
    string StageName,
    string StageKind,
    string StageColor,
    Guid? LeadId,
    string ContactName,
    string? ContactEmail,
    string? ContactPhone,
    string? CompanyName,
    decimal? Value,
    string Currency,
    int Probability,
    DateOnly? ExpectedCloseDate,
    DateOnly? ActualCloseDate,
    Guid OwnerUserId,
    string? OwnerName,
    IReadOnlyList<string> Tags,
    string? Notes,
    string Status,
    string RowVersion,       // base64-encoded byte[] for client passthrough
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    IReadOnlyList<DealActivityDto>? RecentActivity);

public sealed record DealActivityDto(
    Guid Id,
    DateTime OccurredAt,
    Guid? ActorUserId,
    string? ActorName,
    string Kind,
    string? FromValue,
    string? ToValue,
    string? Note);

public sealed record KanbanColumnDto(
    Guid StageId,
    string StageName,
    string StageKind,
    string StageColor,
    int SortOrder,
    int Probability,
    IReadOnlyList<DealDto> Deals,
    int TotalCount,
    decimal? TotalValue,        // sum of deal values regardless of currency — UI handles mixed
    IReadOnlyDictionary<string, decimal> TotalValueByCurrency);

public sealed record KanbanDto(
    Guid PipelineId,
    string PipelineName,
    IReadOnlyList<KanbanColumnDto> Columns);
