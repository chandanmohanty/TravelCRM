import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TablerIconsModule } from 'angular-tabler-icons';
import { SuppliersService } from 'src/app/core/services/suppliers.service';
import { SupplierDto, SupplierType } from 'src/app/models/inventory.model';

@Component({
  selector: 'app-supplier-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, RouterModule,
    MatButtonModule, MatCardModule, MatChipsModule,
    MatFormFieldModule, MatIconModule, MatInputModule,
    MatProgressSpinnerModule, MatSelectModule, MatTableModule, MatTooltipModule,
    TablerIconsModule,
  ],
  template: `
    <div class="crm-page">
      <div class="page-header">
        <div class="page-title">
          <h2>Suppliers</h2>
          <span class="subtitle">Hotels, transport vendors, activity operators, guides</span>
        </div>
        <div class="page-actions">
          <button mat-flat-button color="primary" [routerLink]="['/inventory/suppliers/new']">
            <i-tabler name="plus" class="icon-sm mr-1"></i-tabler> New Supplier
          </button>
        </div>
      </div>

      <div class="kpi-grid">
        <mat-card class="kpi-card">
          <mat-card-content>
            <div class="kpi-inner">
              <div class="kpi-icon" style="background:#e8f0fe">
                <i-tabler name="building" style="color:#1a73e8" class="icon-md"></i-tabler>
              </div>
              <div class="kpi-data">
                <span class="kpi-value">{{ countOf('Hotel') }}</span>
                <span class="kpi-label">Hotels</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="kpi-card">
          <mat-card-content>
            <div class="kpi-inner">
              <div class="kpi-icon" style="background:#fff7e6">
                <i-tabler name="car" style="color:#f59e0b" class="icon-md"></i-tabler>
              </div>
              <div class="kpi-data">
                <span class="kpi-value">{{ countOf('Transport') }}</span>
                <span class="kpi-label">Transport</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="kpi-card">
          <mat-card-content>
            <div class="kpi-inner">
              <div class="kpi-icon" style="background:#dcfce7">
                <i-tabler name="ticket" style="color:#16a34a" class="icon-md"></i-tabler>
              </div>
              <div class="kpi-data">
                <span class="kpi-value">{{ countOf('Activity') }}</span>
                <span class="kpi-label">Activities</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="kpi-card">
          <mat-card-content>
            <div class="kpi-inner">
              <div class="kpi-icon" style="background:#ede9fe">
                <i-tabler name="user-circle" style="color:#7c3aed" class="icon-md"></i-tabler>
              </div>
              <div class="kpi-data">
                <span class="kpi-value">{{ countOf('Guide') }}</span>
                <span class="kpi-label">Guides</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      @if (errorMessage()) {
        <div class="error-banner">
          <i-tabler name="alert-circle" class="icon-sm"></i-tabler>
          {{ errorMessage() }}
        </div>
      }

      <mat-card>
        <mat-card-content class="p-0">
          @if (loading()) {
            <div class="spinner-wrap"><mat-spinner diameter="36"></mat-spinner></div>
          } @else if (suppliers().length === 0) {
            <div class="empty">
              <i-tabler name="building-skyscraper" class="icon-lg"></i-tabler>
              <p>No suppliers yet. Add one to get started.</p>
            </div>
          } @else {
            <table mat-table [dataSource]="suppliers()" class="w-100">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Name</th>
                <td mat-cell *matCellDef="let s">
                  <a [routerLink]="['/inventory/suppliers', s.id]" class="supplier-link">{{ s.name }}</a>
                </td>
              </ng-container>
              <ng-container matColumnDef="type">
                <th mat-header-cell *matHeaderCellDef>Type</th>
                <td mat-cell *matCellDef="let s">
                  <mat-chip [class]="'chip-' + s.supplierType.toLowerCase()">{{ s.supplierType }}</mat-chip>
                </td>
              </ng-container>
              <ng-container matColumnDef="contact">
                <th mat-header-cell *matHeaderCellDef>Contact</th>
                <td mat-cell *matCellDef="let s">
                  {{ s.contactName || '—' }}
                  @if (s.contactEmail) { <small class="d-block text-muted">{{ s.contactEmail }}</small> }
                </td>
              </ng-container>
              <ng-container matColumnDef="active">
                <th mat-header-cell *matHeaderCellDef>Active</th>
                <td mat-cell *matCellDef="let s">
                  @if (s.isActive) {
                    <span class="dot dot-active"></span>
                  } @else {
                    <span class="dot dot-inactive"></span>
                  }
                </td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="actions-col"></th>
                <td mat-cell *matCellDef="let s" class="actions-col">
                  <button mat-icon-button [routerLink]="['/inventory/suppliers', s.id]" matTooltip="Edit">
                    <i-tabler name="pencil" class="icon-sm"></i-tabler>
                  </button>
                  <button mat-icon-button (click)="remove(s)" matTooltip="Delete">
                    <i-tabler name="trash" class="icon-sm"></i-tabler>
                  </button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
            </table>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .crm-page { padding: 24px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .page-title h2 { margin: 0; font-size: 22px; font-weight: 600; }
    .page-title .subtitle { color: #6c757d; font-size: 14px; }
    .page-actions { display: flex; gap: 8px; }
    .mr-1 { margin-right: 4px; }

    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .kpi-card mat-card-content { padding: 16px; }
    .kpi-inner { display: flex; align-items: center; gap: 12px; }
    .kpi-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
    .kpi-data { display: flex; flex-direction: column; }
    .kpi-value { font-size: 24px; font-weight: 700; }
    .kpi-label { font-size: 13px; color: #6c757d; }

    .error-banner {
      display: flex; align-items: center; gap: 8px;
      background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;
      padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 14px;
    }
    .spinner-wrap { display: flex; justify-content: center; padding: 48px; }
    .empty { text-align: center; padding: 48px 24px; color: #94a3b8; }
    .empty i-tabler { color: #cbd5e1; margin-bottom: 12px; }
    .empty p { margin: 0; }

    .supplier-link { color: #4f46e5; text-decoration: none; font-weight: 500; }
    .supplier-link:hover { text-decoration: underline; }
    .actions-col { width: 100px; text-align: right; }
    .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; }
    .dot-active { background: #16a34a; }
    .dot-inactive { background: #94a3b8; }

    .chip-hotel     { background: #dbeafe !important; color: #1e40af !important; }
    .chip-transport { background: #fef3c7 !important; color: #92400e !important; }
    .chip-activity  { background: #dcfce7 !important; color: #15803d !important; }
    .chip-guide     { background: #ede9fe !important; color: #6d28d9 !important; }
    .chip-other     { background: #f1f5f9 !important; color: #475569 !important; }

    @media (max-width: 1100px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 600px) { .kpi-grid { grid-template-columns: 1fr; } }
  `],
})
export class SupplierListComponent implements OnInit {
  private api = inject(SuppliersService);
  private router = inject(Router);

