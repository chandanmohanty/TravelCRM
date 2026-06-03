import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-base-url.token';
import {
  ParseResult,
  PreviewResult,
  LeadImportResult,
} from '../models/lead-import.model';

/**
 * Excel/CSV lead import client. Google Sheets methods land in Task 14.
 *
 * The `EnvelopeInterceptor` strips the `{ success, data }` wrapper so
 * each method returns the unwrapped DTO directly.
 */
@Injectable({ providedIn: 'root' })
export class LeadImportService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/api/crm/leads/import`;

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
}
