using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Tasks.Commands;

public sealed record CreateTaskCommand(
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

public sealed class CreateTaskValidator : AbstractValidator<CreateTaskCommand>
{
    public CreateTaskValidator()
    {
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

public sealed class CreateTaskHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<CreateTaskCommand, Result<TaskDto>>
{
    public async Task<Result<TaskDto>> Handle(CreateTaskCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.tasks.manage"))
            return Result.Failure<TaskDto>("Forbidden");

        if (!tenantContext.IsResolved)
            return Result.Failure<TaskDto>("Tenant not resolved");

        // Verify parent (if any) belongs to same tenant and isn't deleted
        if (cmd.ParentTaskId.HasValue)
        {
            var parentExists = await db.TenantTasks.AnyAsync(
                t => t.Id == cmd.ParentTaskId.Value
                  && t.TenantId == tenantContext.TenantId
                  && !t.IsDeleted, ct);
            if (!parentExists)
                return Result.Failure<TaskDto>("Parent task not found");
        }

        var task = new TenantTask
        {
            Id = Guid.NewGuid(),
            TenantId = tenantContext.TenantId!.Value,
            Title = cmd.Title,
            Description = cmd.Description,
            Status = Enum.Parse<TenantTaskStatus>(cmd.Status, ignoreCase: true),
            Priority = Enum.Parse<TenantTaskPriority>(cmd.Priority, ignoreCase: true),
            TaskTypeId = cmd.TaskTypeId,
            AssignedToUserId = cmd.AssignedToUserId,
            CreatedByUserId = currentUser.UserId,
            ParentTaskId = cmd.ParentTaskId,
            DueDate = cmd.DueDate,
            EstimatedMinutes = cmd.EstimatedMinutes,
            IsDeleted = false,
            IsOverdueSent = false,
        };

        db.TenantTasks.Add(task);

        // Notify assignee if it's not the creator
        if (cmd.AssignedToUserId.HasValue && cmd.AssignedToUserId.Value != currentUser.UserId)
        {
            db.Notifications.Add(new Notification
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId!.Value,
                UserId = cmd.AssignedToUserId.Value,
                Type = "task_assigned",
                Title = "Task assigned to you",
                Message = $"You've been assigned: {cmd.Title}",
                IsRead = false,
                ActionUrl = $"/apps/task/{task.Id}",
            });
        }

        await db.SaveChangesAsync(ct);

        var created = await db.TenantTasks
            .AsNoTracking()
            .Include(t => t.TaskType)
            .FirstAsync(t => t.Id == task.Id, ct);

        return Result.Success(TaskMapper.ToDto(created));
    }
}