  loading = signal(true);
  suppliers = signal<SupplierDto[]>([]);
  errorMessage = signal<string | null>(null);
  displayedColumns = ['name', 'type', 'contact', 'active', 'actions'];

  ngOnInit(): void { this.reload(); }

  countOf(type: SupplierType): number {
    return this.suppliers().filter(s => s.supplierType === type).length;
  }

  reload(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.api.list().subscribe({
      next: (rows) => { this.suppliers.set(rows); this.loading.set(false); },
      error: (err) => { this.handleApiError(err, 'Failed to load suppliers'); this.loading.set(false); },
    });
  }

  remove(s: SupplierDto): void {
    if (!confirm(`Delete supplier "${s.name}"?`)) return;
    this.errorMessage.set(null);
    this.api.delete(s.id).subscribe({
      next: () => this.reload(),
      error: (err) => this.handleApiError(err, 'Failed to delete supplier'),
    });
  }

  private handleApiError(err: any, fallback: string): void {
    const serverMsg = err?.error?.error as string | undefined;
    if (err?.status === 401) {
      this.errorMessage.set('Your session expired. Please log out and sign in again.');
    } else if (serverMsg?.toLowerCase().includes('tenant')) {
      this.errorMessage.set('Suppliers are tenant-scoped. Platform Admin accounts cannot manage them — please sign in as a tenant user.');
    } else if (err?.status === 403) {
      this.errorMessage.set('You don\'t have permission to manage suppliers.');
    } else if (err?.status === 409) {
      this.errorMessage.set(serverMsg ?? 'Supplier is in use by existing resources and cannot be deleted.');
    } else {
      this.errorMessage.set(serverMsg ?? fallback);
    }
  }
}
