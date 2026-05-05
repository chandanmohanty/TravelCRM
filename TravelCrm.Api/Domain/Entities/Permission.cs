namespace TravelCrm.Api.Domain.Entities;

/// <summary>
/// A fine-grained authorization capability (e.g. "admin.users.create").
/// The catalog is seeded globally (<see cref="TenantId"/> = null). Tenants may
/// later add custom permissions with a non-null <see cref="TenantId"/>.
/// </summary>
public sealed class Permission
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Null = global/system permission (shared by all tenants). Non-null = tenant-custom.</summary>
    public Guid? TenantId { get; set; }

    /// <summary>Machine key, e.g. <c>"admin.users.create"</c>. Unique.</summary>
    public string Slug { get; set; } = default!;

    /// <summary>Display label shown in the permission matrix UI.</summary>
    public string Name { get; set; } = default!;

    /// <summary>Top-level grouping, e.g. <c>admin</c>, <c>leads</c>.</summary>
    public string Module { get; set; } = default!;

    /// <summary>Sub-grouping within module, e.g. <c>users</c>, <c>roles</c>.</summary>
    public string Submodule { get; set; } = default!;

    /// <summary>Action verb, e.g. <c>view</c>, <c>create</c>, <c>update</c>, <c>delete</c>.</summary>
    public string Action { get; set; } = default!;

    public string? Description { get; set; }

    /// <summary>Lower values sort first within their (module, submodule) grouping.</summary>
    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
