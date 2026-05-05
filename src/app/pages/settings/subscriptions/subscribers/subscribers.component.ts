import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TablerIconsModule } from 'angular-tabler-icons';
import { FormsModule } from '@angular/forms';

interface Subscriber {
  id: string;
  organisation: string;
  email: string;
  plan: string;
  status: 'active' | 'trialing' | 'past_due' | 'cancelled';
  seats: number;
  mrr: number;
  renewsAt: string;
}

@Component({
  selector: 'app-subscribers',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatTableModule, MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatSelectModule,
    MatPaginatorModule, MatChipsModule, MatTooltipModule, TablerIconsModule,
  ],
  template: `
    <div class="page-header m-b-24">
      <div class="header-row">
        <div>
          <h2 class="f-s-24 f-w-700 m-0">Subscribers</h2>
          <p class="text-muted m-0 m-t-4">All active and past subscribers across subscription plans.</p>
        </div>
        <div class="header-kpis">
          <div class="kpi-chip">
            <span class="kpi-value">{{ totalMrr() | currency }}</span>
            <span class="kpi-label">MRR</span>
          </div>
          <div class="kpi-chip">
            <span class="kpi-value">{{ activeCount() }}</span>
            <span class="kpi-label">Active</span>
          </div>
          <div class="kpi-chip warn">
            <span class="kpi-value">{{ pastDueCount() }}</span>
            <span class="kpi-label">Past Due</span>
          </div>
        </div>
      </div>
    </div>

    <mat-card>
      <mat-card-content>
        <!-- Filters -->
        <div class="filter-bar">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Search organisations</mat-label>
            <input matInput [(ngModel)]="searchText" placeholder="Name or email…">
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Plan</mat-label>
            <mat-select [(ngModel)]="planFilter">
              <mat-option value="">All Plans</mat-option>
              <mat-option value="Starter">Starter</mat-option>
              <mat-option value="Professional">Professional</mat-option>
              <mat-option value="Enterprise">Enterprise</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Status</mat-label>
            <mat-select [(ngModel)]="statusFilter">
              <mat-option value="">All Statuses</mat-option>
              <mat-option value="active">Active</mat-option>
              <mat-option value="trialing">Trialing</mat-option>
              <mat-option value="past_due">Past Due</mat-option>
              <mat-option value="cancelled">Cancelled</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <table mat-table [dataSource]="filtered()" class="sub-table">

          <ng-container matColumnDef="organisation">
            <th mat-header-cell *matHeaderCellDef>Organisation</th>
            <td mat-cell *matCellDef="let s">
              <div class="org-cell">
                <div class="org-avatar">{{ s.organisation.charAt(0) }}</div>
                <div>
                  <div class="org-name">{{ s.organisation }}</div>
                  <div class="org-email">{{ s.email }}</div>
                </div>
              </div>
            </td>
          </ng-container>

          <ng-container matColumnDef="plan">
            <th mat-header-cell *matHeaderCellDef>Plan</th>
            <td mat-cell *matCellDef="let s">
              <span [class]="'plan-chip plan-' + s.plan.toLowerCase()">{{ s.plan }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let s">
              <span [class]="'status-chip status-' + s.status">
                {{ s.status | titlecase | slice:0:8 }}{{ s.status === 'past_due' ? 'Past Due' : '' }}
              </span>
            </td>
          </ng-container>

          <ng-container matColumnDef="seats">
            <th mat-header-cell *matHeaderCellDef>Seats</th>
            <td mat-cell *matCellDef="let s">{{ s.seats }}</td>
          </ng-container>

          <ng-container matColumnDef="mrr">
            <th mat-header-cell *matHeaderCellDef>MRR</th>
            <td mat-cell *matCellDef="let s">{{ s.mrr | currency }}</td>
          </ng-container>

          <ng-container matColumnDef="renewsAt">
            <th mat-header-cell *matHeaderCellDef>Renews</th>
            <td mat-cell *matCellDef="let s">{{ s.renewsAt }}</td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let s">
              <button mat-icon-button matTooltip="View details"><mat-icon>open_in_new</mat-icon></button>
              <button mat-icon-button matTooltip="Change plan" color="primary"><mat-icon>swap_horiz</mat-icon></button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns;" class="sub-row"></tr>
        </table>

        <mat-paginator [length]="filtered().length" [pageSize]="10"
                       [pageSizeOptions]="[10, 25, 50]" showFirstLastButtons></mat-paginator>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; }
    .header-kpis { display: flex; gap: 12px; }
    .kpi-chip { display: flex; flex-direction: column; align-items: center;
      background: #f5f5f5; border-radius: 10px; padding: 8px 18px; min-width: 80px; }
    .kpi-chip.warn { background: #fff8e1; }
    .kpi-value { font-size: 20px; font-weight: 800; }
    .kpi-label { font-size: 11px; text-transform: uppercase; color: #888; font-weight: 600; }
    mat-card-content { padding: 0 !important; }
    .filter-bar { display: flex; gap: 12px; padding: 16px; flex-wrap: wrap; }
    .filter-bar mat-form-field { flex: 1; min-width: 180px; }
    .sub-table { width: 100%; }
    .sub-row:hover { background: #fafafa; }
    .org-cell { display: flex; align-items: center; gap: 12px; }
    .org-avatar {
      width: 34px; height: 34px; border-radius: 8px;
      background: linear-gradient(135deg, #1976d2, #42a5f5);
      color: white; font-weight: 800; font-size: 14px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .org-name  { font-weight: 600; font-size: 14px; }
    .org-email { font-size: 12px; color: #888; }
    .plan-chip { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .plan-starter      { background: #e3f2fd; color: #1565c0; }
    .plan-professional { background: #f3e5f5; color: #6a1b9a; }
    .plan-enterprise   { background: #e8f5e9; color: #2e7d32; }
    .status-chip { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 12px; font-weight: 600; }
    .status-active    { background: #e8f5e9; color: #2e7d32; }
    .status-trialing  { background: #e3f2fd; color: #1565c0; }
    .status-past_due  { background: #fff8e1; color: #f57f17; }
    .status-cancelled { background: #fce4ec; color: #c62828; }
  `],
})
export class SubscribersComponent {
  columns = ['organisation', 'plan', 'status', 'seats', 'mrr', 'renewsAt', 'actions'];
  searchText = '';
  planFilter = '';
  statusFilter = '';

