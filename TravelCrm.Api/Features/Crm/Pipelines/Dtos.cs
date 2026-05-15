namespace TravelCrm.Api.Features.Crm.Pipelines;

public sealed record PipelineDto(
    Guid Id,
    string Name,
    string? Description,
    bool IsDefault,
    bool IsActive,
    int SortOrder,
    int DealCount,
    IReadOnlyList<PipelineStageDto> Stages);

public sealed record PipelineStageDto(
    Guid Id,
    Guid PipelineId,
    string Name,
    int SortOrder,
    int DefaultProbability,
    string Kind,        // "Open" | "Won" | "Lost"
    string ColorHex,
    bool IsActive,
    int DealCount);
