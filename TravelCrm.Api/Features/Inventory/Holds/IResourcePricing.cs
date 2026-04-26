using TravelCrm.Api.Domain.Entities.Inventory;

namespace TravelCrm.Api.Features.Inventory.Holds;

/// <summary>
/// Pricing strategy contract. Each future resource module (Hotel, Vehicle, Driver, ...)
/// implements this with its own typed rate logic and registers it in DI. The hold flow
/// resolves IEnumerable&lt;IResourcePricing&gt; and picks the strategy where
/// <see cref="ResourceType"/> matches the resource's <c>Type</c> field, falling back to
/// <see cref="NullResourcePricing"/> if no specific strategy is registered.
/// </summary>
public interface IResourcePricing
{
    /// <summary>Resource type slug this strategy handles ("Hotel", "Vehicle", ...). "*" is a wildcard fallback.</summary>
    string ResourceType { get; }

    /// <summary>Compute total cost for a hold over a date range. Foundation never invokes this; the future Booking module will.</summary>
    Task<decimal> CalculatePriceAsync(
        Guid resourceId,
        DateOnly start,
        DateOnly end,
        ResourceCalendarSlot? slot,
        int quantity,
        CancellationToken ct);
}
