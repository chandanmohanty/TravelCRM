import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-base-url.token';

export interface DataResetResult {
  usersDeleted: number;
  identityActivitiesDeleted: number;
  auditLogsDeleted: number;
  notificationsDeleted: number;
  refreshTokensDeleted: number;
  passwordResetTokensDeleted: number;
  employeeSequencesDeleted: number;
}

@Injectable({ providedIn: 'root' })
export class DataResetService {
  private readonly http = inject(HttpClient);
  private readonly api  = `${inject(API_BASE_URL)}/api/settings/data-reset`;

  /** Admin-only. `confirmation` must be the literal string "RESET". */
  reset(confirmation: string): Observable<DataResetResult> {
    return this.http.post<DataResetResult>(this.api, { confirmation });
  }
}
