using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Crm.LeadImport.Commands;

public sealed record DeleteLeadImportSourceCommand(Guid Id) : IRequest<Result>;

public sealed class DeleteLeadImportSourceCommandHandler(
    ApplicationDbContext db, ITenantContext tenant, ICurrentUser user)
    : IRequestHandler<DeleteLeadImportSourceCommand, Result>
{
    public async Task<Result> Handle(DeleteLeadImportSourceCommand cmd, CancellationToken ct)
    {
        if (!user.HasPermission("crm.leads.manage"))
            return Result.Failure("You don't have permission to manage lead sources.");
        if (!tenant.IsResolved) return Result.Failure("Tenant context not resolved.");

        var src = await db.LeadImportSources
            .FirstOrDefaultAsync(s => s.Id == cmd.Id && s.TenantId == tenant.TenantId!.Value, ct);
        if (src is null) return Result.Failure("Source not found.");

        db.LeadImportSources.Remove(src); // cascade deletes LeadImportRowState rows
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
