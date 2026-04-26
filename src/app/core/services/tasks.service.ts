import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-base-url.token';
import { TaskDto, TaskWriteBody } from '../../models/task.model';

export interface ListTasksParams {
  search?: string;
  status?: string;
  priority?: string;
  assignedToUserId?: string;
  taskTypeId?: string;
  includeDeleted?: boolean;
}

@Injectable({ providedIn: 'root' })
export class TasksService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly url  = `${this.base}/crm/tasks`;

  list(params?: ListTasksParams): Observable<TaskDto[]> {
    const query: Record<string, string> = {};
    if (params?.search) query['search'] = params.search;
    if (params?.status) query['status'] = params.status;
    if (params?.priority) query['priority'] = params.priority;
    if (params?.assignedToUserId) query['assignedToUserId'] = params.assignedToUserId;
    if (params?.taskTypeId) query['taskTypeId'] = params.taskTypeId;
    if (params?.includeDeleted) query['includeDeleted'] = 'true';
    return this.http.get<TaskDto[]>(this.url, { params: query });
  }

  get(id: string): Observable<TaskDto> {
    return this.http.get<TaskDto>(`${this.url}/${id}`);
  }

  create(body: TaskWriteBody): Observable<TaskDto> {
    return this.http.post<TaskDto>(this.url, body);
  }

  update(id: string, body: TaskWriteBody): Observable<TaskDto> {
    return this.http.put<TaskDto>(`${this.url}/${id}`, body);
  }

  updateStatus(id: string, status: string): Observable<TaskDto> {
    return this.http.patch<TaskDto>(`${this.url}/${id}/status`, { status });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  restore(id: string): Observable<TaskDto> {
    return this.http.post<TaskDto>(`${this.url}/${id}/restore`, {});
  }
}
