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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCardModule } from '@angular/material/card';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TravelPackage, PackageCategory } from '../../../../core/models/crm.models';

const MOCK_PACKAGES: TravelPackage[] = [
  { id: 1, name: 'Paris Romantic Escape', destinationId: 1, destinationName: 'Paris, France', category: 'Honeymoon', durationDays: 7, durationNights: 6, pricePerPerson: 3400, currency: 'USD', maxGroupSize: 2, availableSlots: 2, rating: 4.9, reviewCount: 128, highlights: ['Eiffel Tower', 'Louvre', 'Seine Cruise'], inclusions: ['Flights', 'Hotel', 'Breakfast'], exclusions: ['Dinner', 'Personal expenses'], supplierId: 1, supplierName: 'EuroLux Hotels', isActive: true, createdAt: new Date('2023-01-15'), updatedAt: new Date() },
  { id: 2, name: 'Bali Adventure Bliss', destinationId: 2, destinationName: 'Bali, Indonesia', category: 'Adventure', durationDays: 10, durationNights: 9, pricePerPerson: 2100, currency: 'USD', maxGroupSize: 12, availableSlots: 8, rating: 4.7, reviewCount: 214, highlights: ['Ubud Rice Terraces', 'Temples', 'Surfing'], inclusions: ['Hotel', 'Breakfast', 'Activities'], exclusions: ['Flights', 'Visa'], supplierId: 2, supplierName: 'BaliResorts Co.', isActive: true, createdAt: new Date('2023-03-10'), updatedAt: new Date() },
  { id: 3, name: 'Japan Cherry Blossom Tour', destinationId: 3, destinationName: 'Tokyo, Japan', category: 'Cultural', durationDays: 9, durationNights: 8, pricePerPerson: 4200, currency: 'USD', maxGroupSize: 16, availableSlots: 12, rating: 4.8, reviewCount: 89, highlights: ['Mt. Fuji', 'Kyoto Temples', 'Shinkansen'], inclusions: ['Flights', 'Hotel', 'All Meals', 'Guide'], exclusions: ['Personal shopping'], supplierId: 3, supplierName: 'Japan Travel Co.', isActive: true, createdAt: new Date('2023-05-20'), updatedAt: new Date() },
  { id: 4, name: 'Maldives Luxury All-Inclusive', destinationId: 5, destinationName: 'Maldives', category: 'Luxury', durationDays: 10, durationNights: 9, pricePerPerson: 7000, currency: 'USD', maxGroupSize: 2, availableSlots: 2, rating: 5.0, reviewCount: 67, highlights: ['Overwater Bungalow', 'Snorkeling', 'Spa'], inclusions: ['All Meals', 'Activities', 'Seaplane'], exclusions: ['Flights to Malé'], supplierId: 4, supplierName: 'Maldives Resorts', isActive: true, createdAt: new Date('2023-02-28'), updatedAt: new Date() },
  { id: 5, name: 'Serengeti Safari Adventure', destinationId: 13, destinationName: 'Tanzania', category: 'Adventure', durationDays: 8, durationNights: 7, pricePerPerson: 5800, currency: 'USD', maxGroupSize: 8, availableSlots: 4, rating: 4.9, reviewCount: 45, highlights: ['Big Five', 'Wildebeest Migration', 'Maasai Culture'], inclusions: ['Lodge', 'All Meals', 'Game Drives', 'Park Fees'], exclusions: ['International Flights'], supplierId: 5, supplierName: 'Safari World', isActive: true, createdAt: new Date('2023-06-15'), updatedAt: new Date() },
  { id: 6, name: 'Northern Lights Arctic Tour', destinationId: 15, destinationName: 'Norway', category: 'Adventure', durationDays: 7, durationNights: 6, pricePerPerson: 4100, currency: 'USD', maxGroupSize: 10, availableSlots: 6, rating: 4.6, reviewCount: 72, highlights: ['Aurora Borealis', 'Fjords', 'Dog Sledding'], inclusions: ['Hotel', 'Breakfast', 'Activities', 'Local Transport'], exclusions: ['International Flights'], supplierId: 6, supplierName: 'Nordic Tours', isActive: true, createdAt: new Date('2023-07-01'), updatedAt: new Date() },
  { id: 7, name: 'Cancún Family Beach Resort', destinationId: 11, destinationName: 'Cancún, Mexico', category: 'Family', durationDays: 7, durationNights: 6, pricePerPerson: 1800, currency: 'USD', maxGroupSize: 20, availableSlots: 14, rating: 4.4, reviewCount: 156, highlights: ['All-Inclusive Resort', 'Water Park', 'Cenotes'], inclusions: ['All Meals', 'Hotel', 'Kids Club'], exclusions: ['Flights', 'Tours outside resort'], supplierId: 7, supplierName: 'Cancún Vacations', isActive: true, createdAt: new Date('2023-04-12'), updatedAt: new Date() },
  { id: 8, name: 'Santorini Honeymoon Suite', destinationId: 7, destinationName: 'Santorini, Greece', category: 'Honeymoon', durationDays: 7, durationNights: 6, pricePerPerson: 4750, currency: 'USD', maxGroupSize: 2, availableSlots: 2, rating: 4.8, reviewCount: 93, highlights: ['Caldera Views', 'Wine Tours', 'Sunset Dinner'], inclusions: ['Cave Hotel', 'Breakfast', 'Wine Tour'], exclusions: ['Flights', 'Lunch/Dinner'], supplierId: 8, supplierName: 'Greek Islands Tours', isActive: false, createdAt: new Date('2023-08-20'), updatedAt: new Date() },
];

