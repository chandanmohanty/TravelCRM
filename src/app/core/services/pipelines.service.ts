import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-base-url.token';
import { PipelineDto, PipelineStageDto, PipelineStageKind } from '../models/crm.models';

/**
 * Tenant-scoped pipelines + stages CRUD. Signal-cached list because pickers
 * appear in 3+ places (kanban header, deals list filter, deal form).
 *
 * EnvelopeInterceptor unwraps `{success, data}` so methods see bare DTOs.
 */
@Injectable({ providedIn: 'root' })
export class PipelinesService {
  private readonly http    = inject(HttpClient);
  private readonly apiBase = inject(API_BASE_URL);

  private readonly _pipelines = signal<PipelineDto[]>([]);
  readonly pipelines = this._pipelines.asReadonly();

  /** Tenant's default pipeline (or first active). */
  readonly defaultPipeline = computed(() =>
    this._pipelines().find(p => p.isDefault) ??
    this._pipelines().find(p => p.isActive) ??
    null);

  list(includeInactive = false): Observable<PipelineDto[]> {
    let params = new HttpParams();
    if (includeInactive) params = params.set('includeInactive', 'true');
    return this.http
      .get<PipelineDto[]>(`${this.apiBase}/api/crm/pipelines`, { params })
      .pipe(tap(p => this._pipelines.set(p)));
  }

  get(id: string): Observable<PipelineDto> {
    return this.http.get<PipelineDto>(`${this.apiBase}/api/crm/pipelines/${id}`);
  }

  create(body: {
    name: string;
    description?: string | null;
    isDefault: boolean;
    initialStages?: Array<{ name: string; probability: number; kind: PipelineStageKind; colorHex: string }>;
  }): Observable<PipelineDto> {
    return this.http.post<PipelineDto>(`${this.apiBase}/api/crm/pipelines`, body);
  }

  update(id: string, body: {
    name: string;
    description?: string | null;
    isActive: boolean;
    isDefault: boolean;
  }): Observable<{ id: string }> {
    return this.http.put<{ id: string }>(`${this.apiBase}/api/crm/pipelines/${id}`, body);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiBase}/api/crm/pipelines/${id}`);
  }

  // ── Stages ──────────────────────────────────────────────────────────────────

  addStage(pipelineId: string, body: {
    name: string; probability: number; kind: PipelineStageKind; colorHex: string; sortOrder?: number;
  }): Observable<PipelineStageDto> {
    return this.http.post<PipelineStageDto>(
      `${this.apiBase}/api/crm/pipelines/${pipelineId}/stages`, body);
  }

  updateStage(pipelineId: string, stageId: string, body: {
    name: string; probability: number; kind: PipelineStageKind; colorHex: string; isActive: boolean;
  }): Observable<{ id: string }> {
    return this.http.put<{ id: string }>(
      `${this.apiBase}/api/crm/pipelines/${pipelineId}/stages/${stageId}`, body);
  }

  deleteStage(pipelineId: string, stageId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiBase}/api/crm/pipelines/${pipelineId}/stages/${stageId}`);
  }

  reorderStages(pipelineId: string, stageIds: string[]): Observable<void> {
    return this.http.put<void>(
      `${this.apiBase}/api/crm/pipelines/${pipelineId}/stages/reorder`, { stageIds });
  }

  clear(): void { this._pipelines.set([]); }
}
