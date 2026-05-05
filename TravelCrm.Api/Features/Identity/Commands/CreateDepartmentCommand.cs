using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Identity.DTOs;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Identity.Commands;

public sealed record CreateDepartmentCommand(string Name, string? Description, Guid? ManagerId)
    : IRequest<Result<DepartmentDto>>;

public sealed class CreateDepartmentCommandValidator : AbstractValidator<CreateDepartmentCommand>
{
    public CreateDepartmentCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(500);
    }
}

public sealed class CreateDepartmentCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser,
    ILogger<CreateDepartmentCommandHandler> logger)
    : IRequestHandler<CreateDepartmentCommand, Result<DepartmentDto>>
{
    public async Task<Result<DepartmentDto>> Handle(CreateDepartmentCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure<DepartmentDto>("Tenant context not resolved.");
        if (!currentUser.HasPermission("admin.departments.create"))
            return Result.Failure<DepartmentDto>("You don't have permission to create departments.");

        if (await db.Departments.AnyAsync(d => d.TenantId == tenantId && d.Name == cmd.Name, ct))
            return Result.Failure<DepartmentDto>($"A department named '{cmd.Name}' already exists.");

        if (cmd.ManagerId is Guid mId &&
            !await db.Users.AnyAsync(u => u.Id == mId && u.TenantId == tenantId && !u.IsDeleted, ct))
            return Result.Failure<DepartmentDto>("Manager must be a user in this tenant.");

        var actorId = currentUser.UserId == Guid.Empty ? (Guid?)null : currentUser.UserId;
        var dept = new Department
        {
            Id          = Guid.NewGuid(),
            TenantId    = tenantId.Value,
            Name        = cmd.Name,
            Description = cmd.Description,
            ManagerId   = cmd.ManagerId,
            CreatedAt   = DateTime.UtcNow,
            CreatedBy   = actorId
        };
        db.Departments.Add(dept);
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Department '{Name}' created in tenant {TenantId}", dept.Name, tenantId);

        var mgrName = cmd.ManagerId is Guid m
            ? await db.Users.Where(u => u.Id == m).Select(u => u.FirstName + " " + u.LastName).FirstOrDefaultAsync(ct)
            : null;

        return Result.Success(new DepartmentDto(
            dept.Id, dept.TenantId, dept.Name, dept.Description,
            dept.ManagerId, mgrName, 0, dept.CreatedAt));
    }
}
