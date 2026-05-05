using Microsoft.AspNetCore.Identity;
using TravelCrm.Api.Domain.Entities;

namespace TravelCrm.Api.Infrastructure.Identity;

public sealed class ApplicationRole : IdentityRole<Guid>, IAuditableEntity
{
    /// <summary>Null for platform-wide roles (e.g. PlatformAdmin).</summary>
    public Guid? TenantId { get; set; }

    /// <summary>
    /// Machine-safe identifier used by downstream modules to test role capabilities
    /// (e.g. <c>"team_leader"</c>, <c>"super_admin"</c>). Auto-slugified from Name for
    /// custom roles; stable strings for seeded system roles.
    /// </summary>
    public string? Slug { get; set; }

    public bool IsSystemRole { get; set; }
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
