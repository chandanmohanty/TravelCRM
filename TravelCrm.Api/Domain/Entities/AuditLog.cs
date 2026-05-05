namespace TravelCrm.Api.Domain.Entities;

public sealed class AuditLog
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid TenantId { get; init; }
    public Guid? ActorId { get; init; }
    public string ActorEmail { get; init; } = default!;
    public string Action { get; init; } = default!;
    public string EntityType { get; init; } = default!;
    public Guid EntityId { get; init; }
    public string? EntityLabel { get; init; }
    public string[] ChangedFields { get; init; } = [];
    public string? OldValues { get; init; }
    public string? NewValues { get; init; }
    public string? IpAddress { get; init; }
    public DateTime OccurredAt { get; init; } = DateTime.UtcNow;
}
