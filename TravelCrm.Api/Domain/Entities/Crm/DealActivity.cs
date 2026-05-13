namespace TravelCrm.Api.Domain.Entities.Crm;

public enum DealActivityKind
{
    Created       = 0,
    StageChanged  = 1,
    OwnerChanged  = 2,
    ValueChanged  = 3,
    Closed        = 4,
    Reopened      = 5,
    Note          = 6,
}

/// <summary>
/// Append-only per-deal activity feed. NOT marked IAuditableEntity —
/// this IS the user-visible audit feed; the platform AuditSaveChangesInterceptor
/// still captures Deal row changes for the admin audit log.
/// </summary>
public sealed class DealActivity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid DealId { get; set; }
    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
    public Guid? ActorUserId { get; set; }
    public string? ActorName { get; set; }
    public DealActivityKind Kind { get; set; }
    public string? FromValue { get; set; }
    public string? ToValue { get; set; }
    public string? Note { get; set; }
}
