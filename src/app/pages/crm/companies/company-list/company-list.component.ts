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
import { Company, CompanyIndustry } from '../../../../core/models/crm.models';

const MOCK_COMPANIES: Company[] = [
  { id: 1, name: 'WanderLust Corp', industry: 'Corporate Travel', phone: '+1 555-0100', email: 'info@wanderlust.com', website: 'www.wanderlust.com', annualRevenue: 2400000, employeeCount: 320, openDeals: 4, totalContacts: 12, assignedTo: 'Sarah Mitchell', tags: ['Enterprise', 'US'], createdAt: new Date('2023-06-01'), updatedAt: new Date() },
  { id: 2, name: 'Arab Travel Agency', industry: 'Travel & Tourism', phone: '+971 4 123 4567', email: 'info@arabtravel.ae', website: 'www.arabtravel.ae', annualRevenue: 8500000, employeeCount: 550, openDeals: 7, totalContacts: 24, assignedTo: 'Tom Bradley', tags: ['Enterprise', 'ME'], createdAt: new Date('2023-03-15'), updatedAt: new Date() },
  { id: 3, name: 'Voyageur Paris', industry: 'Leisure Travel', phone: '+33 1 23 45 67 89', email: 'contact@voyageur.fr', website: 'www.voyageur.fr', annualRevenue: 1200000, employeeCount: 90, openDeals: 2, totalContacts: 6, assignedTo: 'Emma Johnson', tags: ['SMB', 'EU'], createdAt: new Date('2023-09-10'), updatedAt: new Date() },
  { id: 4, name: 'SinoTravel Group', industry: 'Travel & Tourism', phone: '+86 10 8800 8800', email: 'biz@sinotravel.cn', website: 'www.sinotravel.cn', annualRevenue: 15000000, employeeCount: 1200, openDeals: 9, totalContacts: 38, assignedTo: 'Emma Johnson', tags: ['Enterprise', 'APAC'], createdAt: new Date('2022-11-20'), updatedAt: new Date() },
  { id: 5, name: 'Nordic Voyage', industry: 'Leisure Travel', phone: '+45 33 12 34 56', email: 'hello@nordicvoyage.dk', website: 'www.nordicvoyage.dk', annualRevenue: 980000, employeeCount: 60, openDeals: 1, totalContacts: 4, assignedTo: 'Sarah Mitchell', tags: ['SMB', 'EU'], createdAt: new Date('2024-01-08'), updatedAt: new Date() },
  { id: 6, name: 'Horizons Ltd', industry: 'Corporate Travel', phone: '+91 22 4000 4000', email: 'contact@horizons.in', website: 'www.horizons.in', annualRevenue: 5200000, employeeCount: 410, openDeals: 6, totalContacts: 20, assignedTo: 'Tom Bradley', tags: ['Enterprise', 'APAC'], createdAt: new Date('2023-04-22'), updatedAt: new Date() },
  { id: 7, name: 'Afrika Treks', industry: 'Travel & Tourism', phone: '+27 11 234 5678', email: 'info@afrikatreks.co', website: 'www.afrikatreks.co', annualRevenue: 450000, employeeCount: 35, openDeals: 1, totalContacts: 3, assignedTo: 'Tom Bradley', tags: ['Startup', 'Africa'], createdAt: new Date('2024-03-15'), updatedAt: new Date() },
  { id: 8, name: 'TravelBiz Mexico', industry: 'Travel & Tourism', phone: '+52 55 5000 5000', email: 'ops@travelbiz.mx', website: 'www.travelbiz.mx', annualRevenue: 1800000, employeeCount: 140, openDeals: 3, totalContacts: 9, assignedTo: 'Sarah Mitchell', tags: ['Mid-Market', 'Americas'], createdAt: new Date('2023-07-30'), updatedAt: new Date() },
];

