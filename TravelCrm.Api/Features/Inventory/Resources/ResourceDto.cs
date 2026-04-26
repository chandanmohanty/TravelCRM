using TravelCrm.Api.Domain.Entities.Inventory;

namespace TravelCrm.Api.Features.Inventory.Resources;

public sealed record ResourceDto(
    Guid Id,
    string Kind,        // "Pool" | "Asset"
    string Type,
    string Name,
    Guid? SupplierId,
    string? SupplierName,
    string Status,
    int? DefaultCapacity,
    string? AssetCode,
    string? Metadata,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public static class ResourceMapper
{
    public static ResourceDto ToDto(Resource r) => new(
        r.Id,
        r.Kind.ToString(),
        r.Type,
        r.Name,
        r.SupplierId,
        r.Supplier?.Name,
        r.Status.ToString(),
        (r as PoolResource)?.DefaultCapacity,
        (r as AssetResource)?.AssetCode,
        r.Metadata,
        r.CreatedAt,
        r.UpdatedAt ?? r.CreatedAt
    );
}
