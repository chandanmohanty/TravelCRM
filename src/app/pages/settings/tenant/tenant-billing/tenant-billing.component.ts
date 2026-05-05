import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { TablerIconsModule } from 'angular-tabler-icons';

interface Invoice {
  id: string;
  date: string;
  description: string;
  amount: string;
  status: 'paid' | 'pending' | 'failed';
}

@Component({
  selector: 'app-tenant-billing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatCardModule, MatButtonModule, MatDividerModule,
    MatIconModule, MatTableModule, MatChipsModule, TablerIconsModule,
  ],
  template: `
    <div class="page-header m-b-24">
      <h2 class="f-s-24 f-w-700 m-0">Billing</h2>
      <p class="text-muted m-0 m-t-4">Manage payment methods and view invoice history.</p>
    </div>

    <div class="billing-layout">

      <!-- Payment Method -->
      <mat-card>
        <mat-card-header>
          <div class="card-title-row">
            <span class="iconify f-s-20 text-primary" data-icon="solar:card-line-duotone"></span>
            <mat-card-title>Payment Method</mat-card-title>
          </div>
        </mat-card-header>
        <mat-card-content class="p-t-16">
          <div class="card-row">
            <div class="payment-card">
              <div class="card-brand">VISA</div>
              <div class="card-number">•••• •••• •••• 4242</div>
              <div class="card-expiry">Expires 08 / 2027</div>
            </div>
            <div class="card-actions">
              <button mat-stroked-button>
                <mat-icon>edit</mat-icon> Update Card
              </button>
              <button mat-stroked-button color="warn">
                <mat-icon>delete_outline</mat-icon> Remove
              </button>
            </div>
          </div>

          <mat-divider class="m-t-16 m-b-16"></mat-divider>

          <div class="billing-address">
            <p class="section-label">Billing Address</p>
            <p class="m-0">TravelCRM Inc.<br>
              123 Main Street, Suite 400<br>
              New York, NY 10001<br>
              United States
            </p>
          </div>
          <button mat-stroked-button class="m-t-12">
            <mat-icon>edit</mat-icon> Edit Address
          </button>
        </mat-card-content>
      </mat-card>

      <!-- Invoice History -->
      <mat-card>
        <mat-card-header>
          <div class="card-title-row">
            <span class="iconify f-s-20 text-primary" data-icon="solar:bill-list-line-duotone"></span>
            <mat-card-title>Invoice History</mat-card-title>
          </div>
        </mat-card-header>
        <mat-card-content class="p-t-8">
          <table mat-table [dataSource]="invoices" class="invoice-table">

            <ng-container matColumnDef="id">
              <th mat-header-cell *matHeaderCellDef>Invoice #</th>
              <td mat-cell *matCellDef="let inv">
                <code class="inv-id">{{ inv.id }}</code>
              </td>
            </ng-container>

            <ng-container matColumnDef="date">
              <th mat-header-cell *matHeaderCellDef>Date</th>
              <td mat-cell *matCellDef="let inv">{{ inv.date }}</td>
            </ng-container>

            <ng-container matColumnDef="description">
              <th mat-header-cell *matHeaderCellDef>Description</th>
              <td mat-cell *matCellDef="let inv">{{ inv.description }}</td>
            </ng-container>

            <ng-container matColumnDef="amount">
              <th mat-header-cell *matHeaderCellDef>Amount</th>
              <td mat-cell *matCellDef="let inv">{{ inv.amount }}</td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let inv">
                <span [class]="'status-chip status-' + inv.status">{{ inv.status }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let inv">
                <button mat-icon-button title="Download PDF">
                  <mat-icon>download</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns;"></tr>
          </table>
        </mat-card-content>
      </mat-card>

    </div>
  `,
  styles: [`
    .billing-layout { display: flex; flex-direction: column; gap: 20px; max-width: 860px; }
    .card-title-row { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
    mat-card-content { padding: 16px !important; }
    .card-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
    .payment-card { background: linear-gradient(135deg, #1976d2, #42a5f5); color: white;
      border-radius: 12px; padding: 20px 24px; min-width: 240px; }
    .card-brand { font-size: 20px; font-weight: 900; letter-spacing: 2px; margin-bottom: 12px; }
    .card-number { font-size: 17px; letter-spacing: 3px; margin-bottom: 8px; }
    .card-expiry { font-size: 12px; opacity: 0.85; }
    .card-actions { display: flex; flex-direction: column; gap: 8px; }
    .section-label { font-size: 11px; text-transform: uppercase; font-weight: 600; color: #999; margin: 0 0 6px; }
    .invoice-table { width: 100%; }
    .inv-id { font-size: 12px; background: #f5f5f5; padding: 2px 6px; border-radius: 4px; }
    .status-chip { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: capitalize; }
    .status-paid { background: #e8f5e9; color: #2e7d32; }
    .status-pending { background: #fff8e1; color: #f57f17; }
    .status-failed { background: #fce4ec; color: #c62828; }
    @media (max-width: 600px) { .card-row { flex-direction: column; align-items: flex-start; } }
  `],
})
export class TenantBillingComponent {
  columns = ['id', 'date', 'description', 'amount', 'status', 'actions'];

  invoices: Invoice[] = [
    { id: 'INV-2026-001', date: '1 Mar 2026', description: 'Enterprise Plan – March 2026', amount: '$1,200.00', status: 'paid' },
    { id: 'INV-2026-002', date: '1 Feb 2026', description: 'Enterprise Plan – February 2026', amount: '$1,200.00', status: 'paid' },
    { id: 'INV-2026-003', date: '1 Jan 2026', description: 'Enterprise Plan – January 2026', amount: '$1,200.00', status: 'paid' },
    { id: 'INV-2025-012', date: '1 Dec 2025', description: 'Enterprise Plan – December 2025', amount: '$1,200.00', status: 'paid' },
  ];
}
