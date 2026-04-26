import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-base-url.token';
import { TaskTypeDto, TaskTypeWriteBody } from '../../models/task.model';

@Injectable({ providedIn: 'root' })
export class TaskTypesService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly url  = `${this.base}/crm/task-types`;

  list(): Observable<TaskTypeDto[]> {
    return this.http.get<TaskTypeDto[]>(this.url);
  }

  create(body: TaskTypeWriteBody): Observable<TaskTypeDto> {
    return this.http.post<TaskTypeDto>(this.url, body);
  }

  update(id: string, body: TaskTypeWriteBody & { isActive: boolean }): Observable<TaskTypeDto> {
    return this.http.put<TaskTypeDto>(`${this.url}/${id}`, body);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
