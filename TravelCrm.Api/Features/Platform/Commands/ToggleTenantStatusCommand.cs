using MediatR;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Platform.Commands;

public sealed record ToggleTenantStatusCommand(Guid Id) : IRequest<Result<bool>>;

public sealed class ToggleTenantStatusCommandHandler(
    ApplicationDbContext db,
    ILogger<ToggleTenantStatusCommandHandler> logger)
    : IRequestHandler<ToggleTenantStatusCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(ToggleTenantStatusCommand cmd, CancellationToken ct)
    {
        var tenant = await db.Tenants.FindAsync([cmd.Id], ct);
        if (tenant is null)
            return Result.Failure<bool>("Tenant not found.");

        tenant.IsActive = !tenant.IsActive;
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Tenant {TenantId} status toggled to {IsActive}", tenant.Id, tenant.IsActive);
        return Result.Success(tenant.IsActive);
    }
}
