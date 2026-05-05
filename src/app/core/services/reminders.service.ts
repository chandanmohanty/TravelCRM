import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export type ReminderTriggerType = 'TimeBased' | 'EventTriggered';
export type ReminderChannel     = 'WhatsApp' | 'Email' | 'Both';
export type ReminderStatus      = 'Active' | 'Paused';

export interface ReminderDto {
  id: string;
  tenantId: string | null;
  title: string;
  messageTemplate: string;
  triggerType: ReminderTriggerType;
  channel: ReminderChannel;
  status: ReminderStatus;
  cronExpression: string | null;
  scheduledAt: string | null;
  eventName: string | null;
  delayMinutes: number | null;
  recipientPhone: string | null;
  recipientEmail: string | null;
  recipientName: string | null;
  hangfireJobId: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface ReminderWriteBody {
  title: string;
  messageTemplate: string;
  triggerType: ReminderTriggerType;
  channel: ReminderChannel;
  status?: ReminderStatus;
  cronExpression: string | null;
  scheduledAt: string | null;
  eventName: string | null;
  delayMinutes: number | null;
  recipientPhone: string | null;
  recipientEmail: string | null;
  recipientName: string | null;
}

@Injectable({ providedIn: 'root' })
export class RemindersService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api/reminders`;

  list(): Observable<ReminderDto[]> {
    return this.http.get<any>(this.base).pipe(
      map(r => r?.data ?? r)
    );
  }

  get(id: string): Observable<ReminderDto> {
    return this.http.get<any>(`${this.base}/${id}`).pipe(
      map(r => r?.data ?? r)
    );
  }

  create(body: ReminderWriteBody): Observable<ReminderDto> {
    return this.http.post<any>(this.base, body).pipe(
      map(r => r?.data ?? r)
    );
  }

  update(id: string, body: ReminderWriteBody): Observable<ReminderDto> {
    return this.http.put<any>(`${this.base}/${id}`, { ...body, id }).pipe(
      map(r => r?.data ?? r)
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
