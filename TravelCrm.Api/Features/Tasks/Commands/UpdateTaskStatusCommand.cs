using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Tasks.Commands;

public sealed record UpdateTaskStatusCommand(Guid Id, string Status) : IRequest<Result<TaskDto>>;

public sealed class UpdateTaskStatusValidator : AbstractValidator<UpdateTaskStatusCommand>
{
    public UpdateTaskStatusValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Status)
            .Must(s => Enum.TryParse<TenantTaskStatus>(s, ignoreCase: true, out _))
            .WithMessage("Invalid status");
    }
}

public sealed class UpdateTaskStatusHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<UpdateTaskStatusCommand, Result<TaskDto>>
{
    public async Task<Result<TaskDto>> Handle(UpdateTaskStatusCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.tasks.manage"))
            return Result.Failure<TaskDto>("Forbidden");

        if (!tenantContext.IsResolved)
            return Result.Failure<TaskDto>("Tenant not resolved");

        if (!Enum.TryParse<TenantTaskStatus>(cmd.Status, ignoreCase: true, out var newStatus))
            return Result.Failure<TaskDto>("Invalid status value");

        var task = await db.TenantTasks
            .Include(t => t.TaskType)
            .FirstOrDefaultAsync(t => t.Id == cmd.Id && t.TenantId == tenantContext.TenantId, ct);

        if (task is null || task.IsDeleted)
            return Result.Failure<TaskDto>("Task not found");

        var previousStatus = task.Status;
        if (previousStatus == newStatus)
            return Result.Success(TaskMapper.ToDto(task));

        task.Status = newStatus;
        if (newStatus == TenantTaskStatus.Done) task.IsOverdueSent = false;

        var msg = $"Task '{task.Title}' status changed: {previousStatus} → {newStatus}";
        var recipients = new HashSet<Guid>();
        if (task.CreatedByUserId != currentUser.UserId) recipients.Add(task.CreatedByUserId);
        if (task.AssignedToUserId.HasValue && task.AssignedToUserId.Value != currentUser.UserId)
            recipients.Add(task.AssignedToUserId.Value);

        foreach (var userId in recipients)
        {
            db.Notifications.Add(new Notification
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId!.Value,
                UserId = userId,
                Type = "task_status_changed",
                Title = "Task status changed",
                Message = msg,
                IsRead = false,
                ActionUrl = $"/apps/task/{task.Id}",
            });
        }

        await db.SaveChangesAsync(ct);
        return Result.Success(TaskMapper.ToDto(task));
    }
}
