namespace TravelCrm.Api.Features.Jobs.DTOs;

public sealed record ScheduledTaskDto(
    string    Id,
    string    Cron,
    string?   Queue,
    string?   LastJobId,
    string?   LastJobState,
    DateTime? LastExecution,
    TimeSpan? LastDuration,
    DateTime? NextExecution,
    string?   MethodName);
