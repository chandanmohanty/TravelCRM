using Microsoft.AspNetCore.Identity;
using TravelCrm.Api.Domain.Entities;

namespace TravelCrm.Api.Infrastructure.Identity;

public sealed class ApplicationUser : IdentityUser<Guid>, IAuditableEntity
{
    /// <summary>Null for platform-level admins; populated for all tenant users.</summary>
    public Guid? TenantId { get; set; }

    /// <summary>True only for the SaaS platform administrator — has no tenant affiliation.</summary>
    public bool IsPlatformAdmin { get; set; }

    public string FirstName { get; set; } = default!;
    public string LastName { get; set; } = default!;
    public string FullName => $"{FirstName} {LastName}";
    public string? AvatarUrl { get; set; }

    /// <summary>
    /// Legacy free-form department string retained for backfill compatibility.
    /// New code should prefer <see cref="DepartmentId"/> and the
    /// <see cref="Domain.Entities.Department"/> lookup.
    /// </summary>
    public string? Department { get; set; }

    /// <summary>FK → <c>Departments.Id</c> (tenant-scoped). SET NULL on department delete.</summary>
    public Guid? DepartmentId { get; set; }

    public string? JobTitle { get; set; }

    /// <summary>
    /// Self-reference to the team-leader user. Enforced by handler invariants
    /// (must be a user in same tenant holding a role with slug <c>team_leader</c>),
    /// not by FK constraint. SET NULL on team-leader delete.
    /// </summary>
    public Guid? TeamLeaderId { get; set; }

    /// <summary>
    /// Per-tenant Employee ID in the form <c>EMP-{YYYY}-{NNNNNN}</c>. Allocated
    /// by <c>EmployeeIdGenerator</c> on user create. Unique per tenant for
    /// non-deleted users.
    /// </summary>
    public string? EmployeeId { get; set; }
    public UserStatus Status { get; set; } = UserStatus.PendingInvitation;
    public bool IsDeleted { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public string PreferredLanguage { get; set; } = "en";
    public string TimeZone { get; set; } = "UTC";
    public string CurrencyCode { get; set; } = "USD";
}

public enum UserStatus
{
    Active = 1,
    Inactive = 2,
    Suspended = 3,
    PendingInvitation = 4
}
