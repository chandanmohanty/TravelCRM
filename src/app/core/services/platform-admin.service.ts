import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-base-url.token';

export interface TenantDto {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  userCount: number;
  createdAt: string;
}

export interface PlatformStatsDto {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  activeUsers: number;
  platformAdmins: number;
  usersByPlan: Record<string, number>;
}

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateTenantRequest {
  name: string;
  slug: string;
  plan: string;
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
  adminPassword: string;
}

@Injectable({ providedIn: 'root' })
export class PlatformAdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/api/platform`;

  getStats(): Observable<PlatformStatsDto> {
    return this.http.get<PlatformStatsDto>(`${this.base}/stats`);
  }

  getTenants(
    page = 1, pageSize = 20, search = '', planFilter = ''
  ): Observable<PaginatedResponse<TenantDto>> {
    const params = new HttpParams()
      .set('page', page)
      .set('pageSize', pageSize)
      .set('search', search)
      .set('planFilter', planFilter);
    return this.http.get<PaginatedResponse<TenantDto>>(`${this.base}/tenants`, { params });
  }

  createTenant(req: CreateTenantRequest): Observable<TenantDto> {
    return this.http.post<TenantDto>(`${this.base}/tenants`, req);
  }

  updateTenant(id: string, req: Partial<{ name: string; slug: string; plan: string }>): Observable<TenantDto> {
    return this.http.put<TenantDto>(`${this.base}/tenants/${id}`, req);
  }

  toggleTenantStatus(id: string): Observable<{ isActive: boolean }> {
    return this.http.patch<{ isActive: boolean }>(`${this.base}/tenants/${id}/toggle`, {});
  }
}
