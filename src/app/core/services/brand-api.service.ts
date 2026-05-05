import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-base-url.token';
import {
  BrandAssetKind,
  BrandAssetUploadResponse,
  BrandResolved,
  BrandSettings,
  UpdateBrandSettingsRequest,
} from '../models/brand-settings.model';

/**
 * Thin HTTP wrapper over the `/api/branding`, `/api/tenant/branding`, and
 * `/api/platform/branding` endpoints. Every URL is built from the
 * `API_BASE_URL` injection token — no hardcoded hosts.
 */
@Injectable({ providedIn: 'root' })
export class BrandApiService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  // ── Resolved brand (bootstrap) ─────────────────────────────────────

  /** GET /api/branding/resolved — used by APP_INITIALIZER. */
  getResolved(): Observable<BrandResolved> {
    return this.http.get<BrandResolved>(`${this.base}/api/branding/resolved`);
  }

  // ── Tenant scope ───────────────────────────────────────────────────

  getTenantBrand(): Observable<BrandSettings> {
    return this.http.get<BrandSettings>(`${this.base}/api/tenant/branding`);
  }

  updateTenantBrand(body: UpdateBrandSettingsRequest): Observable<BrandSettings> {
    return this.http.put<BrandSettings>(`${this.base}/api/tenant/branding`, body);
  }

  uploadTenantAsset(kind: BrandAssetKind, file: File): Observable<BrandAssetUploadResponse> {
    const form = new FormData();
    form.append('file', file, file.name);
    const params = new HttpParams().set('kind', kind);
    return this.http.post<BrandAssetUploadResponse>(
      `${this.base}/api/tenant/branding/assets`,
      form,
      { params },
    );
  }

  // ── Platform scope ─────────────────────────────────────────────────

  getPlatformBrand(): Observable<BrandSettings> {
    return this.http.get<BrandSettings>(`${this.base}/api/platform/branding`);
  }

  updatePlatformBrand(body: UpdateBrandSettingsRequest): Observable<BrandSettings> {
    return this.http.put<BrandSettings>(`${this.base}/api/platform/branding`, body);
  }

  uploadPlatformAsset(kind: BrandAssetKind, file: File): Observable<BrandAssetUploadResponse> {
    const form = new FormData();
    form.append('file', file, file.name);
    const params = new HttpParams().set('kind', kind);
    return this.http.post<BrandAssetUploadResponse>(
      `${this.base}/api/platform/branding/assets`,
      form,
      { params },
    );
  }
}
