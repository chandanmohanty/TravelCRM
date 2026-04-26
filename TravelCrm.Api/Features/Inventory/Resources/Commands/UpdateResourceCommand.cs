using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Resources.Commands;

public sealed record UpdateResourceCommand(
    Guid Id,
    string Name,
    Guid? SupplierId,
    int? DefaultCapacity,
    string? AssetCode,
    string? Metadata
) : IRequest<Result<ResourceDto>>;

public sealed class UpdateResourceValidator : AbstractValidator<UpdateResourceCommand>
{
    public UpdateResourceValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.AssetCode).MaximumLength(100);
        RuleFor(x => x.DefaultCapacity).GreaterThan(0).When(x => x.DefaultCapacity.HasValue);
    }
}

public sealed class UpdateResourceHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<UpdateResourceCommand, Result<ResourceDto>>
{
    public async Task<Result<ResourceDto>> Handle(UpdateResourceCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.resources.manage"))
            return Result.Failure<ResourceDto>("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure<ResourceDto>("Tenant not resolved");

        var entity = await db.Resources
            .Include(r => r.Supplier)
            .FirstOrDefaultAsync(r => r.Id == cmd.Id && r.TenantId == tenantContext.TenantId, ct);
        if (entity is null) return Result.Failure<ResourceDto>("Resource not found");

        if (cmd.SupplierId.HasValue)
        {
            var supplierExists = await db.Suppliers.AnyAsync(
                s => s.Id == cmd.SupplierId.Value && s.TenantId == tenantContext.TenantId, ct);
            if (!supplierExists)
                return Result.Failure<ResourceDto>("Supplier not found");
        }

        entity.Name = cmd.Name;
        entity.SupplierId = cmd.SupplierId;
        entity.Metadata = cmd.Metadata;

        if (entity is PoolResource pool)
        {
            if (cmd.DefaultCapacity.HasValue) pool.DefaultCapacity = cmd.DefaultCapacity.Value;
        }
        else if (entity is AssetResource asset)
        {
            asset.AssetCode = cmd.AssetCode;
        }

        await db.SaveChangesAsync(ct);

        // Reload supplier in case SupplierId changed
        await db.Entry(entity).Reference(r => r.Supplier).LoadAsync(ct);
        return Result.Success(ResourceMapper.ToDto(entity));
    }
}
