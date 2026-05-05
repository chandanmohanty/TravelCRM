import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TablerIconsModule } from 'angular-tabler-icons';
import { FormsModule } from '@angular/forms';

interface HistoryEvent {
  id: string;
  date: string;
  organisation: string;
  event: string;
  eventType: 'upgrade' | 'downgrade' | 'renewal' | 'cancellation' | 'trial_start' | 'payment_failed';
  fromPlan: string;
  toPlan: string;
  amount: number | null;
}

@Component({
  selector: 'app-subscription-history',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatTableModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatPaginatorModule, MatTooltipModule, TablerIconsModule,
  ],
  template: `
    <div class="page-header m-b-24">
      <div class="header-row">
        <div>
          <h2 class="f-s-24 f-w-700 m-0">Subscription History</h2>
          <p class="text-muted m-0 m-t-4">Full audit trail of all subscription events across tenants.</p>
        </div>
        <button mat-stroked-button>
          <mat-icon>download</mat-icon> Export CSV
        </button>
      </div>
    </div>

    <!-- Summary tiles -->
    <div class="summary-row m-b-24">
      <div class="summary-tile">
        <span class="iconify tile-icon text-success" data-icon="solar:graph-up-line-duotone"></span>
        <div class="tile-content">
          <div class="tile-label">Upgrades (30d)</div>
          <div class="tile-value">{{ upgradeCount }}</div>
        </div>
      </div>
      <div class="summary-tile">
        <span class="iconify tile-icon text-warning" data-icon="solar:graph-down-line-duotone"></span>
        <div class="tile-content">
          <div class="tile-label">Downgrades (30d)</div>
          <div class="tile-value">{{ downgradeCount }}</div>
        </div>
      </div>
      <div class="summary-tile">
        <span class="iconify tile-icon text-primary" data-icon="solar:refresh-line-duotone"></span>
        <div class="tile-content">
          <div class="tile-label">Renewals (30d)</div>
          <div class="tile-value">{{ renewalCount }}</div>
        </div>
      </div>
      <div class="summary-tile">
        <span class="iconify tile-icon text-error" data-icon="solar:close-circle-line-duotone"></span>
        <div class="tile-content">
          <div class="tile-label">Cancellations (30d)</div>
          <div class="tile-value">{{ cancellationCount }}</div>
        </div>
      </div>
    </div>

    <mat-card>
      <mat-card-header>
        <div class="card-title-row full-width">
          <div class="card-title-row">
            <span class="iconify f-s-20 text-primary" data-icon="solar:history-line-duotone"></span>
            <mat-card-title>Event Log</mat-card-title>
          </div>
          <div class="filter-group">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Search</mat-label>
              <input matInput [(ngModel)]="search" placeholder="Organisation…">
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Event Type</mat-label>
              <mat-select [(ngModel)]="typeFilter">
                <mat-option value="">All Events</mat-option>
                <mat-option value="upgrade">Upgrade</mat-option>
                <mat-option value="downgrade">Downgrade</mat-option>
                <mat-option value="renewal">Renewal</mat-option>
                <mat-option value="cancellation">Cancellation</mat-option>
                <mat-option value="trial_start">Trial Start</mat-option>
                <mat-option value="payment_failed">Payment Failed</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </div>
      </mat-card-header>
      <mat-card-content>
        <table mat-table [dataSource]="filtered()" class="history-table">

          <ng-container matColumnDef="date">
            <th mat-header-cell *matHeaderCellDef>Date</th>
            <td mat-cell *matCellDef="let e">{{ e.date }}</td>
          </ng-container>

          <ng-container matColumnDef="organisation">
            <th mat-header-cell *matHeaderCellDef>Organisation</th>
            <td mat-cell *matCellDef="let e">
              <span class="org-name">{{ e.organisation }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="eventType">
            <th mat-header-cell *matHeaderCellDef>Event</th>
            <td mat-cell *matCellDef="let e">
              <span [class]="'event-chip event-' + e.eventType">{{ eventLabel(e.eventType) }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="planChange">
            <th mat-header-cell *matHeaderCellDef>Plan Change</th>
            <td mat-cell *matCellDef="let e">
              @if (e.fromPlan !== e.toPlan) {
                <span class="plan-change">
                  {{ e.fromPlan }}
                  <mat-icon class="arrow-icon">arrow_forward</mat-icon>
                  {{ e.toPlan }}
                </span>
              } @else {
                <span class="text-muted">{{ e.toPlan }}</span>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="amount">
            <th mat-header-cell *matHeaderCellDef>Amount</th>
            <td mat-cell *matCellDef="let e">
              {{ e.amount != null ? (e.amount | currency) : '—' }}
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let e">
              <button mat-icon-button matTooltip="Download receipt" [disabled]="e.amount == null">
                <mat-icon>receipt_long</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns;" class="history-row"></tr>
        </table>

        <mat-paginator [length]="filtered().length" [pageSize]="15"
                       [pageSizeOptions]="[15, 30, 50]" showFirstLastButtons></mat-paginator>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; }
    .summary-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    .summary-tile { display: flex; align-items: center; gap: 14px;
      background: white; border-radius: 12px; padding: 16px 20px;
      box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    .tile-icon { font-size: 28px; }
    .tile-label { font-size: 11px; text-transform: uppercase; color: #888; font-weight: 600; }
    .tile-value { font-size: 28px; font-weight: 800; line-height: 1.1; }
    .text-success { color: #2e7d32; }
    .text-warning { color: #f57f17; }
    .text-error   { color: #c62828; }
    .card-title-row { display: flex; align-items: center; gap: 10px; }
    .card-title-row.full-width { justify-content: space-between; width: 100%; }
    .filter-group { display: flex; gap: 12px; }
    .filter-group mat-form-field { min-width: 160px; }
    mat-card-header { padding: 16px 16px 0; }
    mat-card-content { padding: 0 !important; }
    .history-table { width: 100%; }
    .history-row:hover { background: #fafafa; }
    .org-name { font-weight: 600; font-size: 14px; }
    .event-chip { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 12px; font-weight: 600; }
    .event-upgrade        { background: #e8f5e9; color: #2e7d32; }
    .event-downgrade      { background: #fff8e1; color: #f57f17; }
    .event-renewal        { background: #e3f2fd; color: #1565c0; }
    .event-cancellation   { background: #fce4ec; color: #c62828; }
    .event-trial_start    { background: #f3e5f5; color: #6a1b9a; }
    .event-payment_failed { background: #fce4ec; color: #b71c1c; }
    .plan-change { display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 600; }
    .arrow-icon { font-size: 16px; width: 16px; height: 16px; color: #888; }
    @media (max-width: 900px) { .summary-row { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 600px) { .summary-row { grid-template-columns: 1fr; } }
  `],
})
export class SubscriptionHistoryComponent {
  columns    = ['date', 'organisation', 'eventType', 'planChange', 'amount', 'actions'];
  search     = '';
  typeFilter = '';

