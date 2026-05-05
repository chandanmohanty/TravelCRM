namespace TravelCrm.Api.Domain.Entities;

/// <summary>
/// Join entity linking a role to a permission it grants. Carries an explicit
/// <see cref="TenantId"/> (denormalized from Role) so tenant isolation is
/// bulletproof at the join level — no cross-tenant row can slip through even
/// if a role's tenant id is ever mis-set.
/// </summary>
public sealed class RolePermission : IAuditableEntity
{
    /// <summary>FK → <c>Roles.Id</c>. Cascade delete when the role is removed.</summary>
    public Guid RoleId { get; set; }

    /// <summary>FK → <c>Permissions.Id</c>. Restrict delete — removing a permission that's granted is blocked.</summary>
    public Guid PermissionId { get; set; }

    /// <summary>
    /// Tenant the granting role belongs to. <c>null</c> for global system roles
    /// (e.g. PlatformAdmin). Denormalized from Role for defence-in-depth.
    /// </summary>
    public Guid? TenantId { get; set; }

    public DateTime GrantedAt { get; set; } = DateTime.UtcNow;
    public Guid? GrantedBy { get; set; }
}
