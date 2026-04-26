using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Infrastructure.Jobs;

public sealed class OverdueTasksJob(
    ApplicationDbContext db,
    ILogger<OverdueTasksJob> logger)
{
    public async Task ExecuteAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;

        var overdueTasks = await db.TenantTasks
            .Where(t => !t.IsDeleted
                     && t.Status != TenantTaskStatus.Done
                     && t.DueDate.HasValue
                     && t.DueDate < now
                     && !t.IsOverdueSent)
            .ToListAsync(ct);

        if (overdueTasks.Count == 0)
        {
            logger.LogInformation("OverdueTasksJob: no overdue tasks needing notification");
            return;
        }

        logger.LogInformation("OverdueTasksJob: notifying {Count} overdue tasks", overdueTasks.Count);

        foreach (var task in overdueTasks)
        {
            var msg = $"Task overdue: '{task.Title}' was due {task.DueDate:yyyy-MM-dd}";
            var recipients = new HashSet<Guid> { task.CreatedByUserId };
            if (task.AssignedToUserId.HasValue)
                recipients.Add(task.AssignedToUserId.Value);

            foreach (var userId in recipients)
            {
                db.Notifications.Add(new Notification
                {
                    Id = Guid.NewGuid(),
                    TenantId = task.TenantId,
                    UserId = userId,
                    Type = "task_overdue",
                    Title = "Task overdue",
                    Message = msg,
                    IsRead = false,
                    ActionUrl = $"/apps/task/{task.Id}",
                });
            }

            task.IsOverdueSent = true;
        }

        await db.SaveChangesAsync(ct);
    }
}
