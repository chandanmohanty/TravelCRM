namespace TravelCrm.Api.Features.Platform.DTOs;

// ── Tenant DTOs ───────────────────────────────────────────────────────────────

public sealed record TenantDto(
    Guid   Id,
    string Name,
    string Slug,
    string Plan,
    bool   IsActive,
    int    UserCount,
    DateTime CreatedAt);

public sealed record CreateTenantRequest(
    string Name,
    string Slug,
    string Plan,
    string AdminEmail,
    string AdminFirstName,
    string AdminLastName,
    string AdminPassword);

public sealed record UpdateTenantRequest(
    string Name,
    string Slug,
    string Plan);

// ── Platform Stats DTO ────────────────────────────────────────────────────────

public sealed record PlatformStatsDto(
    int  TotalTenants,
    int  ActiveTenants,
    int  TotalUsers,
    int  ActiveUsers,
    int  PlatformAdmins,
    Dictionary<string, int> UsersByPlan);
