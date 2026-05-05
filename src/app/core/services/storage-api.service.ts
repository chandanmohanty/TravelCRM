import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-base-url.token';
import {
  StorageConfigDto,
  StorageConfigRequest,
  TestConnectionResult,
} from '../models/storage-config.model';

/**
 * HTTP wrapper for the storage configuration CRUD endpoints.
 * Follows the same dual-scope pattern as BrandApiService — separate methods
 * for tenant vs platform, all built from `API_BASE_URL`.
 */
@Injectable({ providedIn: 'root' })
export class StorageApiService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  // ── Platform scope ─────────────────────────────────────────────────

  getPlatformConfigs(): Observable<StorageConfigDto[]> {
    return this.http.get<StorageConfigDto[]>(`${this.base}/api/platform/storage`);
  }

  createPlatformConfig(body: StorageConfigRequest): Observable<StorageConfigDto> {
    return this.http.post<StorageConfigDto>(`${this.base}/api/platform/storage`, body);
  }

  updatePlatformConfig(id: string, body: StorageConfigRequest): Observable<StorageConfigDto> {
    return this.http.put<StorageConfigDto>(`${this.base}/api/platform/storage/${id}`, body);
  }

  deletePlatformConfig(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/platform/storage/${id}`);
  }

  activatePlatformConfig(id: string): Observable<void> {
    return this.http.patch<void>(`${this.base}/api/platform/storage/${id}/activate`, {});
  }

  testPlatformConfig(id: string): Observable<TestConnectionResult> {
    return this.http.post<TestConnectionResult>(`${this.base}/api/platform/storage/${id}/test`, {});
  }

  // ── Tenant scope ───────────────────────────────────────────────────

  getTenantConfigs(): Observable<StorageConfigDto[]> {
    return this.http.get<StorageConfigDto[]>(`${this.base}/api/tenant/storage`);
  }

  createTenantConfig(body: StorageConfigRequest): Observable<StorageConfigDto> {
    return this.http.post<StorageConfigDto>(`${this.base}/api/tenant/storage`, body);
  }

  updateTenantConfig(id: string, body: StorageConfigRequest): Observable<StorageConfigDto> {
    return this.http.put<StorageConfigDto>(`${this.base}/api/tenant/storage/${id}`, body);
  }

  deleteTenantConfig(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/tenant/storage/${id}`);
  }

  activateTenantConfig(id: string): Observable<void> {
    return this.http.patch<void>(`${this.base}/api/tenant/storage/${id}/activate`, {});
  }

  testTenantConfig(id: string): Observable<TestConnectionResult> {
    return this.http.post<TestConnectionResult>(`${this.base}/api/tenant/storage/${id}/test`, {});
  }
}