@Component({
  selector: 'app-company-list',
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
          <h2>Companies</h2>
          <span class="subtitle">Manage accounts and business relationships</span>
        </div>
        <div class="page-actions">
          <button mat-stroked-button class="mr-2">
            <i-tabler name="download" class="icon-sm mr-1"></i-tabler> Export
          </button>
          <button mat-flat-button color="primary">
            <i-tabler name="plus" class="icon-sm mr-1"></i-tabler> Add Company
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
              <mat-label>Search companies…</mat-label>
              <input matInput (keyup)="applyFilter($event)" placeholder="Company name, email">
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>
            <mat-form-field appearance="outline" class="filter-select">
              <mat-label>Industry</mat-label>
              <mat-select [(ngModel)]="industryFilter" (ngModelChange)="filterChanged()">
                <mat-option value="">All Industries</mat-option>
                <mat-option *ngFor="let i of industries" [value]="i">{{ i }}</mat-option>
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
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Company</th>
                <td mat-cell *matCellDef="let row">
                  <div class="company-cell">
                    <div class="company-logo" [style.background]="getColor(row.name)">
                      {{ row.name[0] }}
                    </div>
                    <div>
                      <strong>{{ row.name }}</strong>
                      <div class="sub-text">{{ row.website }}</div>
                    </div>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="industry">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Industry</th>
                <td mat-cell *matCellDef="let row">{{ row.industry }}</td>
              </ng-container>

              <ng-container matColumnDef="totalContacts">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Contacts</th>
                <td mat-cell *matCellDef="let row">
                  <span class="badge">{{ row.totalContacts }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="openDeals">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Open Deals</th>
                <td mat-cell *matCellDef="let row">
                  <span class="badge badge-primary">{{ row.openDeals }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="annualRevenue">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Annual Revenue</th>
                <td mat-cell *matCellDef="let row">
                  <strong>{{ row.annualRevenue | currency:'USD':'symbol':'1.0-0' }}</strong>
                </td>
              </ng-container>

              <ng-container matColumnDef="employeeCount">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Employees</th>
                <td mat-cell *matCellDef="let row">{{ row.employeeCount | number }}</td>
              </ng-container>

              <ng-container matColumnDef="assignedTo">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Account Owner</th>
                <td mat-cell *matCellDef="let row">{{ row.assignedTo }}</td>
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
    .kpi-value { font-size: 24px; font-weight: 700; }
    .kpi-label { font-size: 13px; color: #6c757d; }
    .filter-card { margin-bottom: 20px; }
    .filter-card mat-card-content { padding: 16px; }
    .filter-row { display: flex; gap: 16px; flex-wrap: wrap; }
    .filter-search { flex: 1; min-width: 200px; }
    .filter-select { width: 200px; }
    .table-card mat-card-content { padding: 0; }
    .table-wrapper { overflow-x: auto; }
    .crm-table { width: 100%; }
    .company-cell { display: flex; align-items: center; gap: 12px; padding: 8px 0; }
    .company-logo { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; color: white; flex-shrink: 0; }
    .sub-text { font-size: 12px; color: #6c757d; }
    .badge { padding: 3px 8px; border-radius: 12px; background: #f0f0f0; font-size: 13px; }
    .badge-primary { background: #e8f0fe; color: #1a73e8; }
    .text-error { color: #dc3545; }
    .mr-1 { margin-right: 4px; }
    .mr-2 { margin-right: 8px; }
    .table-row:hover { background: rgba(0,0,0,0.02); }
    .icon-xs { font-size: 14px; width: 14px; height: 14px; }
    .icon-sm { font-size: 18px; width: 18px; height: 18px; }
    .icon-md { font-size: 24px; width: 24px; height: 24px; }
  `],
})
export class CompanyListComponent implements OnInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns = ['name', 'industry', 'totalContacts', 'openDeals', 'annualRevenue', 'employeeCount', 'assignedTo', 'actions'];
  dataSource = new MatTableDataSource<Company>(MOCK_COMPANIES);

  industryFilter = '';
  industries: CompanyIndustry[] = ['Travel & Tourism', 'Hospitality', 'Aviation', 'Corporate Travel', 'Leisure Travel', 'Technology', 'Finance'];

  kpis = [
    { label: 'Total Companies', value: 142, icon: 'building', color: '#1a73e8', bg: '#e8f0fe' },
    { label: 'Active Deals', value: 33, icon: 'briefcase', color: '#0d9488', bg: '#ccfbf1' },
    { label: 'Total Revenue', value: '$35.5M', icon: 'currency-dollar', color: '#7c3aed', bg: '#ede9fe' },
    { label: 'Enterprise Accounts', value: 28, icon: 'crown', color: '#ea580c', bg: '#ffedd5' },
  ];

  ngOnInit() {}

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  applyFilter(event: Event) {
    const value = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.dataSource.filter = value;
  }

  filterChanged() {
    this.dataSource.filterPredicate = (data: Company) => !this.industryFilter || data.industry === this.industryFilter;
    this.dataSource.filter = this.industryFilter || ' ';
  }

  getColor(name: string) {
    const colors = ['#1a73e8', '#0d9488', '#7c3aed', '#ea580c', '#db2777', '#16a34a', '#b45309', '#0369a1'];
    return colors[name.charCodeAt(0) % colors.length];
  }
}
