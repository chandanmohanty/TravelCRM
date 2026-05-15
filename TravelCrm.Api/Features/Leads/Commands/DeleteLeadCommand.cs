using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Domain.Entities.Crm;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Leads.Commands;

public sealed record DeleteLeadCommand(Guid Id) : IRequest<Result>;

public sealed class DeleteLeadCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<DeleteLeadCommand, Result>
{
    public async Task<Result> Handle(DeleteLeadCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.leads.manage"))
            return Result.Failure("You don't have permission to manage leads.");
        if (!tenantContext.IsResolved) return Result.Failure("Tenant context not resolved.");

        var row = await db.Leads
            .FirstOrDefaultAsync(l => l.Id == cmd.Id && l.TenantId == tenantContext.TenantId!.Value, ct);
        if (row is null) return Result.Failure("Lead not found.");

        var activeDealCount = await db.Deals.CountAsync(
            d => d.LeadId == row.Id && d.TenantId == row.TenantId
                 && !d.IsDeleted && d.Status == DealStatus.Open, ct);
        if (activeDealCount > 0)
            return Result.Failure($"Lead has {activeDealCount} active deal(s). Detach or close them first.");

        db.Leads.Remove(row);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
