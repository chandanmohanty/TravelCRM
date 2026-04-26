using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Tasks.Commands;

public sealed record UpdateTaskCommand(
    Guid Id,
    string Title,
    string? Description,
    string Status,
    string Priority,
    Guid? TaskTypeId,
    Guid? AssignedToUserId,
    Guid? ParentTaskId,
    DateTime? DueDate,
    int? EstimatedMinutes
) : IRequest<Result<TaskDto>>;

public sealed class UpdateTaskValidator : AbstractValidator<UpdateTaskCommand>
{
    public UpdateTaskValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(4000);
        RuleFor(x => x.Status)
            .Must(s => Enum.TryParse<TenantTaskStatus>(s, ignoreCase: true, out _))
            .WithMessage("Status must be ToDo, InProgress, or Done");
        RuleFor(x => x.Priority)
            .Must(p => Enum.TryParse<TenantTaskPriority>(p, ignoreCase: true, out _))
            .WithMessage("Priority must be Low, Medium, High, or Urgent");
        RuleFor(x => x.EstimatedMinutes)
            .GreaterThan(0).When(x => x.EstimatedMinutes.HasValue);
    }
}

public sealed class UpdateTaskHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<UpdateTaskCommand, Result<TaskDto>>
{
    public async Task<Result<TaskDto>> Handle(UpdateTaskCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.tasks.manage"))
            return Result.Failure<TaskDto>("Forbidden");

        if (!tenantContext.IsResolved)
            return Result.Failure<TaskDto>("Tenant not resolved");

        var task = await db.TenantTasks
            .Include(t => t.TaskType)
            .FirstOrDefaultAsync(t => t.Id == cmd.Id && t.TenantId == tenantContext.TenantId, ct);

        if (task is null || task.IsDeleted)
            return Result.Failure<TaskDto>("Task not found");

        if (cmd.ParentTaskId.HasValue && cmd.ParentTaskId.Value == cmd.Id)
            return Result.Failure<TaskDto>("Task cannot be its own parent");

        var previousAssignee = task.AssignedToUserId;
        var previousStatus = task.Status;

        task.Title = cmd.Title;
        task.Description = cmd.Description;
        task.Status = Enum.Parse<TenantTaskStatus>(cmd.Status, ignoreCase: true);
        task.Priority = Enum.Parse<TenantTaskPriority>(cmd.Priority, ignoreCase: true);
        task.TaskTypeId = cmd.TaskTypeId;
        task.AssignedToUserId = cmd.AssignedToUserId;
        task.ParentTaskId = cmd.ParentTaskId;
        task.DueDate = cmd.DueDate;
        task.EstimatedMinutes = cmd.EstimatedMinutes;

        // Reset overdue flag if due date moved into future or status flipped to Done
        if (task.IsOverdueSent
            && (task.Status == TenantTaskStatus.Done
                || !task.DueDate.HasValue
                || task.DueDate.Value >= DateTime.UtcNow))
        {
            task.IsOverdueSent = false;
        }

        // Notify new assignee on assignment change
        if (cmd.AssignedToUserId.HasValue
            && cmd.AssignedToUserId != previousAssignee
            && cmd.AssignedToUserId.Value != currentUser.UserId)
        {
            db.Notifications.Add(new Notification
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId!.Value,
                UserId = cmd.AssignedToUserId.Value,
                Type = "task_assigned",
                Title = "Task assigned to you",
                Message = $"You've been assigned: {task.Title}",
                IsRead = false,
                ActionUrl = $"/apps/task/{task.Id}",
            });
        }

        // Notify on status change (creator + assignee)
        if (task.Status != previousStatus)
        {
            EmitStatusChangedNotifications(task, previousStatus, currentUser.UserId, tenantContext.TenantId!.Value);
        }

        await db.SaveChangesAsync(ct);
        return Result.Success(TaskMapper.ToDto(task));
    }

    private void EmitStatusChangedNotifications(TenantTask task, TenantTaskStatus previousStatus, Guid actorId, Guid tenantId)
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
