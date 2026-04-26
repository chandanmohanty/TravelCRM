using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.TaskTypes.Commands;

public sealed record CreateTaskTypeCommand(string Name, string Color) : IRequest<Result<TaskTypeDto>>;

public sealed class CreateTaskTypeValidator : AbstractValidator<CreateTaskTypeCommand>
{
    public CreateTaskTypeValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Color).NotEmpty().MaximumLength(7).Matches("^#[0-9A-Fa-f]{6}$")
            .WithMessage("Color must be a hex code like #3B82F6");
    }
}

public sealed class CreateTaskTypeHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<CreateTaskTypeCommand, Result<TaskTypeDto>>
{
    public async Task<Result<TaskTypeDto>> Handle(CreateTaskTypeCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("crm.tasks.admin"))
            return Result.Failure<TaskTypeDto>("Forbidden");

        if (!tenantContext.IsResolved)
            return Result.Failure<TaskTypeDto>("Tenant not resolved");

        var nameClash = await db.TaskTypes.AnyAsync(
            t => t.TenantId == tenantContext.TenantId && t.Name == cmd.Name, ct);
        if (nameClash)
            return Result.Failure<TaskTypeDto>("A task type with this name already exists");

        var entity = new TaskType
        {
            Id = Guid.NewGuid(),
            TenantId = tenantContext.TenantId!.Value,
            Name = cmd.Name,
            Color = cmd.Color,
            IsActive = true,
        };
        db.TaskTypes.Add(entity);
        await db.SaveChangesAsync(ct);
        return Result.Success(TaskTypeMapper.ToDto(entity));
    }
}
