namespace TravelCrm.Api.Domain.Entities.Inventory;

public sealed class Supplier : BaseEntity
{
    public string Name { get; set; } = default!;
    public SupplierType SupplierType { get; set; } = SupplierType.Other;
    public string? ContactName { get; set; }
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public string? Address { get; set; }
    public DateOnly? ContractValidFrom { get; set; }
    public DateOnly? ContractValidTo { get; set; }
    public bool IsActive { get; set; } = true;
}