  events: HistoryEvent[] = [
    { id: '1',  date: '3 Apr 2026', organisation: 'Acme Travel',       event: '', eventType: 'renewal',        fromPlan: 'Enterprise',   toPlan: 'Enterprise',   amount: 299  },
    { id: '2',  date: '2 Apr 2026', organisation: 'Blue Horizon Tours', event: '', eventType: 'upgrade',        fromPlan: 'Starter',      toPlan: 'Professional', amount: 99   },
    { id: '3',  date: '1 Apr 2026', organisation: 'Skyline Adventures', event: '', eventType: 'payment_failed', fromPlan: 'Professional', toPlan: 'Professional', amount: null },
    { id: '4',  date: '30 Mar 2026',organisation: 'Globe Trekkers',     event: '', eventType: 'cancellation',   fromPlan: 'Starter',      toPlan: '—',            amount: null },
    { id: '5',  date: '28 Mar 2026',organisation: 'Wanderlust Co.',     event: '', eventType: 'trial_start',    fromPlan: '—',            toPlan: 'Starter',      amount: null },
    { id: '6',  date: '25 Mar 2026',organisation: 'Pacific Routes',     event: '', eventType: 'upgrade',        fromPlan: 'Professional', toPlan: 'Enterprise',   amount: 299  },
    { id: '7',  date: '20 Mar 2026',organisation: 'Summit Escapes',     event: '', eventType: 'renewal',        fromPlan: 'Professional', toPlan: 'Professional', amount: 99   },
    { id: '8',  date: '15 Mar 2026',organisation: 'Acme Travel',        event: '', eventType: 'renewal',        fromPlan: 'Enterprise',   toPlan: 'Enterprise',   amount: 299  },
    { id: '9',  date: '10 Mar 2026',organisation: 'Blue Horizon Tours', event: '', eventType: 'downgrade',      fromPlan: 'Enterprise',   toPlan: 'Professional', amount: null },
    { id: '10', date: '5 Mar 2026', organisation: 'Pacific Routes',     event: '', eventType: 'renewal',        fromPlan: 'Professional', toPlan: 'Professional', amount: 99   },
  ];

  filtered = () => this.events.filter(e =>
    (!this.search || e.organisation.toLowerCase().includes(this.search.toLowerCase())) &&
    (!this.typeFilter || e.eventType === this.typeFilter)
  );

  get upgradeCount()      { return this.events.filter(e => e.eventType === 'upgrade').length; }
  get downgradeCount()    { return this.events.filter(e => e.eventType === 'downgrade').length; }
  get renewalCount()      { return this.events.filter(e => e.eventType === 'renewal').length; }
  get cancellationCount() { return this.events.filter(e => e.eventType === 'cancellation').length; }

  eventLabel(type: string): string {
    const labels: Record<string, string> = {
      upgrade: 'Upgrade', downgrade: 'Downgrade', renewal: 'Renewal',
      cancellation: 'Cancelled', trial_start: 'Trial Start', payment_failed: 'Payment Failed',
    };
    return labels[type] ?? type;
  }
}
