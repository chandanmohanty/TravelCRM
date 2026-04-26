using TravelCrm.Api.Domain.Entities;

namespace TravelCrm.Api.Features.Tasks;

public sealed record TaskDto(
    Guid Id,
    string Title,
    string? Description,
    string Status,
    string Priority,
    Guid? TaskTypeId,
    string? TaskTypeName,
    string? TaskTypeColor,
    Guid? AssignedToUserId,
    string? AssignedToUserName,
    Guid CreatedByUserId,
    string CreatedByUserName,
    Guid? ParentTaskId,
    DateTime? DueDate,
    int? EstimatedMinutes,
    int TotalLoggedMinutes,
    bool IsOverdue,
    bool IsDeleted,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    IReadOnlyList<TaskDto> Children
);

public static class TaskMapper
{
    public static TaskDto ToDto(
        TenantTask task,
        string? assignedToUserName = null,
        string? createdByUserName = null,
        bool includeChildren = false)
    {
        var totalMinutes = task.TimeEntries?.Sum(te => te.Minutes) ?? 0;
        var isOverdue = task.DueDate.HasValue
            && task.DueDate.Value < DateTime.UtcNow
            && task.Status != TenantTaskStatus.Done;

        return new TaskDto(
            task.Id,
            task.Title,
            task.Description,
            task.Status.ToString(),
            task.Priority.ToString(),
            task.TaskTypeId,
            task.TaskType?.Name,
            task.TaskType?.Color,
            task.AssignedToUserId,
            assignedToUserName,
            task.CreatedByUserId,
            createdByUserName ?? task.CreatedBy?.ToString() ?? "",
            task.ParentTaskId,
            task.DueDate,
            task.EstimatedMinutes,
            totalMinutes,
            isOverdue,
            task.IsDeleted,
            task.CreatedAt,
            task.UpdatedAt ?? task.CreatedAt,
            includeChildren && task.Children != null && task.Children.Any()
                ? task.Children.Select(c => ToDto(c, includeChildren: true)).ToList()
                : new List<TaskDto>()
        );
    }
}
