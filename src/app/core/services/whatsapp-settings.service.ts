import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export type WhatsAppProviderKind = 'Gupshup' | 'Wati';

export interface WhatsAppConfigDto {
  id: string;
  tenantId: string | null;
  name: string;
  provider: WhatsAppProviderKind;
  isActive: boolean;
  hasApiKey: boolean;
  phoneNumber: string;
  appName: string | null;
  baseUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface WhatsAppConfigWriteBody {
  name: string;
  provider: WhatsAppProviderKind;
  phoneNumber: string;
  apiKey: string | null;
  appName: string | null;
  baseUrl: string | null;
  isActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class WhatsAppSettingsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api/settings/whatsapp`;

  list(): Observable<WhatsAppConfigDto[]> {
    return this.http.get<any>(this.base).pipe(
      map(r => r?.data ?? r)
    );
  }

  get(id: string): Observable<WhatsAppConfigDto> {
    return this.http.get<any>(`${this.base}/${id}`).pipe(
      map(r => r?.data ?? r)
    );
  }

  create(body: WhatsAppConfigWriteBody): Observable<WhatsAppConfigDto> {
    return this.http.post<any>(this.base, body).pipe(
      map(r => r?.data ?? r)
    );
  }

  update(id: string, body: WhatsAppConfigWriteBody): Observable<WhatsAppConfigDto> {
    return this.http.put<any>(`${this.base}/${id}`, { ...body, id }).pipe(
      map(r => r?.data ?? r)
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  activate(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/activate`, {});
  }

  test(id: string): Observable<{ success: boolean; error?: string }> {
    return this.http.post<any>(`${this.base}/${id}/test`, {}).pipe(
      map(r => r?.data ?? r)
    );
  }
}
