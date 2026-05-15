import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-base-url.token';
import { DealActivityDto, DealDto, DealStatus, KanbanDto } from '../models/crm.models';

/** Paged response shape from `GET /api/crm/deals` — mirrors C# `PagedDeals`. */
export interface PagedDeals {
  items: DealDto[];
  total: number;
}

/**
 * Deals CRUD + kanban. Signal-cached kanban shared between kanban view and
 * deal cards to avoid redundant fetches.
 *
 * EnvelopeInterceptor unwraps `{success, data}` so methods see bare DTOs.
 */
@Injectable({ providedIn: 'root' })
export class DealsService {
  private readonly http    = inject(HttpClient);
  private readonly apiBase = inject(API_BASE_URL);

  /** Last-fetched kanban — shared between kanban view + deal cards. */
  private readonly _kanban = signal<KanbanDto | null>(null);
  readonly kanban = this._kanban.asReadonly();

  list(filters: {
    pipelineId?: string;
    stageId?: string;
    ownerUserId?: string;
    status?: DealStatus;
    hasLead?: boolean;
    leadId?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  } = {}): Observable<PagedDeals> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params = params.set(k, String(v));
    });
    return this.http.get<PagedDeals>(`${this.apiBase}/api/crm/deals`, { params });
  }

  getKanban(pipelineId?: string): Observable<KanbanDto> {
    const params = pipelineId ? new HttpParams().set('pipelineId', pipelineId) : undefined;
    return this.http
      .get<KanbanDto>(`${this.apiBase}/api/crm/deals/kanban`, { params })
      .pipe(tap(k => this._kanban.set(k)));
  }

  get(id: string): Observable<DealDto> {
    return this.http.get<DealDto>(`${this.apiBase}/api/crm/deals/${id}`);
  }

  create(body: {
    leadId?: string;
    title: string;
    contactName: string;
    contactEmail?: string;
    contactPhone?: string;
    companyName?: string;
    pipelineId?: string;
    stageId?: string;
    value?: number;
    currency?: string;
    probability?: number;
    expectedCloseDate?: string;
    ownerUserId?: string;
    tags?: string[];
    notes?: string;
  }): Observable<DealDto> {
    return this.http.post<DealDto>(`${this.apiBase}/api/crm/deals`, body);
  }

  update(id: string, body: {
    rowVersion: string;
    title: string;
    value: number | null;
    currency: string;
    probability: number;
    expectedCloseDate: string | null;
    tags: string[];
    notes: string | null;
  }): Observable<DealDto> {
    return this.http.put<DealDto>(`${this.apiBase}/api/crm/deals/${id}`, body);
  }

  move(id: string, body: {
    rowVersion: string;
    stageId: string;
    note?: string;
  }): Observable<DealDto> {
    return this.http.post<DealDto>(`${this.apiBase}/api/crm/deals/${id}/move`, body);
  }

  reassign(id: string, body: {
    rowVersion: string;
    ownerUserId: string;
    note?: string;
  }): Observable<DealDto> {
    return this.http.post<DealDto>(`${this.apiBase}/api/crm/deals/${id}/reassign`, body);
  }

  addNote(id: string, note: string): Observable<DealActivityDto> {
    return this.http.post<DealActivityDto>(
      `${this.apiBase}/api/crm/deals/${id}/notes`, { note });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiBase}/api/crm/deals/${id}`);
  }

  clear(): void { this._kanban.set(null); }
}
