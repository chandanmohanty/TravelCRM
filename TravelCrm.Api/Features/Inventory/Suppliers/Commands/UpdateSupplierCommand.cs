using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Suppliers.Commands;

public sealed record UpdateSupplierCommand(
    Guid Id,
    string Name,
    string SupplierType,
    string? ContactName,
    string? ContactEmail,
    string? ContactPhone,
    string? Address,
    DateOnly? ContractValidFrom,
    DateOnly? ContractValidTo,
    bool IsActive
) : IRequest<Result<SupplierDto>>;

public sealed class UpdateSupplierValidator : AbstractValidator<UpdateSupplierCommand>
{
    public UpdateSupplierValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.SupplierType)
            .Must(s => Enum.TryParse<SupplierType>(s, ignoreCase: true, out _))
            .WithMessage("Invalid SupplierType");
        RuleFor(x => x.ContactEmail).MaximumLength(200);
    }
}

public sealed class UpdateSupplierHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<UpdateSupplierCommand, Result<SupplierDto>>
{
    public async Task<Result<SupplierDto>> Handle(UpdateSupplierCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.suppliers.manage"))
            return Result.Failure<SupplierDto>("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure<SupplierDto>("Tenant not resolved");

        var entity = await db.Suppliers.FirstOrDefaultAsync(
            s => s.Id == cmd.Id && s.TenantId == tenantContext.TenantId, ct);
        if (entity is null) return Result.Failure<SupplierDto>("Supplier not found");

        var dup = await db.Suppliers.AnyAsync(
            s => s.TenantId == tenantContext.TenantId && s.Name == cmd.Name && s.Id != cmd.Id, ct);
        if (dup) return Result.Failure<SupplierDto>("A supplier with this name already exists");

        entity.Name = cmd.Name;
        entity.SupplierType = Enum.Parse<SupplierType>(cmd.SupplierType, ignoreCase: true);
        entity.ContactName = cmd.ContactName;
        entity.ContactEmail = cmd.ContactEmail;
        entity.ContactPhone = cmd.ContactPhone;
        entity.Address = cmd.Address;
        entity.ContractValidFrom = cmd.ContractValidFrom;
        entity.ContractValidTo = cmd.ContractValidTo;
        entity.IsActive = cmd.IsActive;

        await db.SaveChangesAsync(ct);
        return Result.Success(SupplierMapper.ToDto(entity));
    }
}
