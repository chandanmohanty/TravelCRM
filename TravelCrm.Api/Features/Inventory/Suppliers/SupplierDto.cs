using TravelCrm.Api.Domain.Entities.Inventory;

namespace TravelCrm.Api.Features.Inventory.Suppliers;

public sealed record SupplierDto(
    Guid Id,
    string Name,
    string SupplierType,
    string? ContactName,
    string? ContactEmail,
    string? ContactPhone,
    string? Address,
    DateOnly? ContractValidFrom,
    DateOnly? ContractValidTo,
    bool IsActive,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public static class SupplierMapper
{
    public static SupplierDto ToDto(Supplier s) => new(
        s.Id, s.Name, s.SupplierType.ToString(),
        s.ContactName, s.ContactEmail, s.ContactPhone, s.Address,
        s.ContractValidFrom, s.ContractValidTo, s.IsActive,
        s.CreatedAt, s.UpdatedAt ?? s.CreatedAt
    );
}
