import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-base-url.token';

export interface SystemSettings {
  dateFormat: string;
  timeFormat: string;
  defaultTimeZone: string;
  defaultCurrencyCode: string;
  fiscalYearStartMonth: number;
  fiscalYearStartDay: number;
}

export interface InvoiceSettings {
  numberingTemplate: string;
  nextSequence: number;
  gstNumber: string | null;
  gstLegalName: string | null;
  gstAddress: string | null;
  gstStateCode: string | null;
  defaultTerms: string | null;
  defaultNotes: string | null;
}

@Injectable({ providedIn: 'root' })
export class TenantSettingsService {
  private readonly http = inject(HttpClient);
  private readonly api  = `${inject(API_BASE_URL)}/api/settings`;

  getSystem(): Observable<SystemSettings> {
    return this.http.get<SystemSettings>(`${this.api}/system`);
  }
  saveSystem(body: SystemSettings): Observable<SystemSettings> {
    return this.http.put<SystemSettings>(`${this.api}/system`, body);
  }

  getInvoice(): Observable<InvoiceSettings> {
    return this.http.get<InvoiceSettings>(`${this.api}/invoice`);
  }
  saveInvoice(body: Omit<InvoiceSettings, 'nextSequence'>): Observable<InvoiceSettings> {
    return this.http.put<InvoiceSettings>(`${this.api}/invoice`, body);
  }
}
