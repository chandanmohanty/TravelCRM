// src/app/core/services/leads.service.ts
import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-base-url.token';
import { LeadStatus, LeadSource } from '../models/crm.models';

export interface LeadDto {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  jobTitle: string;
  status: string;
  source: string;
  score: number;
  assignedTo: string;
  tags: string[];
  notes: string;
  estimatedValue?: number;
  dealCount: number;
  createdAt: string;
  updatedAt?: string;
}

export interface LeadWriteBody {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  jobTitle: string;
  status: LeadStatus;
  source: LeadSource;
  score: number;
  assignedTo: string;
  tags: string[];
  notes: string;
  estimatedValue?: number;
}

export interface LeadListFilters {
  hasDeals?: boolean;
  status?: string;
  source?: string;
  search?: string;
}

@Injectable({ providedIn: 'root' })
export class LeadsService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly url  = `${this.base}/crm/leads`;

  list(filters: LeadListFilters = {}): Observable<LeadDto[]> {
    let params = new HttpParams();
    if (filters.hasDeals !== undefined && filters.hasDeals !== null) {
      params = params.set('hasDeals', String(filters.hasDeals));
    }
    if (filters.status)  params = params.set('status',  filters.status);
    if (filters.source)  params = params.set('source',  filters.source);
    if (filters.search)  params = params.set('search',  filters.search);
    return this.http.get<LeadDto[]>(this.url, { params });
  }

  get(id: string):                      Observable<LeadDto>    { return this.http.get<LeadDto>(`${this.url}/${id}`); }
  create(body: LeadWriteBody):          Observable<LeadDto>    { return this.http.post<LeadDto>(this.url, body); }
  update(id: string, b: LeadWriteBody): Observable<LeadDto>    { return this.http.put<LeadDto>(`${this.url}/${id}`, b); }
  delete(id: string):                   Observable<void>       { return this.http.delete<void>(`${this.url}/${id}`); }
}
