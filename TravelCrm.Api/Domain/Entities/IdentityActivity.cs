namespace TravelCrm.Api.Domain.Entities;

/// <summary>
/// User-facing activity feed for the Identity module — distinct from
/// <see cref="AuditLog"/> (which is the raw, field-level diff used for
/// compliance / forensics). This table powers the "Activity" tab on the
/// user detail page and feeds notification timelines.
///
/// Writes are done explicitly in handlers (rule 8) — there's no interceptor
/// to avoid capturing incidental writes that aren't user-meaningful events.
/// </summary>
public sealed class IdentityActivity
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Tenant this activity belongs to. Null only for platform-admin operations.</summary>
    public Guid? TenantId { get; set; }

    /// <summary>Primary subject of the activity (usually the user being acted upon).</summary>
    public Guid SubjectUserId { get; set; }

    /// <summary>Who performed the action. Null for system-driven activities.</summary>
    public Guid? ActorUserId { get; set; }

    /// <summary>Short snapshot of the actor's name at the time, so the feed is readable even after the actor is renamed.</summary>
    public string? ActorName { get; set; }

    /// <summary>Machine key: <c>user.created</c>, <c>user.role_changed</c>, <c>user.password_reset_sent</c>, etc.</summary>
    public string ActivityType { get; set; } = default!;

    /// <summary>Human-readable summary ("Alice was invited by Admin").</summary>
    public string Description { get; set; } = default!;

    /// <summary>Free-form JSON metadata specific to the activity type.</summary>
    public string? Metadata { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
