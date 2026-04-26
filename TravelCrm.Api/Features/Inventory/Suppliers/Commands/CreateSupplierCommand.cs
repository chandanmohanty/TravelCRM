using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Inventory.Suppliers.Commands;

public sealed record CreateSupplierCommand(
    string Name,
    string SupplierType,
    string? ContactName,
    string? ContactEmail,
    string? ContactPhone,
    string? Address,
    DateOnly? ContractValidFrom,
    DateOnly? ContractValidTo
) : IRequest<Result<SupplierDto>>;

public sealed class CreateSupplierValidator : AbstractValidator<CreateSupplierCommand>
{
    public CreateSupplierValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.SupplierType)
            .Must(s => Enum.TryParse<SupplierType>(s, ignoreCase: true, out _))
            .WithMessage("SupplierType must be Hotel, Transport, Activity, Guide, or Other");
        RuleFor(x => x.ContactName).MaximumLength(200);
        RuleFor(x => x.ContactEmail).MaximumLength(200);
        RuleFor(x => x.ContactPhone).MaximumLength(50);
        RuleFor(x => x.Address).MaximumLength(1000);
    }
}

public sealed class CreateSupplierHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<CreateSupplierCommand, Result<SupplierDto>>
{
    public async Task<Result<SupplierDto>> Handle(CreateSupplierCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("inventory.suppliers.manage"))
            return Result.Failure<SupplierDto>("Forbidden");
        if (!tenantContext.IsResolved)
            return Result.Failure<SupplierDto>("Tenant not resolved");

        var dup = await db.Suppliers.AnyAsync(
            s => s.TenantId == tenantContext.TenantId && s.Name == cmd.Name, ct);
        if (dup) return Result.Failure<SupplierDto>("A supplier with this name already exists");

        var entity = new Supplier
        {
            Id = Guid.NewGuid(),
            TenantId = tenantContext.TenantId!.Value,
            Name = cmd.Name,
            SupplierType = Enum.Parse<SupplierType>(cmd.SupplierType, ignoreCase: true),
            ContactName = cmd.ContactName,
            ContactEmail = cmd.ContactEmail,
            ContactPhone = cmd.ContactPhone,
            Address = cmd.Address,
            ContractValidFrom = cmd.ContractValidFrom,
            ContractValidTo = cmd.ContractValidTo,
            IsActive = true,
        };
        db.Suppliers.Add(entity);
        await db.SaveChangesAsync(ct);
        return Result.Success(SupplierMapper.ToDto(entity));
    }
}
