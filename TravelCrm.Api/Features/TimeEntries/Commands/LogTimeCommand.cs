using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.TimeEntries.Commands;

public sealed record LogTimeCommand(Guid TaskId, int Minutes, string? Notes)
    : IRequest<Result<TimeEntryDto>>;

public sealed class LogTimeValidator : AbstractValidator<LogTimeCommand>
{
    public LogTimeValidator()
    {
        RuleFor(x => x.TaskId).NotEmpty();
        RuleFor(x => x.Minutes).GreaterThan(0).LessThanOrEqualTo(24 * 60);
        RuleFor(x => x.Notes).MaximumLength(500);
    }
}

public sealed class LogTimeHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<LogTimeCommand, Result<TimeEntryDto>>
{
    public async Task<Result<TimeEntryDto>> Handle(LogTimeCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.tasks.manage"))
            return Result.Failure<TimeEntryDto>("Forbidden");

        if (!tenantContext.IsResolved)
            return Result.Failure<TimeEntryDto>("Tenant not resolved");

        var taskExists = await db.TenantTasks.AnyAsync(
            t => t.Id == cmd.TaskId
              && t.TenantId == tenantContext.TenantId
              && !t.IsDeleted, ct);
        if (!taskExists) return Result.Failure<TimeEntryDto>("Task not found");

        var entry = new TimeEntry
        {
            Id = Guid.NewGuid(),
            TenantId = tenantContext.TenantId!.Value,
            TaskId = cmd.TaskId,
            UserId = currentUser.UserId,
            Minutes = cmd.Minutes,
            Notes = cmd.Notes,
            LoggedAt = DateTime.UtcNow,
        };
        db.TimeEntries.Add(entry);
        await db.SaveChangesAsync(ct);
        return Result.Success(TimeEntryMapper.ToDto(entry));
    }
}
