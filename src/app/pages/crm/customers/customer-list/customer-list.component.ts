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
import { MatCardModule } from '@angular/material/card';
import { TablerIconsModule } from 'angular-tabler-icons';
import { Customer, CustomerTier } from '../../../../core/models/crm.models';

const MOCK_CUSTOMERS: Customer[] = [
  { id: 1, firstName: 'James', lastName: 'Carter', email: 'james.carter@email.com', phone: '+1 555-0101', nationality: 'American', tier: 'Gold', loyaltyPoints: 12400, totalBookings: 8, totalSpent: 42000, currency: 'USD', preferredDestinations: ['Paris', 'Tokyo'], preferredPackageTypes: ['Luxury', 'Cultural'], tags: ['VIP'], lastBookingDate: new Date('2024-11-10'), createdAt: new Date('2020-03-15'), updatedAt: new Date() },
  { id: 2, firstName: 'Priya', lastName: 'Nair', email: 'p.nair@email.com', phone: '+91 98200 11234', nationality: 'Indian', tier: 'Platinum', loyaltyPoints: 28900, totalBookings: 19, totalSpent: 98500, currency: 'USD', preferredDestinations: ['Maldives', 'Bali', 'Europe'], preferredPackageTypes: ['Luxury', 'Honeymoon'], tags: ['VIP', 'Repeat'], lastBookingDate: new Date('2024-12-01'), createdAt: new Date('2019-06-20'), updatedAt: new Date() },
  { id: 3, firstName: 'Michael', lastName: 'Torres', email: 'm.torres@email.com', phone: '+52 55 1234 5678', nationality: 'Mexican', tier: 'Silver', loyaltyPoints: 5200, totalBookings: 4, totalSpent: 18000, currency: 'USD', preferredDestinations: ['Cancún', 'Caribbean'], preferredPackageTypes: ['Family', 'Beach'], tags: ['Family'], lastBookingDate: new Date('2024-12-01'), createdAt: new Date('2022-01-08'), updatedAt: new Date() },
  { id: 4, firstName: 'Aisha', lastName: 'Al-Farsi', email: 'aisha@email.ae', phone: '+971 50 123 4567', nationality: 'Emirati', tier: 'Platinum', loyaltyPoints: 45200, totalBookings: 31, totalSpent: 245000, currency: 'USD', preferredDestinations: ['Maldives', 'Paris', 'Tuscany'], preferredPackageTypes: ['Luxury'], tags: ['VIP', 'UHNWI'], lastBookingDate: new Date('2024-11-25'), createdAt: new Date('2018-09-12'), updatedAt: new Date() },
  { id: 5, firstName: 'Lucas', lastName: 'Dupont', email: 'l.dupont@email.fr', phone: '+33 6 12 34 56 78', nationality: 'French', tier: 'Gold', loyaltyPoints: 15800, totalBookings: 12, totalSpent: 61000, currency: 'USD', preferredDestinations: ['Santorini', 'Bali', 'Caribbean'], preferredPackageTypes: ['Honeymoon', 'Luxury'], tags: ['Repeat', 'Newlywed'], lastBookingDate: new Date('2024-12-28'), createdAt: new Date('2021-02-14'), updatedAt: new Date() },
  { id: 6, firstName: 'Chen', lastName: 'Wei', email: 'chen.wei@email.cn', phone: '+86 138 0013 8000', nationality: 'Chinese', tier: 'Silver', loyaltyPoints: 7100, totalBookings: 5, totalSpent: 24000, currency: 'USD', preferredDestinations: ['Japan', 'Europe', 'Australia'], preferredPackageTypes: ['Cultural', 'Adventure'], tags: ['Corporate'], lastBookingDate: new Date('2024-12-05'), createdAt: new Date('2022-07-30'), updatedAt: new Date() },
  { id: 7, firstName: 'Amara', lastName: 'Osei', email: 'a.osei@email.co', phone: '+233 24 123 4567', nationality: 'Ghanaian', tier: 'Bronze', loyaltyPoints: 1800, totalBookings: 2, totalSpent: 8000, currency: 'USD', preferredDestinations: ['Tanzania', 'Kenya', 'Zanzibar'], preferredPackageTypes: ['Adventure'], tags: ['New'], lastBookingDate: new Date('2024-12-18'), createdAt: new Date('2024-06-01'), updatedAt: new Date() },
  { id: 8, firstName: 'Sophie', lastName: 'Andersen', email: 's.andersen@email.dk', phone: '+45 23 45 67 89', nationality: 'Danish', tier: 'Gold', loyaltyPoints: 11200, totalBookings: 9, totalSpent: 38500, currency: 'USD', preferredDestinations: ['Norway', 'Iceland', 'Finland'], preferredPackageTypes: ['Adventure', 'Family'], tags: ['Repeat', 'Family'], lastBookingDate: new Date('2024-11-30'), createdAt: new Date('2020-11-15'), updatedAt: new Date() },
];

