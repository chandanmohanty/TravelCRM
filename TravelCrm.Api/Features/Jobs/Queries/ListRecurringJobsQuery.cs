using Hangfire;
using Hangfire.Storage;
using MediatR;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Jobs.DTOs;
using TravelCrm.Api.Infrastructure.Identity;

namespace TravelCrm.Api.Features.Jobs.Queries;

public sealed record ListRecurringJobsQuery : IRequest<Result<IReadOnlyList<ScheduledTaskDto>>>;

public sealed class ListRecurringJobsQueryHandler(ICurrentUser currentUser)
    : IRequestHandler<ListRecurringJobsQuery, Result<IReadOnlyList<ScheduledTaskDto>>>
{
    public Task<Result<IReadOnlyList<ScheduledTaskDto>>> Handle(ListRecurringJobsQuery q, CancellationToken ct)
    {
        if (!currentUser.HasPermission("admin.scheduled_tasks.view"))
            return Task.FromResult(Result.Failure<IReadOnlyList<ScheduledTaskDto>>(
                "You don't have permission to view scheduled tasks."));

        using var connection = JobStorage.Current.GetConnection();
        var jobs = connection.GetRecurringJobs();

        var list = jobs.Select(j =>
        {
            // Hangfire doesn't natively expose "last duration" — we derive it from
            // the last job id's state history when present.
            TimeSpan? lastDuration = null;
            if (!string.IsNullOrEmpty(j.LastJobId))
            {
                var stateData = connection.GetJobData(j.LastJobId);
                if (stateData is not null && stateData.CreatedAt != default)
                {
                    var history = connection.GetStateData(j.LastJobId);
                    if (history is not null && history.Data.TryGetValue("PerformanceDuration", out var ms)
                        && long.TryParse(ms, out var msValue))
                    {
                        lastDuration = TimeSpan.FromMilliseconds(msValue);
                    }
                }
            }

            return new ScheduledTaskDto(
                Id:            j.Id,
                Cron:          j.Cron,
                Queue:         j.Queue,
                LastJobId:     j.LastJobId,
                LastJobState:  j.LastJobState,
                LastExecution: j.LastExecution,
                LastDuration:  lastDuration,
                NextExecution: j.NextExecution,
                MethodName:    j.Job?.Method.Name);
        }).OrderBy(d => d.Id).ToList();

        return Task.FromResult(Result.Success<IReadOnlyList<ScheduledTaskDto>>(list));
    }
}
