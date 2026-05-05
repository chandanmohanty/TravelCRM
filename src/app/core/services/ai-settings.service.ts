import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-base-url.token';

export type AiProviderKind = 'Anthropic' | 'OpenAI';

export interface AiProviderConfig {
  id: string;
  tenantId: string | null;
  name: string;
  provider: AiProviderKind;
  model: string;
  isActive: boolean;
  hasApiKey: boolean;
  baseUrl: string | null;
  temperature: number | null;
  maxTokens: number | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface AiConfigWriteBody {
  /** Omit on PUT to keep the existing key; REQUIRED on POST. */
  id?: string;
  name: string;
  provider: AiProviderKind;
  model: string;
  apiKey?: string | null;
  baseUrl?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  isActive: boolean;
}

export interface AiTestResult {
  success: boolean;
  reply: string | null;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class AiSettingsService {
  private readonly http = inject(HttpClient);
  private readonly api  = `${inject(API_BASE_URL)}/api/settings/ai`;

  list():                    Observable<AiProviderConfig[]> { return this.http.get<AiProviderConfig[]>(this.api); }
  get(id: string):           Observable<AiProviderConfig>   { return this.http.get<AiProviderConfig>(`${this.api}/${id}`); }
  create(body: AiConfigWriteBody): Observable<AiProviderConfig> { return this.http.post<AiProviderConfig>(this.api, body); }
  update(id: string, body: AiConfigWriteBody): Observable<AiProviderConfig> {
    return this.http.put<AiProviderConfig>(`${this.api}/${id}`, { ...body, id });
  }
  delete(id: string):        Observable<void>               { return this.http.delete<void>(`${this.api}/${id}`); }
  activate(id: string):      Observable<{ message: string }> { return this.http.post<{ message: string }>(`${this.api}/${id}/activate`, {}); }
  test(id: string):          Observable<AiTestResult>       { return this.http.post<AiTestResult>(`${this.api}/${id}/test`, {}); }
}
