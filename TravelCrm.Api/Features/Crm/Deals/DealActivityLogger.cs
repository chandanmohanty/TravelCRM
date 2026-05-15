using TravelCrm.Api.Domain.Entities.Crm;
using TravelCrm.Api.Infrastructure.Identity;

namespace TravelCrm.Api.Features.Crm.Deals;

/// <summary>
/// Centralised writer for DealActivity rows. Every handler that mutates a Deal
/// calls one of the static helpers below so the activity feed stays consistent.
/// </summary>
public static class DealActivityLogger
{
    // ICurrentUser has no DisplayName; use Email as the human-readable actor name.
    private static string? ActorName(ICurrentUser user) => user.Email ?? user.UserId.ToString();

    public static DealActivity Created(Guid tenantId, Guid dealId, ICurrentUser user) => new()
    {
        TenantId    = tenantId,
        DealId      = dealId,
        OccurredAt  = DateTime.UtcNow,
        ActorUserId = user.UserId,
        ActorName   = ActorName(user),
        Kind        = DealActivityKind.Created,
    };

    public static DealActivity StageChanged(Guid tenantId, Guid dealId, ICurrentUser user,
        string fromStage, string toStage, string? note = null) => new()
    {
        TenantId    = tenantId,
        DealId      = dealId,
        OccurredAt  = DateTime.UtcNow,
        ActorUserId = user.UserId,
        ActorName   = ActorName(user),
        Kind        = DealActivityKind.StageChanged,
        FromValue   = fromStage,
        ToValue     = toStage,
        Note        = note,
    };

    public static DealActivity OwnerChanged(Guid tenantId, Guid dealId, ICurrentUser user,
        string fromOwner, string toOwner, string? note = null) => new()
    {
        TenantId    = tenantId,
        DealId      = dealId,
        OccurredAt  = DateTime.UtcNow,
        ActorUserId = user.UserId,
        ActorName   = ActorName(user),
        Kind        = DealActivityKind.OwnerChanged,
        FromValue   = fromOwner,
        ToValue     = toOwner,
        Note        = note,
    };

    public static DealActivity ValueChanged(Guid tenantId, Guid dealId, ICurrentUser user,
        string fromValue, string toValue) => new()
    {
        TenantId    = tenantId,
        DealId      = dealId,
        OccurredAt  = DateTime.UtcNow,
        ActorUserId = user.UserId,
        ActorName   = ActorName(user),
        Kind        = DealActivityKind.ValueChanged,
        FromValue   = fromValue,
        ToValue     = toValue,
    };

    public static DealActivity Closed(Guid tenantId, Guid dealId, ICurrentUser user,
        string finalStageName, string? note = null) => new()
    {
        TenantId    = tenantId,
        DealId      = dealId,
        OccurredAt  = DateTime.UtcNow,
        ActorUserId = user.UserId,
        ActorName   = ActorName(user),
        Kind        = DealActivityKind.Closed,
        ToValue     = finalStageName,
        Note        = note,
    };

    public static DealActivity Reopened(Guid tenantId, Guid dealId, ICurrentUser user,
        string newStageName) => new()
    {
        TenantId    = tenantId,
        DealId      = dealId,
        OccurredAt  = DateTime.UtcNow,
        ActorUserId = user.UserId,
        ActorName   = ActorName(user),
        Kind        = DealActivityKind.Reopened,
        ToValue     = newStageName,
    };

    public static DealActivity Note(Guid tenantId, Guid dealId, ICurrentUser user, string note) => new()
    {
        TenantId    = tenantId,
        DealId      = dealId,
        OccurredAt  = DateTime.UtcNow,
        ActorUserId = user.UserId,
        ActorName   = ActorName(user),
        Kind        = DealActivityKind.Note,
        Note        = note,
    };
}
