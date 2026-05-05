import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-base-url.token';

export interface ScheduledTask {
  id: string;
  cron: string;
  queue: string | null;
  lastJobId: string | null;
  lastJobState: string | null;
  lastExecution: string | null;
  lastDuration: string | null;  // .NET TimeSpan — "hh:mm:ss.fff"
  nextExecution: string | null;
  methodName: string | null;
}

@Injectable({ providedIn: 'root' })
export class ScheduledTasksService {
  private readonly http = inject(HttpClient);
  private readonly api  = `${inject(API_BASE_URL)}/api/scheduled-tasks`;

  list(): Observable<ScheduledTask[]> {
    return this.http.get<ScheduledTask[]>(this.api);
  }

  run(jobId: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.api}/${encodeURIComponent(jobId)}/run`, {});
  }
}
