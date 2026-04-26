using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Tasks.Commands;

/// <summary>
/// Shared notification helpers for task command handlers. Adds Notification rows to
/// the change tracker; callers are responsible for SaveChanges.
/// </summary>
internal static class TaskNotifications
{
    public static void EmitAssignedNotification(
        ApplicationDbContext db,
        TenantTask task,
        Guid actorId,
        Guid tenantId)
    {
        if (!task.AssignedToUserId.HasValue || task.AssignedToUserId.Value == actorId)
            return;

        db.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            UserId = task.AssignedToUserId.Value,
            Type = "task_assigned",
            Title = "Task assigned to you",
            Message = $"You've been assigned: {task.Title}",
            IsRead = false,
            ActionUrl = $"/apps/task/{task.Id}",
        });
    }

    public static void EmitStatusChangedNotifications(
        ApplicationDbContext db,
        TenantTask task,
        TenantTaskStatus previousStatus,
        Guid actorId,
        Guid tenantId)
    {
        var msg = $"Task '{task.Title}' status changed: {previousStatus} → {task.Status}";
        var recipients = new HashSet<Guid>();
        if (task.CreatedByUserId != actorId) recipients.Add(task.CreatedByUserId);
        if (task.AssignedToUserId.HasValue && task.AssignedToUserId.Value != actorId)
            recipients.Add(task.AssignedToUserId.Value);

        foreach (var userId in recipients)
        {
            db.Notifications.Add(new Notification
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                UserId = userId,
                Type = "task_status_changed",
                Title = "Task status changed",
                Message = msg,
                IsRead = false,
                ActionUrl = $"/apps/task/{task.Id}",
            });
        }
    }
}