  subscribers: Subscriber[] = [
    { id: '1', organisation: 'Acme Travel', email: 'admin@acme.com', plan: 'Enterprise', status: 'active', seats: 45, mrr: 299, renewsAt: '1 May 2026' },
    { id: '2', organisation: 'Blue Horizon Tours', email: 'ops@bluehorizon.io', plan: 'Professional', status: 'active', seats: 12, mrr: 99, renewsAt: '15 Apr 2026' },
    { id: '3', organisation: 'Wanderlust Co.', email: 'billing@wanderlust.co', plan: 'Starter', status: 'trialing', seats: 3, mrr: 0, renewsAt: '10 Apr 2026' },
    { id: '4', organisation: 'Skyline Adventures', email: 'admin@skyline.com', plan: 'Professional', status: 'past_due', seats: 18, mrr: 99, renewsAt: '1 Apr 2026' },
    { id: '5', organisation: 'Pacific Routes', email: 'finance@pacific.io', plan: 'Enterprise', status: 'active', seats: 60, mrr: 299, renewsAt: '1 Jun 2026' },
    { id: '6', organisation: 'Globe Trekkers', email: 'admin@globetrek.net', plan: 'Starter', status: 'cancelled', seats: 5, mrr: 0, renewsAt: '—' },
    { id: '7', organisation: 'Summit Escapes', email: 'hello@summitescapes.com', plan: 'Professional', status: 'active', seats: 9, mrr: 99, renewsAt: '20 Apr 2026' },
  ];

  filtered = () => this.subscribers.filter(s =>
    (!this.searchText || s.organisation.toLowerCase().includes(this.searchText.toLowerCase()) || s.email.toLowerCase().includes(this.searchText.toLowerCase())) &&
    (!this.planFilter || s.plan === this.planFilter) &&
    (!this.statusFilter || s.status === this.statusFilter)
  );

  totalMrr  = () => this.filtered().reduce((acc, s) => acc + s.mrr, 0);
  activeCount  = () => this.filtered().filter(s => s.status === 'active').length;
  pastDueCount = () => this.filtered().filter(s => s.status === 'past_due').length;
}
