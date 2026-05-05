import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-base-url.token';
import {
  AssignPermissionsRequest,
  ChangeMyPasswordRequest,
  CreateDepartmentRequest,
  CreateRoleRequest,
  CreateUserRequest,
  DepartmentDto,
  ForgotPasswordRequest,
  MyProfileDto,
  PaginatedResponse,
  PermissionDto,
  ResetPasswordRequest,
  RoleDto,
  RoleWithPermissionsDto,
  UpdateDepartmentRequest,
  UpdateMyProfileRequest,
  UpdateRoleRequest,
  UpdateUserRequest,
  UserDto,
} from '../models/identity.model';

/**
 * Typed HTTP wrapper for the tenant-scoped Identity endpoints at
 * `/api/tenant/identity/*` plus the public auth flows at `/api/auth/*`.
 */
@Injectable({ providedIn: 'root' })
export class IdentityApiService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  private readonly tenant = () => `${this.base}/api/tenant/identity`;
  private readonly auth   = () => `${this.base}/api/auth`;

  // ── Users ──────────────────────────────────────────────────────────

  listUsers(params: {
    page?: number; pageSize?: number;
    search?: string; status?: string;
    roleId?: string; departmentId?: string; teamLeaderId?: string;
  } = {}): Observable<PaginatedResponse<UserDto>> {
    let p = new HttpParams();
    if (params.page)        p = p.set('page', params.page);
    if (params.pageSize)    p = p.set('pageSize', params.pageSize);
    if (params.search)      p = p.set('search', params.search);
    if (params.status)      p = p.set('status', params.status);
    if (params.roleId)      p = p.set('roleId', params.roleId);
    if (params.departmentId) p = p.set('departmentId', params.departmentId);
    if (params.teamLeaderId) p = p.set('teamLeaderId', params.teamLeaderId);
    return this.http.get<PaginatedResponse<UserDto>>(`${this.tenant()}/users`, { params: p });
  }

  getUser(id: string): Observable<UserDto> {
    return this.http.get<UserDto>(`${this.tenant()}/users/${id}`);
  }

  createUser(body: CreateUserRequest): Observable<UserDto> {
    return this.http.post<UserDto>(`${this.tenant()}/users`, body);
  }

  updateUser(id: string, body: UpdateUserRequest): Observable<UserDto> {
    return this.http.put<UserDto>(`${this.tenant()}/users/${id}`, body);
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.tenant()}/users/${id}`);
  }

  toggleUserStatus(id: string, activate: boolean): Observable<void> {
    return this.http.patch<void>(`${this.tenant()}/users/${id}/toggle-status`, { activate });
  }

  setUserPassword(id: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.tenant()}/users/${id}/set-password`, { newPassword });
  }

  sendPasswordResetLink(id: string): Observable<void> {
    return this.http.post<void>(`${this.tenant()}/users/${id}/reset-link`, {});
  }

  uploadAvatar(id: string, file: File): Observable<{ url: string }> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<{ url: string }>(`${this.tenant()}/users/${id}/avatar`, form);
  }

  // ── Roles ──────────────────────────────────────────────────────────

  listRoles(): Observable<RoleDto[]> {
    return this.http.get<RoleDto[]>(`${this.tenant()}/roles`);
  }

  getRoleWithPermissions(id: string): Observable<RoleWithPermissionsDto> {
    return this.http.get<RoleWithPermissionsDto>(`${this.tenant()}/roles/${id}`);
  }

  createRole(body: CreateRoleRequest): Observable<RoleDto> {
    return this.http.post<RoleDto>(`${this.tenant()}/roles`, body);
  }

  updateRole(id: string, body: UpdateRoleRequest): Observable<RoleDto> {
    return this.http.put<RoleDto>(`${this.tenant()}/roles/${id}`, body);
  }

  deleteRole(id: string): Observable<void> {
    return this.http.delete<void>(`${this.tenant()}/roles/${id}`);
  }

  assignPermissionsToRole(id: string, body: AssignPermissionsRequest): Observable<void> {
    return this.http.patch<void>(`${this.tenant()}/roles/${id}/permissions`, body);
  }

  // ── Permissions (global catalog) ──────────────────────────────────

  listPermissions(): Observable<PermissionDto[]> {
    return this.http.get<PermissionDto[]>(`${this.tenant()}/permissions`);
  }

  // ── Departments ────────────────────────────────────────────────────

  listDepartments(): Observable<DepartmentDto[]> {
    return this.http.get<DepartmentDto[]>(`${this.tenant()}/departments`);
  }

  createDepartment(body: CreateDepartmentRequest): Observable<DepartmentDto> {
    return this.http.post<DepartmentDto>(`${this.tenant()}/departments`, body);
  }

  updateDepartment(id: string, body: UpdateDepartmentRequest): Observable<DepartmentDto> {
    return this.http.put<DepartmentDto>(`${this.tenant()}/departments/${id}`, body);
  }

  deleteDepartment(id: string): Observable<void> {
    return this.http.delete<void>(`${this.tenant()}/departments/${id}`);
  }

  // ── Self-service profile ───────────────────────────────────────────

  getMyProfile(): Observable<MyProfileDto> {
    return this.http.get<MyProfileDto>(`${this.tenant()}/me`);
  }

  updateMyProfile(body: UpdateMyProfileRequest): Observable<void> {
    return this.http.put<void>(`${this.tenant()}/me`, body);
  }

  changeMyPassword(body: ChangeMyPasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.tenant()}/me/change-password`, body);
  }

  // ── Public auth flows ──────────────────────────────────────────────

  forgotPassword(body: ForgotPasswordRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.auth()}/forgot-password`, body);
  }

  resetPassword(body: ResetPasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.auth()}/reset-password`, body);
  }
}
