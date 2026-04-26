namespace TravelCrm.Api.Domain.Entities.Inventory;

public sealed class AssetResource : Resource
{
    public AssetResource() { Kind = ResourceKind.Asset; }

    /// <summary>Vehicle registration / employee code / license number — for human reference. Not unique-constrained.</summary>
    public string? AssetCode { get; set; }
}
