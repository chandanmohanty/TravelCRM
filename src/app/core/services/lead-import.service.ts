import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-base-url.token';
import {
  ParseResult,
  PreviewResult,
  LeadImportResult,
  GoogleStatus,
  SheetTab,
  SheetHeaders,
  LeadSource,
  CreateLeadSourceRequest,
  UpdateLeadSourceRequest,
} from '../models/lead-import.model';

/**
 * Excel/CSV + Google Sheets lead import client.
 *
 * The `EnvelopeInterceptor` strips the `{ success, data }` wrapper so
 * each method returns the unwrapped DTO directly.
 */
@Injectable({ providedIn: 'root' })
export class LeadImportService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/api/crm/leads/import`;
  private readonly sourcesBase = `${inject(API_BASE_URL)}/api/crm/lead-sources`;

  /** Upload a workbook and stage its rows server-side. */
  parseExcel(file: File): Observable<ParseResult> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    return this.http.post<ParseResult>(`${this.base}/excel/parse`, fd);
  }

  /** Dry-run the import: returns row counts and a sample of errors. */
  preview(
    stagingId: string,
    mapping: Record<string, string>,
    matchKeyField: string,
  ): Observable<PreviewResult> {
    return this.http.post<PreviewResult>(`${this.base}/excel/preview`, {
      stagingId,
      mapping,
      matchKeyField,
    });
  }

  /** Apply the import; returns the final per-row outcome counts. */
  commit(
    stagingId: string,
    mapping: Record<string, string>,
    matchKeyField: string,
  ): Observable<LeadImportResult> {
    return this.http.post<LeadImportResult>(`${this.base}/excel/commit`, {
      stagingId,
      mapping,
      matchKeyField,
    });
  }

  // ── Google OAuth ───────────────────────────────────────────────────────

  googleStatus(): Observable<GoogleStatus> {
    return this.http.get<GoogleStatus>(`${this.base}/google/status`);
  }

  googleAuthUrl(): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(`${this.base}/google/auth-url`);
  }

  googleDisconnect(): Observable<{ disconnected: boolean }> {
    return this.http.post<{ disconnected: boolean }>(
      `${this.base}/google/disconnect`,
      {},
    );
  }

  // ── Google Sheets queries ─────────────────────────────────────────────

  sheetTabs(spreadsheetId: string): Observable<SheetTab[]> {
    return this.http.get<SheetTab[]>(
      `${this.base}/google/sheets/${encodeURIComponent(spreadsheetId)}/tabs`,
    );
  }

  sheetHeaders(spreadsheetId: string, tab: string): Observable<SheetHeaders> {
    const params = new HttpParams().set('tab', tab);
    return this.http.get<SheetHeaders>(
      `${this.base}/google/sheets/${encodeURIComponent(spreadsheetId)}/headers`,
      { params },
    );
  }

  // ── Lead Sources CRUD + sync controls ─────────────────────────────────

  listSources(): Observable<LeadSource[]> {
    return this.http.get<LeadSource[]>(this.sourcesBase);
  }

  createSource(req: CreateLeadSourceRequest): Observable<LeadSource> {
    return this.http.post<LeadSource>(this.sourcesBase, req);
  }

  updateSource(id: string, req: UpdateLeadSourceRequest): Observable<LeadSource> {
    return this.http.put<LeadSource>(`${this.sourcesBase}/${id}`, req);
  }

  deleteSource(id: string): Observable<void> {
    return this.http.delete<void>(`${this.sourcesBase}/${id}`);
  }

  syncNow(id: string): Observable<void> {
    return this.http.post<void>(`${this.sourcesBase}/${id}/sync`, {});
  }

  pauseSource(id: string): Observable<void> {
    return this.http.post<void>(`${this.sourcesBase}/${id}/pause`, {});
  }

  resumeSource(id: string): Observable<void> {
    return this.http.post<void>(`${this.sourcesBase}/${id}/resume`, {});
  }
}
