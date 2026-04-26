using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.TaskTypes.Commands;

public sealed record UpdateTaskTypeCommand(Guid Id, string Name, string Color, bool IsActive)
    : IRequest<Result<TaskTypeDto>>;

public sealed class UpdateTaskTypeValidator : AbstractValidator<UpdateTaskTypeCommand>
{
    public UpdateTaskTypeValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Color).NotEmpty().MaximumLength(7).Matches("^#[0-9A-Fa-f]{6}$");
    }
}

public sealed class UpdateTaskTypeHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<UpdateTaskTypeCommand, Result<TaskTypeDto>>
{
    public async Task<Result<TaskTypeDto>> Handle(UpdateTaskTypeCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.tasks.admin"))
            return Result.Failure<TaskTypeDto>("Forbidden");

        if (!tenantContext.IsResolved)
            return Result.Failure<TaskTypeDto>("Tenant not resolved");

        var entity = await db.TaskTypes.FirstOrDefaultAsync(
            t => t.Id == cmd.Id && t.TenantId == tenantContext.TenantId, ct);
        if (entity is null) return Result.Failure<TaskTypeDto>("Task type not found");

        var nameClash = await db.TaskTypes.AnyAsync(
            t => t.TenantId == tenantContext.TenantId && t.Name == cmd.Name && t.Id != cmd.Id, ct);
        if (nameClash) return Result.Failure<TaskTypeDto>("A task type with this name already exists");

        entity.Name = cmd.Name;
        entity.Color = cmd.Color;
        entity.IsActive = cmd.IsActive;
        await db.SaveChangesAsync(ct);
        return Result.Success(TaskTypeMapper.ToDto(entity));
    }
}
