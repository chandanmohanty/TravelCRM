using TravelCrm.Api.Domain.Entities;

namespace TravelCrm.Api.Features.TaskTypes;

public sealed record TaskTypeDto(Guid Id, string Name, string Color, bool IsActive);

public static class TaskTypeMapper
{
    public static TaskTypeDto ToDto(TaskType t) => new(t.Id, t.Name, t.Color, t.IsActive);
}
