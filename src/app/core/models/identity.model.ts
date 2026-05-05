/**
 * Shapes returned by the backend Identity module. Mirrors the C# records in
 * `TravelCrm.Api.Features.Identity.DTOs.IdentityDtos`.
 */

// ── User ─────────────────────────────────────────────────────────────────────

export interface UserRoleRef {
  id:    string;
  name:  string;
  slug:  string | null;
}

export type UserStatus = 'Active' | 'Inactive' | 'Suspended' | 'PendingInvitation';

export interface UserDto {
  id:                 string;
  tenantId:           string | null;
  employeeId:         string | null;
  email:              string;
  firstName:          string;
  lastName:           string;
  fullName:           string;
  phone:              string | null;
  avatarUrl:          string | null;
  jobTitle:           string | null;
  departmentId:       string | null;
  departmentName:     string | null;
  teamLeaderId:       string | null;
  teamLeaderName:     string | null;
  status:             UserStatus;
  isPlatformAdmin:    boolean;
  roles:              UserRoleRef[];
  preferredLanguage:  string;
  timeZone:           string;
  currencyCode:       string;
  createdAt:          string;
  updatedAt:          string | null;
  lastLoginAt:        string | null;
}

export interface CreateUserRequest {
  email:        string;
  firstName:    string;
  lastName:     string;
  phone?:       string | null;
  jobTitle?:    string | null;
  departmentId?: string | null;
  roleId:       string;
  teamLeaderId?: string | null;
  password?:    string | null;
  sendInvite:   boolean;
}

export interface UpdateUserRequest {
  firstName:    string;
  lastName:     string;
  phone?:       string | null;
  jobTitle?:    string | null;
  departmentId?: string | null;
  roleId:       string;
  teamLeaderId?: string | null;
  preferredLanguage?: string | null;
  timeZone?:    string | null;
  currencyCode?: string | null;
}

// ── Role ─────────────────────────────────────────────────────────────────────

export interface RoleDto {
  id:              string;
  tenantId:        string | null;
  name:            string;
  slug:            string | null;
  description:     string | null;
  isSystemRole:    boolean;
  permissionCount: number;
  userCount:       number;
  createdAt:       string;
}

export interface RoleWithPermissionsDto {
  id:              string;
  tenantId:        string | null;
  name:            string;
  slug:            string | null;
  description:     string | null;
  isSystemRole:    boolean;
  permissionIds:   string[];
}

export interface CreateRoleRequest {
  name:        string;
  description?: string | null;
}

export interface UpdateRoleRequest {
  name:        string;
  description?: string | null;
}

export interface AssignPermissionsRequest {
  permissionIds: string[];
}

// ── Permission catalog ───────────────────────────────────────────────────────

export interface PermissionDto {
  id:          string;
  slug:        string;
  name:        string;
  module:      string;
  submodule:   string;
  action:      string;
  description: string | null;
  sortOrder:   number;
}

// ── Department ───────────────────────────────────────────────────────────────

export interface DepartmentDto {
  id:           string;
  tenantId:     string;
  name:         string;
  description:  string | null;
  managerId:    string | null;
  managerName:  string | null;
  userCount:    number;
  createdAt:    string;
}

export interface CreateDepartmentRequest {
  name:        string;
  description?: string | null;
  managerId?:   string | null;
}

export interface UpdateDepartmentRequest {
  name:        string;
  description?: string | null;
  managerId?:   string | null;
}

// ── Self-service profile ─────────────────────────────────────────────────────

export interface MyProfileDto {
  id:                string;
  email:             string;
  firstName:         string;
  lastName:          string;
  fullName:          string;
  phone:             string | null;
  avatarUrl:         string | null;
  jobTitle:          string | null;
  departmentId:      string | null;
  preferredLanguage: string;
  timeZone:          string;
  currencyCode:      string;
  roles:             string[];
  permissions:       string[];
}

export interface UpdateMyProfileRequest {
  firstName:         string;
  lastName:          string;
  phone?:            string | null;
  jobTitle?:         string | null;
  preferredLanguage?: string | null;
  timeZone?:         string | null;
  currencyCode?:     string | null;
}

export interface ChangeMyPasswordRequest {
  currentPassword: string;
  newPassword:     string;
}

// ── Password reset flows ─────────────────────────────────────────────────────

export interface ForgotPasswordRequest {
  email:       string;
  tenantSlug?: string | null;
}

export interface ResetPasswordRequest {
  uid:         string;
  token:       string;
  newPassword: string;
}

// ── Pagination envelope (mirrors Common.PaginatedResponse<T>) ────────────────

export interface PaginatedResponse<T> {
  items:      T[];
  page:       number;
  pageSize:   number;
  totalCount: number;
  totalPages: number;
}
