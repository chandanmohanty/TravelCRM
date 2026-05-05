namespace TravelCrm.Api.Features.Identity.DTOs;

// ── User ─────────────────────────────────────────────────────────────────────

public sealed record UserDto(
    Guid     Id,
    Guid?    TenantId,
    string?  EmployeeId,
    string   Email,
    string   FirstName,
    string   LastName,
    string   FullName,
    string?  Phone,
    string?  AvatarUrl,
    string?  JobTitle,
    Guid?    DepartmentId,
    string?  DepartmentName,
    Guid?    TeamLeaderId,
    string?  TeamLeaderName,
    string   Status,
    bool     IsPlatformAdmin,
    IReadOnlyList<UserRoleRef> Roles,
    string   PreferredLanguage,
    string   TimeZone,
    string   CurrencyCode,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    DateTime? LastLoginAt);

public sealed record UserRoleRef(Guid Id, string Name, string? Slug);

public sealed record CreateUserRequest(
    string  Email,
    string  FirstName,
    string  LastName,
    string? Phone,
    string? JobTitle,
    Guid?   DepartmentId,
    Guid    RoleId,
    Guid?   TeamLeaderId,
    string? Password,
    bool    SendInvite);

public sealed record UpdateUserRequest(
    string  FirstName,
    string  LastName,
    string? Phone,
    string? JobTitle,
    Guid?   DepartmentId,
    Guid    RoleId,
    Guid?   TeamLeaderId,
    string? PreferredLanguage,
    string? TimeZone,
    string? CurrencyCode);

public sealed record SetUserPasswordRequest(string NewPassword);

public sealed record ToggleUserStatusRequest(bool Activate);

// ── Role ─────────────────────────────────────────────────────────────────────

public sealed record RoleDto(
    Guid    Id,
    Guid?   TenantId,
    string  Name,
    string? Slug,
    string? Description,
    bool    IsSystemRole,
    int     PermissionCount,
    int     UserCount,
    DateTime CreatedAt);

public sealed record RoleWithPermissionsDto(
    Guid    Id,
    Guid?   TenantId,
    string  Name,
    string? Slug,
    string? Description,
    bool    IsSystemRole,
    IReadOnlyList<Guid> PermissionIds);

public sealed record CreateRoleRequest(string Name, string? Description);
public sealed record UpdateRoleRequest(string Name, string? Description);
public sealed record AssignPermissionsRequest(IReadOnlyList<Guid> PermissionIds);

// ── Permission ───────────────────────────────────────────────────────────────

public sealed record PermissionDto(
    Guid    Id,
    string  Slug,
    string  Name,
    string  Module,
    string  Submodule,
    string  Action,
    string? Description,
    int     SortOrder);

// ── Department ───────────────────────────────────────────────────────────────

public sealed record DepartmentDto(
    Guid    Id,
    Guid    TenantId,
    string  Name,
    string? Description,
    Guid?   ManagerId,
    string? ManagerName,
    int     UserCount,
    DateTime CreatedAt);

public sealed record CreateDepartmentRequest(string Name, string? Description, Guid? ManagerId);
public sealed record UpdateDepartmentRequest(string Name, string? Description, Guid? ManagerId);

// ── Profile (self-service) ───────────────────────────────────────────────────

public sealed record MyProfileDto(
    Guid    Id,
    string  Email,
    string  FirstName,
    string  LastName,
    string  FullName,
    string? Phone,
    string? AvatarUrl,
    string? JobTitle,
    Guid?   DepartmentId,
    string  PreferredLanguage,
    string  TimeZone,
    string  CurrencyCode,
    IReadOnlyList<string> Roles,
    IReadOnlyList<string> Permissions);

public sealed record UpdateMyProfileRequest(
    string  FirstName,
    string  LastName,
    string? Phone,
    string? JobTitle,
    string? PreferredLanguage,
    string? TimeZone,
    string? CurrencyCode);

public sealed record ChangeMyPasswordRequest(string CurrentPassword, string NewPassword);

// ── Password reset ───────────────────────────────────────────────────────────

public sealed record SendPasswordResetLinkRequest(string? RedirectUrl);
public sealed record ForgotPasswordRequest(string Email, string? TenantSlug);
public sealed record ResetPasswordRequest(Guid Uid, string Token, string NewPassword);