@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatTableModule, MatPaginatorModule, MatSortModule,
    MatInputModule, MatFormFieldModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatMenuModule,
    MatCardModule, TablerIconsModule,
  ],
  template: `
    <div class="crm-page">
      <div class="page-header">
        <div class="page-title">
          <h2>Customers</h2>
          <span class="subtitle">Manage your traveller profiles and loyalty</span>
        </div>
        <div class="page-actions">
          <button mat-stroked-button class="mr-2">
            <i-tabler name="download" class="icon-sm mr-1"></i-tabler> Export
          </button>
          <button mat-flat-button color="primary">
            <i-tabler name="plus" class="icon-sm mr-1"></i-tabler> Add Customer
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
          </mat-card-content>
        </mat-card>
      </div>

      <mat-card class="filter-card">
        <mat-card-content>
          <div class="filter-row">
            <mat-form-field appearance="outline" class="filter-search">
              <mat-label>Search customers…</mat-label>
              <input matInput (keyup)="applyFilter($event)" placeholder="Name, email, nationality">
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>
            <mat-form-field appearance="outline" class="filter-select">
              <mat-label>Tier</mat-label>
              <mat-select [(ngModel)]="tierFilter" (ngModelChange)="filterChanged()">
                <mat-option value="">All Tiers</mat-option>
                <mat-option *ngFor="let t of tiers" [value]="t">{{ t }}</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="table-card">
        <mat-card-content>
          <div class="table-wrapper">
            <table mat-table [dataSource]="dataSource" matSort class="crm-table">

              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Customer</th>
                <td mat-cell *matCellDef="let row">
                  <div class="customer-cell">
                    <div class="avatar" [style.background]="getColor(row.firstName)">{{ row.firstName[0] }}{{ row.lastName[0] }}</div>
                    <div>
                      <strong>{{ row.firstName }} {{ row.lastName }}</strong>
                      <div class="sub-text">{{ row.email }}</div>
                    </div>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="nationality">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Nationality</th>
                <td mat-cell *matCellDef="let row">{{ row.nationality }}</td>
              </ng-container>

              <ng-container matColumnDef="tier">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Tier</th>
                <td mat-cell *matCellDef="let row">
                  <span class="tier-badge" [ngClass]="getTierClass(row.tier)">
                    <i-tabler [name]="getTierIcon(row.tier)" class="icon-xs mr-1"></i-tabler>{{ row.tier }}
                  </span>
                </td>
              </ng-container>

              <ng-container matColumnDef="loyaltyPoints">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Points</th>
                <td mat-cell *matCellDef="let row"><strong>{{ row.loyaltyPoints | number }}</strong></td>
              </ng-container>

              <ng-container matColumnDef="totalBookings">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Bookings</th>
                <td mat-cell *matCellDef="let row"><span class="badge">{{ row.totalBookings }}</span></td>
              </ng-container>

              <ng-container matColumnDef="totalSpent">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Total Spent</th>
                <td mat-cell *matCellDef="let row"><strong>{{ row.totalSpent | currency:'USD':'symbol':'1.0-0' }}</strong></td>
              </ng-container>

              <ng-container matColumnDef="lastBookingDate">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Last Booking</th>
                <td mat-cell *matCellDef="let row">{{ row.lastBookingDate | date:'mediumDate' }}</td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let row">
                  <button mat-icon-button [matMenuTriggerFor]="menu">
                    <i-tabler name="dots-vertical" class="icon-sm"></i-tabler>
                  </button>
                  <mat-menu #menu="matMenu">
                    <button mat-menu-item><i-tabler name="eye" class="icon-xs mr-1"></i-tabler> View Profile</button>
                    <button mat-menu-item><i-tabler name="calendar-plus" class="icon-xs mr-1"></i-tabler> New Booking</button>
                    <button mat-menu-item><i-tabler name="mail" class="icon-xs mr-1"></i-tabler> Send Email</button>
                    <button mat-menu-item class="text-error"><i-tabler name="trash" class="icon-xs mr-1"></i-tabler> Delete</button>
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
    .kpi-inner { display: flex; align-items: center; gap: 12px; }
    .kpi-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
    .kpi-data { display: flex; flex-direction: column; }
    .kpi-value { font-size: 22px; font-weight: 700; }
    .kpi-label { font-size: 13px; color: #6c757d; }
    .filter-card { margin-bottom: 20px; }
    .filter-card mat-card-content { padding: 16px; }
    .filter-row { display: flex; gap: 16px; flex-wrap: wrap; }
    .filter-search { flex: 1; min-width: 200px; }
    .filter-select { width: 180px; }
    .table-card mat-card-content { padding: 0; }
    .table-wrapper { overflow-x: auto; }
    .crm-table { width: 100%; }
    .customer-cell { display: flex; align-items: center; gap: 10px; padding: 8px 0; }
    .avatar { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: white; flex-shrink: 0; }
    .sub-text { font-size: 12px; color: #6c757d; }
    .tier-badge { padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; }
    .tier-bronze { background: #fef3c7; color: #92400e; }
    .tier-silver { background: #f1f5f9; color: #475569; }
    .tier-gold { background: #fef9c3; color: #854d0e; }
    .tier-platinum { background: #f5f3ff; color: #5b21b6; }
    .badge { padding: 3px 10px; border-radius: 12px; background: #e8f0fe; color: #1a73e8; font-size: 13px; font-weight: 600; }
    .text-error { color: #dc3545; }
    .mr-1 { margin-right: 4px; }
    .mr-2 { margin-right: 8px; }
    .table-row:hover { background: rgba(0,0,0,0.02); }
    .icon-xs { font-size: 14px; width: 14px; height: 14px; }
    .icon-sm { font-size: 18px; width: 18px; height: 18px; }
    .icon-md { font-size: 24px; width: 24px; height: 24px; }
  `],
})
export class CustomerListComponent implements OnInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns = ['name', 'nationality', 'tier', 'loyaltyPoints', 'totalBookings', 'totalSpent', 'lastBookingDate', 'actions'];
  dataSource = new MatTableDataSource<Customer>(MOCK_CUSTOMERS);

  tierFilter = '';
  tiers: CustomerTier[] = ['Bronze', 'Silver', 'Gold', 'Platinum'];

  kpis = [
    { label: 'Total Customers', value: '1,284', icon: 'users', color: '#1a73e8', bg: '#e8f0fe' },
    { label: 'Platinum & Gold', value: 312, icon: 'crown', color: '#b45309', bg: '#fef3c7' },
    { label: 'Avg. Lifetime Value', value: '$8,450', icon: 'currency-dollar', color: '#7c3aed', bg: '#ede9fe' },
    { label: 'New This Month', value: 48, icon: 'user-plus', color: '#16a34a', bg: '#dcfce7' },
  ];

  ngOnInit() {}

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  applyFilter(event: Event) {
    this.dataSource.filter = (event.target as HTMLInputElement).value.trim().toLowerCase();
  }

  filterChanged() {
    this.dataSource.filterPredicate = (data) => !this.tierFilter || data.tier === this.tierFilter;
    this.dataSource.filter = this.tierFilter || ' ';
  }

  getTierClass(tier: CustomerTier) {
    return { 'tier-bronze': tier === 'Bronze', 'tier-silver': tier === 'Silver', 'tier-gold': tier === 'Gold', 'tier-platinum': tier === 'Platinum' };
  }

  getTierIcon(tier: CustomerTier) {
    return { 'Bronze': 'medal', 'Silver': 'medal-2', 'Gold': 'star', 'Platinum': 'crown' }[tier] || 'medal';
  }

  getColor(name: string) {
    const c = ['#1a73e8', '#0d9488', '#7c3aed', '#ea580c', '#db2777', '#16a34a'];
    return c[name.charCodeAt(0) % c.length];
  }
}
