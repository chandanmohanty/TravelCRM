// src/app/core/services/leads.service.ts
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

@Injectable({ providedIn: 'root' })
export class LeadsService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly url  = `${this.base}/crm/leads`;

  list():                               Observable<LeadDto[]>  { return this.http.get<LeadDto[]>(this.url); }
  get(id: string):                      Observable<LeadDto>    { return this.http.get<LeadDto>(`${this.url}/${id}`); }
  create(body: LeadWriteBody):          Observable<LeadDto>    { return this.http.post<LeadDto>(this.url, body); }
  update(id: string, b: LeadWriteBody): Observable<LeadDto>    { return this.http.put<LeadDto>(`${this.url}/${id}`, b); }
  delete(id: string):                   Observable<void>       { return this.http.delete<void>(`${this.url}/${id}`); }
  convert(id: string):                  Observable<LeadDto>    { return this.http.post<LeadDto>(`${this.url}/${id}/convert`, {}); }
}
