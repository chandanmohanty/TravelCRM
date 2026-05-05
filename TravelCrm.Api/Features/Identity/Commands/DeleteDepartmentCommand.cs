using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Identity.Commands;

public sealed record DeleteDepartmentCommand(Guid Id) : IRequest<Result>;

public sealed class DeleteDepartmentCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser,
    ILogger<DeleteDepartmentCommandHandler> logger)
    : IRequestHandler<DeleteDepartmentCommand, Result>
{
    public async Task<Result> Handle(DeleteDepartmentCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure("Tenant context not resolved.");
        if (!currentUser.HasPermission("admin.departments.delete"))
            return Result.Failure("You don't have permission to delete departments.");

        var dept = await db.Departments.FirstOrDefaultAsync(d =>
            d.Id == cmd.Id && d.TenantId == tenantId, ct);
        if (dept is null) return Result.Failure("Department not found.");

        // Null out the department pointer on users first (SET NULL behaviour)
        var users = await db.Users
            .Where(u => u.DepartmentId == dept.Id && u.TenantId == tenantId)
            .ToListAsync(ct);
        foreach (var u in users) u.DepartmentId = null;

        db.Departments.Remove(dept);
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Department {DeptId} deleted from tenant {TenantId}", dept.Id, tenantId);
        return Result.Success();
    }
}