@Component({
  selector: 'app-package-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatTableModule, MatPaginatorModule, MatSortModule,
    MatInputModule, MatFormFieldModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatMenuModule, MatChipsModule, MatSlideToggleModule,
    MatCardModule, TablerIconsModule,
  ],
  template: `
    <div class="crm-page">
      <div class="page-header">
        <div class="page-title">
          <h2>Travel Packages</h2>
          <span class="subtitle">Manage your travel product catalog</span>
        </div>
        <div class="page-actions">
          <button mat-stroked-button class="mr-2">
            <i-tabler name="download" class="icon-sm mr-1"></i-tabler> Export
          </button>
          <button mat-flat-button color="primary">
            <i-tabler name="plus" class="icon-sm mr-1"></i-tabler> New Package
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
              <mat-label>Search packages…</mat-label>
              <input matInput (keyup)="applyFilter($event)" placeholder="Package name, destination">
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>
            <mat-form-field appearance="outline" class="filter-select">
              <mat-label>Category</mat-label>
              <mat-select [(ngModel)]="categoryFilter" (ngModelChange)="filterChanged()">
                <mat-option value="">All Categories</mat-option>
                <mat-option *ngFor="let c of categories" [value]="c">{{ c }}</mat-option>
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
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Package</th>
                <td mat-cell *matCellDef="let row">
                  <div class="package-cell">
                    <div class="pkg-icon" [style.background]="getCatColor(row.category)">
                      <i-tabler [name]="getCatIcon(row.category)" class="icon-sm" style="color:white"></i-tabler>
                    </div>
                    <div>
                      <strong>{{ row.name }}</strong>
                      <div class="sub-text">{{ row.supplierName }}</div>
                    </div>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="destinationName">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Destination</th>
                <td mat-cell *matCellDef="let row">
                  <i-tabler name="map-pin" class="icon-xs text-primary mr-1"></i-tabler>{{ row.destinationName }}
                </td>
              </ng-container>

              <ng-container matColumnDef="category">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Category</th>
                <td mat-cell *matCellDef="let row">
                  <span class="cat-badge" [style.background]="getCatColor(row.category) + '22'" [style.color]="getCatColor(row.category)">{{ row.category }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="durationDays">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Duration</th>
                <td mat-cell *matCellDef="let row">{{ row.durationDays }}D / {{ row.durationNights }}N</td>
              </ng-container>

              <ng-container matColumnDef="pricePerPerson">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Price / Person</th>
                <td mat-cell *matCellDef="let row"><strong>{{ row.pricePerPerson | currency:'USD':'symbol':'1.0-0' }}</strong></td>
              </ng-container>

              <ng-container matColumnDef="availableSlots">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Slots Left</th>
                <td mat-cell *matCellDef="let row">
                  <span [ngClass]="row.availableSlots < 3 ? 'text-error' : 'text-success'">
                    {{ row.availableSlots }} / {{ row.maxGroupSize }}
                  </span>
                </td>
              </ng-container>

              <ng-container matColumnDef="rating">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Rating</th>
                <td mat-cell *matCellDef="let row">
                  <div class="rating-cell">
                    <i-tabler name="star-filled" class="icon-xs text-warning"></i-tabler>
                    <strong>{{ row.rating }}</strong>
                    <span class="text-muted">({{ row.reviewCount }})</span>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="isActive">
                <th mat-header-cell *matHeaderCellDef>Active</th>
                <td mat-cell *matCellDef="let row">
                  <mat-slide-toggle [checked]="row.isActive" color="primary" (change)="row.isActive = $event.checked"></mat-slide-toggle>
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
                    <button mat-menu-item><i-tabler name="copy" class="icon-xs mr-1"></i-tabler> Duplicate</button>
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
    .package-cell { display: flex; align-items: center; gap: 12px; padding: 8px 0; }
    .pkg-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .sub-text { font-size: 12px; color: #6c757d; }
    .cat-badge { padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .rating-cell { display: flex; align-items: center; gap: 4px; }
    .text-warning { color: #fd7e14; }
    .text-muted { color: #6c757d; }
    .text-primary { color: #1a73e8; }
    .text-success { color: #28a745; }
    .text-error { color: #dc3545; }
    .mr-1 { margin-right: 4px; }
    .mr-2 { margin-right: 8px; }
    .table-row:hover { background: rgba(0,0,0,0.02); }
    .icon-xs { font-size: 14px; width: 14px; height: 14px; }
    .icon-sm { font-size: 18px; width: 18px; height: 18px; }
    .icon-md { font-size: 24px; width: 24px; height: 24px; }
  `],
})
export class PackageListComponent implements OnInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns = ['name', 'destinationName', 'category', 'durationDays', 'pricePerPerson', 'availableSlots', 'rating', 'isActive', 'actions'];
  dataSource = new MatTableDataSource<TravelPackage>(MOCK_PACKAGES);

  categoryFilter = '';
  categories: PackageCategory[] = ['Adventure', 'Beach', 'Cultural', 'Honeymoon', 'Family', 'Business', 'Luxury', 'Budget'];

  kpis = [
    { label: 'Total Packages', value: 64, icon: 'package', color: '#1a73e8', bg: '#e8f0fe' },
    { label: 'Active Packages', value: 58, icon: 'check-circle', color: '#16a34a', bg: '#dcfce7' },
    { label: 'Avg. Rating', value: '4.7★', icon: 'star', color: '#ea580c', bg: '#ffedd5' },
    { label: 'Bookings (MTD)', value: 127, icon: 'calendar-check', color: '#7c3aed', bg: '#ede9fe' },
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
    this.dataSource.filterPredicate = (data) => !this.categoryFilter || data.category === this.categoryFilter;
    this.dataSource.filter = this.categoryFilter || ' ';
  }

  getCatColor(cat: PackageCategory): string {
    const map: Record<string, string> = {
      'Adventure': '#ea580c', 'Beach': '#0d9488', 'Cultural': '#7c3aed',
      'Honeymoon': '#db2777', 'Family': '#1a73e8', 'Business': '#374151',
      'Luxury': '#b45309', 'Budget': '#16a34a',
    };
    return map[cat] || '#6c757d';
  }

  getCatIcon(cat: PackageCategory): string {
    const map: Record<string, string> = {
      'Adventure': 'mountain', 'Beach': 'pool', 'Cultural': 'building-arch',
      'Honeymoon': 'heart', 'Family': 'users', 'Business': 'briefcase',
      'Luxury': 'crown', 'Budget': 'coins',
    };
    return map[cat] || 'package';
  }
}
