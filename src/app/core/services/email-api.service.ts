import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-base-url.token';
import {
  EmailConfigDto,
  EmailConfigRequest,
  SendTestEmailResult,
} from '../models/email-config.model';

@Injectable({ providedIn: 'root' })
export class EmailApiService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  // ── Platform scope ─────────────────────────────────────────────────

  getPlatformConfigs(): Observable<EmailConfigDto[]> {
    return this.http.get<EmailConfigDto[]>(`${this.base}/api/platform/email`);
  }

  createPlatformConfig(body: EmailConfigRequest): Observable<EmailConfigDto> {
    return this.http.post<EmailConfigDto>(`${this.base}/api/platform/email`, body);
  }

  updatePlatformConfig(id: string, body: EmailConfigRequest): Observable<EmailConfigDto> {
    return this.http.put<EmailConfigDto>(`${this.base}/api/platform/email/${id}`, body);
  }

  deletePlatformConfig(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/platform/email/${id}`);
  }

  activatePlatformConfig(id: string): Observable<void> {
    return this.http.patch<void>(`${this.base}/api/platform/email/${id}/activate`, {});
  }

  testPlatformConfig(id: string, toEmail: string): Observable<SendTestEmailResult> {
    return this.http.post<SendTestEmailResult>(
      `${this.base}/api/platform/email/${id}/test`, { toEmail });
  }

  // ── Tenant scope ───────────────────────────────────────────────────

  getTenantConfigs(): Observable<EmailConfigDto[]> {
    return this.http.get<EmailConfigDto[]>(`${this.base}/api/tenant/email`);
  }

  createTenantConfig(body: EmailConfigRequest): Observable<EmailConfigDto> {
    return this.http.post<EmailConfigDto>(`${this.base}/api/tenant/email`, body);
  }

  updateTenantConfig(id: string, body: EmailConfigRequest): Observable<EmailConfigDto> {
    return this.http.put<EmailConfigDto>(`${this.base}/api/tenant/email/${id}`, body);
  }

  deleteTenantConfig(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/tenant/email/${id}`);
  }

  activateTenantConfig(id: string): Observable<void> {
    return this.http.patch<void>(`${this.base}/api/tenant/email/${id}/activate`, {});
  }

  testTenantConfig(id: string, toEmail: string): Observable<SendTestEmailResult> {
    return this.http.post<SendTestEmailResult>(
      `${this.base}/api/tenant/email/${id}/test`, { toEmail });
  }
}
