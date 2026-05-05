import { Component, ViewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { TablerIconsModule } from 'angular-tabler-icons';
import { Booking, BookingStatus, PaymentStatus } from '../../../../core/models/crm.models';

const MOCK_BOOKINGS: Booking[] = [
  { id: 1, bookingNumber: 'BK-2024-00124', customerId: 1, customerName: 'James Carter', packageId: 1, packageName: 'Paris Romantic Escape', destinationId: 1, destinationName: 'Paris, France', travelStartDate: new Date('2025-02-14'), travelEndDate: new Date('2025-02-21'), numberOfTravellers: 2, adults: 2, children: 0, totalAmount: 6800, paidAmount: 6800, currency: 'USD', status: 'Confirmed', paymentStatus: 'Paid', assignedAgent: 'Sarah Mitchell', createdAt: new Date('2024-11-10'), updatedAt: new Date() },
  { id: 2, bookingNumber: 'BK-2024-00125', customerId: 4, customerName: 'Aisha Al-Farsi', packageId: 5, packageName: 'Maldives Luxury All-Inclusive', destinationId: 5, destinationName: 'Maldives', travelStartDate: new Date('2025-01-05'), travelEndDate: new Date('2025-01-15'), numberOfTravellers: 4, adults: 2, children: 2, totalAmount: 28000, paidAmount: 14000, currency: 'USD', status: 'Confirmed', paymentStatus: 'Partial', assignedAgent: 'Tom Bradley', createdAt: new Date('2024-11-25'), updatedAt: new Date() },
  { id: 3, bookingNumber: 'BK-2024-00126', customerId: 6, customerName: 'Chen Wei', packageId: 3, packageName: 'Japan Cherry Blossom Tour', destinationId: 3, destinationName: 'Tokyo, Japan', travelStartDate: new Date('2025-04-01'), travelEndDate: new Date('2025-04-10'), numberOfTravellers: 8, adults: 8, children: 0, totalAmount: 42000, paidAmount: 0, currency: 'USD', status: 'Pending', paymentStatus: 'Unpaid', assignedAgent: 'Emma Johnson', createdAt: new Date('2024-12-05'), updatedAt: new Date() },
  { id: 4, bookingNumber: 'BK-2024-00127', customerId: 5, customerName: 'Lucas Dupont', packageId: 7, packageName: 'Santorini Honeymoon Suite', destinationId: 7, destinationName: 'Santorini, Greece', travelStartDate: new Date('2024-12-28'), travelEndDate: new Date('2025-01-04'), numberOfTravellers: 2, adults: 2, children: 0, totalAmount: 9500, paidAmount: 9500, currency: 'USD', status: 'In Progress', paymentStatus: 'Paid', assignedAgent: 'Emma Johnson', createdAt: new Date('2024-11-15'), updatedAt: new Date() },
  { id: 5, bookingNumber: 'BK-2024-00128', customerId: 2, customerName: 'Priya Nair', packageId: 9, packageName: 'Kerala Backwaters Discovery', destinationId: 9, destinationName: 'Kerala, India', travelStartDate: new Date('2024-12-15'), travelEndDate: new Date('2024-12-22'), numberOfTravellers: 3, adults: 2, children: 1, totalAmount: 4200, paidAmount: 4200, currency: 'USD', status: 'Completed', paymentStatus: 'Paid', assignedAgent: 'Tom Bradley', createdAt: new Date('2024-10-20'), updatedAt: new Date() },
  { id: 6, bookingNumber: 'BK-2024-00129', customerId: 3, customerName: 'Michael Torres', packageId: 11, packageName: 'Cancún Beach Resort Package', destinationId: 11, destinationName: 'Cancún, Mexico', travelStartDate: new Date('2025-03-10'), travelEndDate: new Date('2025-03-17'), numberOfTravellers: 6, adults: 4, children: 2, totalAmount: 15000, paidAmount: 5000, currency: 'USD', status: 'Confirmed', paymentStatus: 'Partial', assignedAgent: 'Sarah Mitchell', createdAt: new Date('2024-12-01'), updatedAt: new Date() },
  { id: 7, bookingNumber: 'BK-2024-00130', customerId: 7, customerName: 'Amara Osei', packageId: 13, packageName: 'Serengeti Safari Adventure', destinationId: 13, destinationName: 'Tanzania', travelStartDate: new Date('2025-07-10'), travelEndDate: new Date('2025-07-20'), numberOfTravellers: 2, adults: 2, children: 0, totalAmount: 12000, paidAmount: 0, currency: 'USD', status: 'Pending', paymentStatus: 'Unpaid', assignedAgent: 'Tom Bradley', createdAt: new Date('2024-12-18'), updatedAt: new Date() },
  { id: 8, bookingNumber: 'BK-2024-00131', customerId: 8, customerName: 'Sophie Andersen', packageId: 15, packageName: 'Northern Lights Arctic Tour', destinationId: 15, destinationName: 'Norway', travelStartDate: new Date('2025-01-20'), travelEndDate: new Date('2025-01-27'), numberOfTravellers: 2, adults: 2, children: 0, totalAmount: 8200, paidAmount: 8200, currency: 'USD', status: 'Confirmed', paymentStatus: 'Paid', assignedAgent: 'Sarah Mitchell', createdAt: new Date('2024-11-30'), updatedAt: new Date() },
];

@Component({
  selector: 'app-booking-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatTableModule, MatPaginatorModule, MatSortModule,
    MatInputModule, MatFormFieldModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatMenuModule, MatChipsModule,
    MatCardModule, TablerIconsModule,
  ],
  template: `
    <div class="crm-page">
      <div class="page-header">
        <div class="page-title">
          <h2>Bookings</h2>
          <span class="subtitle">Manage all travel reservations</span>
        </div>
        <div class="page-actions">
          <button mat-stroked-button class="mr-2">
            <i-tabler name="download" class="icon-sm mr-1"></i-tabler> Export
          </button>
          <button mat-flat-button color="primary">
            <i-tabler name="plus" class="icon-sm mr-1"></i-tabler> New Booking
          </button>
        </div>
      </div>

      <div class="kpi-grid">
        <mat-card class="kpi-card" *ngFor="let kpi of kpis">
          <mat-card-content>
            <div class="kpi-inner">
              <div class="kpi-icon" [style.background]="kpi.bg">
                <i-tabler [name]="kpi.icon" [style.color]="kpi.color" class="icon-md"></i-tabler>
              </div>
              <div class="kpi-data">
                <span class="kpi-value">{{ kpi.value }}</span>
                <span class="kpi-label">{{ kpi.label }}</span>
              </div>
            </div>
            <div class="kpi-change" [ngClass]="kpi.up ? 'text-success' : 'text-muted'">
              <i-tabler [name]="kpi.up ? 'trending-up' : 'minus'" class="icon-xs"></i-tabler>
              {{ kpi.change }}
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <mat-card class="filter-card">
        <mat-card-content>
          <div class="filter-row">
            <mat-form-field appearance="outline" class="filter-search">
              <mat-label>Search bookings…</mat-label>
              <input matInput (keyup)="applyFilter($event)" placeholder="Booking #, customer, destination">
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>
            <mat-form-field appearance="outline" class="filter-select">
              <mat-label>Status</mat-label>
              <mat-select [(ngModel)]="statusFilter" (ngModelChange)="filterChanged()">
                <mat-option value="">All</mat-option>
                <mat-option *ngFor="let s of statuses" [value]="s">{{ s }}</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="filter-select">
              <mat-label>Payment</mat-label>
              <mat-select [(ngModel)]="paymentFilter" (ngModelChange)="filterChanged()">
                <mat-option value="">All</mat-option>
                <mat-option *ngFor="let p of paymentStatuses" [value]="p">{{ p }}</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="table-card">
        <mat-card-content>
          <div class="table-wrapper">
            <table mat-table [dataSource]="dataSource" matSort class="crm-table">

              <ng-container matColumnDef="bookingNumber">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Booking #</th>
                <td mat-cell *matCellDef="let row"><strong class="booking-num">{{ row.bookingNumber }}</strong></td>
              </ng-container>

              <ng-container matColumnDef="customerName">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Customer</th>
                <td mat-cell *matCellDef="let row">
                  <div class="customer-cell">
                    <div class="avatar" [style.background]="getColor(row.customerName)">
                      {{ row.customerName[0] }}
                    </div>
                    {{ row.customerName }}
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="destinationName">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Destination</th>
                <td mat-cell *matCellDef="let row">
                  <div class="dest-cell">
                    <i-tabler name="map-pin" class="icon-xs text-primary mr-1"></i-tabler>
                    {{ row.destinationName }}
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="packageName">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Package</th>
                <td mat-cell *matCellDef="let row">{{ row.packageName }}</td>
              </ng-container>

              <ng-container matColumnDef="travelStartDate">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Travel Date</th>
                <td mat-cell *matCellDef="let row">
                  {{ row.travelStartDate | date:'mediumDate' }}
                  <div class="sub-text">to {{ row.travelEndDate | date:'mediumDate' }}</div>
                </td>
              </ng-container>

              <ng-container matColumnDef="numberOfTravellers">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Travellers</th>
                <td mat-cell *matCellDef="let row">
                  <i-tabler name="users" class="icon-xs text-muted mr-1"></i-tabler>
                  {{ row.numberOfTravellers }}
                </td>
              </ng-container>

              <ng-container matColumnDef="totalAmount">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Amount</th>
                <td mat-cell *matCellDef="let row">
                  <strong>{{ row.totalAmount | currency:'USD':'symbol':'1.0-0' }}</strong>
                </td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Status</th>
                <td mat-cell *matCellDef="let row">
                  <span class="status-badge" [ngClass]="getBookingStatusClass(row.status)">{{ row.status }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="paymentStatus">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Payment</th>
                <td mat-cell *matCellDef="let row">
                  <span class="status-badge" [ngClass]="getPaymentStatusClass(row.paymentStatus)">{{ row.paymentStatus }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let row">
                  <button mat-icon-button [matMenuTriggerFor]="menu">
                    <i-tabler name="dots-vertical" class="icon-sm"></i-tabler>
                  </button>
                  <mat-menu #menu="matMenu">
                    <button mat-menu-item><i-tabler name="eye" class="icon-xs mr-1"></i-tabler> View</button>
                    <button mat-menu-item><i-tabler name="edit" class="icon-xs mr-1"></i-tabler> Edit</button>
                    <button mat-menu-item><i-tabler name="receipt" class="icon-xs mr-1"></i-tabler> Invoice</button>
                    <button mat-menu-item class="text-error"><i-tabler name="x" class="icon-xs mr-1"></i-tabler> Cancel</button>
                  </mat-menu>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="table-row"></tr>
            </table>
          </div>
          <mat-paginator [pageSizeOptions]="[10, 25, 50]" showFirstLastButtons></mat-paginator>
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
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .kpi-card mat-card-content { padding: 16px; }
    .kpi-inner { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    .kpi-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
    .kpi-data { display: flex; flex-direction: column; }
    .kpi-value { font-size: 22px; font-weight: 700; }
    .kpi-label { font-size: 13px; color: #6c757d; }
    .kpi-change { font-size: 12px; display: flex; align-items: center; gap: 4px; }
    .text-success { color: #28a745; }
    .text-muted { color: #6c757d; }
    .text-primary { color: #1a73e8; }
    .filter-card { margin-bottom: 20px; }
    .filter-card mat-card-content { padding: 16px; }
    .filter-row { display: flex; gap: 16px; flex-wrap: wrap; }
    .filter-search { flex: 1; min-width: 200px; }
    .filter-select { width: 160px; }
    .table-card mat-card-content { padding: 0; }
    .table-wrapper { overflow-x: auto; }
    .crm-table { width: 100%; }
    .booking-num { font-family: monospace; color: #1a73e8; }
    .customer-cell { display: flex; align-items: center; gap: 8px; }
    .avatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: white; flex-shrink: 0; }
    .dest-cell { display: flex; align-items: center; }
    .sub-text { font-size: 11px; color: #6c757d; }
    .status-badge { padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .booking-pending { background: #fff3e0; color: #e65100; }
    .booking-confirmed { background: #e3f2fd; color: #1565c0; }
    .booking-in-progress { background: #e8f5e9; color: #2e7d32; }
    .booking-completed { background: #f3e5f5; color: #6a1b9a; }
    .booking-cancelled { background: #fce4ec; color: #c62828; }
    .pay-unpaid { background: #fce4ec; color: #c62828; }
    .pay-partial { background: #fff3e0; color: #e65100; }
    .pay-paid { background: #e8f5e9; color: #2e7d32; }
    .mr-1 { margin-right: 4px; }
    .mr-2 { margin-right: 8px; }
    .text-error { color: #dc3545; }
    .table-row:hover { background: rgba(0,0,0,0.02); }
    .icon-xs { font-size: 14px; width: 14px; height: 14px; }
    .icon-sm { font-size: 18px; width: 18px; height: 18px; }
    .icon-md { font-size: 24px; width: 24px; height: 24px; }
  `],
})
export class BookingListComponent implements OnInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns = ['bookingNumber', 'customerName', 'destinationName', 'packageName', 'travelStartDate', 'numberOfTravellers', 'totalAmount', 'status', 'paymentStatus', 'actions'];
  dataSource = new MatTableDataSource<Booking>(MOCK_BOOKINGS);

  statusFilter = '';
  paymentFilter = '';
  statuses: BookingStatus[] = ['Pending', 'Confirmed', 'In Progress', 'Completed', 'Cancelled'];
  paymentStatuses: PaymentStatus[] = ['Unpaid', 'Partial', 'Paid', 'Refunded'];

  kpis = [
    { label: 'Total Bookings', value: 342, change: '+18% this month', up: true, icon: 'calendar-check', color: '#1a73e8', bg: '#e8f0fe' },
    { label: 'Upcoming Travel', value: 87, change: '+12 this week', up: true, icon: 'plane-departure', color: '#0d9488', bg: '#ccfbf1' },
    { label: 'Revenue (MTD)', value: '$284K', change: '+22% vs last month', up: true, icon: 'currency-dollar', color: '#7c3aed', bg: '#ede9fe' },
    { label: 'Pending Payment', value: 23, change: '3 overdue', up: false, icon: 'credit-card', color: '#ea580c', bg: '#ffedd5' },
  ];

  ngOnInit() {}

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.dataSource.filterPredicate = this.createFilter();
  }

  applyFilter(event: Event) {
    const text = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.dataSource.filter = JSON.stringify({ text, status: this.statusFilter, payment: this.paymentFilter });
  }

  filterChanged() {
    this.dataSource.filter = JSON.stringify({ text: '', status: this.statusFilter, payment: this.paymentFilter });
  }

  createFilter() {
    return (data: Booking, filter: string): boolean => {
      const f = JSON.parse(filter || '{}');
      const text = f.text || '';
      const matchText = !text || `${data.bookingNumber} ${data.customerName} ${data.destinationName}`.toLowerCase().includes(text);
      const matchStatus = !f.status || data.status === f.status;
      const matchPayment = !f.payment || data.paymentStatus === f.payment;
      return matchText && matchStatus && matchPayment;
    };
  }

  getBookingStatusClass(status: BookingStatus) {
    return {
      'booking-pending': status === 'Pending',
      'booking-confirmed': status === 'Confirmed',
      'booking-in-progress': status === 'In Progress',
      'booking-completed': status === 'Completed',
      'booking-cancelled': status === 'Cancelled',
    };
  }

  getPaymentStatusClass(status: PaymentStatus) {
    return { 'pay-unpaid': status === 'Unpaid', 'pay-partial': status === 'Partial', 'pay-paid': status === 'Paid' };
  }

  getColor(name: string) {
    const colors = ['#1a73e8', '#0d9488', '#7c3aed', '#ea580c', '#db2777', '#16a34a'];
    return colors[name.charCodeAt(0) % colors.length];
  }
}
