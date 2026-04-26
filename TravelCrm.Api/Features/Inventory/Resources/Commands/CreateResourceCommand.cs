using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Resources.Commands;

public sealed record CreateResourceCommand(
    string Kind,                // "Pool" | "Asset"
    string Type,                // "Hotel" | "RoomType" | "Vehicle" | ...
    string Name,
    Guid? SupplierId,
    int? DefaultCapacity,       // required for Pool
    string? AssetCode,          // optional for Asset
    string? Metadata
) : IRequest<Result<ResourceDto>>;

public sealed class CreateResourceValidator : AbstractValidator<CreateResourceCommand>
{
    public CreateResourceValidator()
    {
        RuleFor(x => x.Kind)
            .Must(k => Enum.TryParse<ResourceKind>(k, ignoreCase: true, out _))
            .WithMessage("Kind must be Pool or Asset");
        RuleFor(x => x.Type).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.AssetCode).MaximumLength(100);
        RuleFor(x => x.DefaultCapacity)
            .NotNull().GreaterThan(0)
            .When(x => string.Equals(x.Kind, "Pool", StringComparison.OrdinalIgnoreCase))
            .WithMessage("DefaultCapacity is required and must be > 0 for Pool resources");
    }
}

public sealed class CreateResourceHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<CreateResourceCommand, Result<ResourceDto>>
{
    public async Task<Result<ResourceDto>> Handle(CreateResourceCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.resources.manage"))
            return Result.Failure<ResourceDto>("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure<ResourceDto>("Tenant not resolved");

        var kind = Enum.Parse<ResourceKind>(cmd.Kind, ignoreCase: true);

        if (kind == ResourceKind.Pool && (cmd.DefaultCapacity is null or <= 0))
            return Result.Failure<ResourceDto>("DefaultCapacity is required for Pool resources");

        if (cmd.SupplierId.HasValue)
        {
            var supplierExists = await db.Suppliers.AnyAsync(
                s => s.Id == cmd.SupplierId.Value && s.TenantId == tenantContext.TenantId, ct);
            if (!supplierExists)
                return Result.Failure<ResourceDto>("Supplier not found");
        }

        Resource entity = kind == ResourceKind.Pool
            ? new PoolResource
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId!.Value,
                Type = cmd.Type,
                Name = cmd.Name,
                SupplierId = cmd.SupplierId,
                Status = ResourceStatus.Active,
                Metadata = cmd.Metadata,
                DefaultCapacity = cmd.DefaultCapacity!.Value,
            }
            : new AssetResource
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId!.Value,
                Type = cmd.Type,
                Name = cmd.Name,
                SupplierId = cmd.SupplierId,
                Status = ResourceStatus.Active,
                Metadata = cmd.Metadata,
                AssetCode = cmd.AssetCode,
            };

        db.Resources.Add(entity);
        await db.SaveChangesAsync(ct);

        var fresh = await db.Resources
            .AsNoTracking()
            .Include(r => r.Supplier)
            .FirstAsync(r => r.Id == entity.Id, ct);
        return Result.Success(ResourceMapper.ToDto(fresh));
    }
}
