namespace TravelCrm.Api.Domain.Entities;

/// <summary>
/// One-time, short-lived token for password recovery. Only the SHA-256 hash
/// is persisted; the raw value lives briefly in an email link.
/// </summary>
public sealed class PasswordResetToken
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>FK → Users(Id). CASCADE delete.</summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// Denormalized tenant id of the owning user. <c>null</c> for platform
    /// admins. Lets the middleware stack keep tenant filters consistent.
    /// </summary>
    public Guid? TenantId { get; set; }

    /// <summary>SHA-256 hex of the raw token. Unique.</summary>
    public string TokenHash { get; set; } = default!;

    /// <summary>When the token stops being usable. Default CreatedAt + 60 min.</summary>
    public DateTime ExpiresAt { get; set; }

    /// <summary>Set on successful consumption — prevents reuse.</summary>
    public DateTime? ConsumedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Best-effort audit: requester IP.</summary>
    public string? IpAddress { get; set; }
}
