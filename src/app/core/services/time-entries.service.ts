import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-base-url.token';
import { TimeEntryDto, TimeEntryWriteBody } from '../../models/task.model';

@Injectable({ providedIn: 'root' })
export class TimeEntriesService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  private taskUrl(taskId: string) {
    return `${this.base}/api/crm/tasks/${taskId}/time-entries`;
  }

  list(taskId: string): Observable<TimeEntryDto[]> {
    return this.http.get<TimeEntryDto[]>(this.taskUrl(taskId));
  }

  log(taskId: string, body: TimeEntryWriteBody): Observable<TimeEntryDto> {
    return this.http.post<TimeEntryDto>(this.taskUrl(taskId), body);
  }

  delete(taskId: string, id: string): Observable<void> {
    return this.http.delete<void>(`${this.taskUrl(taskId)}/${id}`);
  }
}
