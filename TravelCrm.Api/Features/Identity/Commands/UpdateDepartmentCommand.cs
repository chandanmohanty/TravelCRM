using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Identity.DTOs;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Identity.Commands;

public sealed record UpdateDepartmentCommand(
    Guid Id, string Name, string? Description, Guid? ManagerId) : IRequest<Result<DepartmentDto>>;

public sealed class UpdateDepartmentCommandValidator : AbstractValidator<UpdateDepartmentCommand>
{
    public UpdateDepartmentCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(500);
    }
}

public sealed class UpdateDepartmentCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser,
    ILogger<UpdateDepartmentCommandHandler> logger)
    : IRequestHandler<UpdateDepartmentCommand, Result<DepartmentDto>>
{
    public async Task<Result<DepartmentDto>> Handle(UpdateDepartmentCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure<DepartmentDto>("Tenant context not resolved.");
        if (!currentUser.HasPermission("admin.departments.update"))
            return Result.Failure<DepartmentDto>("You don't have permission to update departments.");

        var dept = await db.Departments.FirstOrDefaultAsync(d =>
            d.Id == cmd.Id && d.TenantId == tenantId, ct);
        if (dept is null) return Result.Failure<DepartmentDto>("Department not found.");

        if (await db.Departments.AnyAsync(d =>
            d.TenantId == tenantId && d.Name == cmd.Name && d.Id != cmd.Id, ct))
            return Result.Failure<DepartmentDto>($"A department named '{cmd.Name}' already exists.");

        if (cmd.ManagerId is Guid mId &&
            !await db.Users.AnyAsync(u => u.Id == mId && u.TenantId == tenantId && !u.IsDeleted, ct))
            return Result.Failure<DepartmentDto>("Manager must be a user in this tenant.");

        dept.Name        = cmd.Name;
        dept.Description = cmd.Description;
        dept.ManagerId   = cmd.ManagerId;
        dept.UpdatedAt   = DateTime.UtcNow;
        dept.UpdatedBy   = currentUser.UserId == Guid.Empty ? null : currentUser.UserId;
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Department {DeptId} updated", dept.Id);

        var mgrName = cmd.ManagerId is Guid m
            ? await db.Users.Where(u => u.Id == m).Select(u => u.FirstName + " " + u.LastName).FirstOrDefaultAsync(ct)
            : null;

        var userCount = await db.Users
            .CountAsync(u => u.DepartmentId == dept.Id && !u.IsDeleted, ct);

        return Result.Success(new DepartmentDto(
            dept.Id, dept.TenantId, dept.Name, dept.Description,
            dept.ManagerId, mgrName, userCount, dept.CreatedAt));
    }
}
