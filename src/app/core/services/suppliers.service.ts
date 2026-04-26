import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-base-url.token';
import {
  SupplierDto,
  SupplierWriteBody,
  SupplierUpdateBody,
} from '../../models/inventory.model';

export interface ListSuppliersParams {
  supplierType?: string;
}

@Injectable({ providedIn: 'root' })
export class SuppliersService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly url = `${this.base}/api/inventory/suppliers`;

  list(params?: ListSuppliersParams): Observable<SupplierDto[]> {
    const query: Record<string, string> = {};
    if (params?.supplierType) query['supplierType'] = params.supplierType;
    return this.http.get<SupplierDto[]>(this.url, { params: query });
  }

  get(id: string): Observable<SupplierDto> {
    return this.http.get<SupplierDto>(`${this.url}/${id}`);
  }

  create(body: SupplierWriteBody): Observable<SupplierDto> {
    return this.http.post<SupplierDto>(this.url, body);
  }

  update(id: string, body: SupplierUpdateBody): Observable<SupplierDto> {
    return this.http.put<SupplierDto>(`${this.url}/${id}`, body);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
