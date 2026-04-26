using TravelCrm.Api.Domain.Entities.Inventory;

namespace TravelCrm.Api.Features.Inventory.Holds;

/// <summary>Default fallback. Returns 0 for every resource type until a real implementation is registered.</summary>
public sealed class NullResourcePricing : IResourcePricing
{
    public string ResourceType => "*";

    public Task<decimal> CalculatePriceAsync(
        Guid resourceId, DateOnly start, DateOnly end,
        ResourceCalendarSlot? slot, int quantity, CancellationToken ct)
        => Task.FromResult(0m);
}
