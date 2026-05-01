import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-base-url.token';
import { TenantSettingsDto, TenantSettingsUpdateBody } from '../../models/inventory.model';

@Injectable({ providedIn: 'root' })
export class InventoryTenantSettingsService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly url = `${this.base}/api/inventory/tenant-settings`;

  get(): Observable<TenantSettingsDto> {
    return this.http.get<TenantSettingsDto>(this.url);
  }

  update(body: TenantSettingsUpdateBody): Observable<TenantSettingsDto> {
    return this.http.put<TenantSettingsDto>(this.url, body);
  }
}
