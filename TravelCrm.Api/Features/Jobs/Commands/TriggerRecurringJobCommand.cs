using Hangfire;
using MediatR;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;

namespace TravelCrm.Api.Features.Jobs.Commands;

/// <summary>
/// Fires a recurring job immediately. Uses <see cref="RecurringJobManager.Trigger"/>
/// which enqueues the job for the next available worker.
/// </summary>
public sealed record TriggerRecurringJobCommand(string JobId) : IRequest<Result>;

public sealed class TriggerRecurringJobCommandHandler(
    IRecurringJobManager jobManager,
    ICurrentUser currentUser,
    ILogger<TriggerRecurringJobCommandHandler> logger)
    : IRequestHandler<TriggerRecurringJobCommand, Result>
{
    public Task<Result> Handle(TriggerRecurringJobCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("admin.scheduled_tasks.run"))
            return Task.FromResult(Result.Failure("You don't have permission to run scheduled tasks."));
        if (string.IsNullOrWhiteSpace(cmd.JobId))
            return Task.FromResult(Result.Failure("Job id is required."));

        try
        {
            jobManager.Trigger(cmd.JobId);
            logger.LogInformation("Recurring job {JobId} triggered manually by {ActorId}",
                cmd.JobId, currentUser.UserId);
            return Task.FromResult(Result.Success());
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to trigger recurring job {JobId}", cmd.JobId);
            return Task.FromResult(Result.Failure($"Failed to trigger job: {ex.Message}"));
        }
    }
}
