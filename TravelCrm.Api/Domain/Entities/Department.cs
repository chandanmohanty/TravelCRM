namespace TravelCrm.Api.Domain.Entities;

/// <summary>
/// A business unit within a tenant. Users belong to at most one department.
/// Tenant-scoped: unique (TenantId, Name).
/// </summary>
public sealed class Department : BaseEntity, IAuditableEntity
{
    // BaseEntity provides: Id, TenantId, CreatedAt, UpdatedAt, CreatedBy, UpdatedBy
    public string Name { get; set; } = default!;
    public string? Description { get; set; }

    /// <summary>Optional head-of-department user. SET NULL on user delete.</summary>
    public Guid? ManagerId { get; set; }
}
