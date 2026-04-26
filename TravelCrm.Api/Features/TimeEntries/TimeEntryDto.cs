using TravelCrm.Api.Domain.Entities;

namespace TravelCrm.Api.Features.TimeEntries;

public sealed record TimeEntryDto(
    Guid Id,
    Guid TaskId,
    Guid UserId,
    string UserName,
    int Minutes,
    string? Notes,
    DateTime LoggedAt
);

public static class TimeEntryMapper
{
    public static TimeEntryDto ToDto(TimeEntry te, string? userName = null) =>
        new(te.Id, te.TaskId, te.UserId, userName ?? te.CreatedBy?.ToString() ?? "", te.Minutes, te.Notes, te.LoggedAt);
}
