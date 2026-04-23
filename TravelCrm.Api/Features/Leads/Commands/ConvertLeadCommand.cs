using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Leads.DTOs;
using TravelCrm.Api.Features.Leads.Queries;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Leads.Commands;

public sealed record ConvertLeadCommand(Guid Id) : IRequest<Result<LeadDto>>;

public sealed class ConvertLeadCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<ConvertLeadCommand, Result<LeadDto>>
{
    public async Task<Result<LeadDto>> Handle(ConvertLeadCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.leads.manage"))
            return Result.Failure<LeadDto>("You don't have permission to manage leads.");
        if (!tenantContext.IsResolved) return Result.Failure<LeadDto>("Tenant context not resolved.");

        var row = await db.Leads
            .FirstOrDefaultAsync(l => l.Id == cmd.Id && l.TenantId == tenantContext.TenantId!.Value, ct);
        if (row is null) return Result.Failure<LeadDto>("Lead not found.");
        if (row.Status == LeadStatus.Converted)
            return Result.Failure<LeadDto>("Lead is already converted.");
        if (row.Status == LeadStatus.Unqualified)
            return Result.Failure<LeadDto>("Unqualified leads cannot be converted.");

        row.Status    = LeadStatus.Converted;
        row.UpdatedAt = DateTime.UtcNow;
        row.UpdatedBy = currentUser.IsAuthenticated ? currentUser.UserId : (Guid?)null;

        await db.SaveChangesAsync(ct);
        return Result.Success(LeadMapper.ToDto(row));
    }
}
