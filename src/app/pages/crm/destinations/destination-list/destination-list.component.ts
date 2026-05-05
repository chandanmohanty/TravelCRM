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
import { Destination } from '../../../../core/models/crm.models';

const MOCK_DESTINATIONS: Destination[] = [
  { id: 1, name: 'Paris', country: 'France', region: 'Western Europe', continent: 'Europe', description: 'The City of Light, famous for the Eiffel Tower, world-class cuisine and fashion.', popularityScore: 98, activePackages: 14, averageRating: 4.8, bestTimeToVisit: 'Apr–Jun, Sep–Nov', currency: 'EUR', language: 'French', visaRequired: false, tags: ['Romantic', 'Culture', 'Fashion'], isActive: true, createdAt: new Date('2022-01-01') },
  { id: 2, name: 'Bali', country: 'Indonesia', region: 'Southeast Asia', continent: 'Asia', description: 'Island of the Gods, with lush rice paddies, temples, and vibrant nightlife.', popularityScore: 94, activePackages: 21, averageRating: 4.7, bestTimeToVisit: 'Apr–Oct', currency: 'IDR', language: 'Bahasa', visaRequired: true, tags: ['Adventure', 'Beach', 'Spiritual'], isActive: true, createdAt: new Date('2022-01-01') },
  { id: 3, name: 'Tokyo', country: 'Japan', region: 'East Asia', continent: 'Asia', description: 'Ultramodern meets traditional in Japan\'s bustling capital.', popularityScore: 96, activePackages: 18, averageRating: 4.9, bestTimeToVisit: 'Mar–May, Oct–Nov', currency: 'JPY', language: 'Japanese', visaRequired: true, tags: ['Cultural', 'Food', 'Technology'], isActive: true, createdAt: new Date('2022-01-01') },
  { id: 4, name: 'Maldives', country: 'Maldives', region: 'South Asia', continent: 'Asia', description: 'Stunning overwater bungalows and crystal-clear lagoons in the Indian Ocean.', popularityScore: 91, activePackages: 8, averageRating: 5.0, bestTimeToVisit: 'Nov–Apr', currency: 'MVR', language: 'Dhivehi', visaRequired: false, tags: ['Luxury', 'Beach', 'Diving'], isActive: true, createdAt: new Date('2022-01-01') },
  { id: 5, name: 'Santorini', country: 'Greece', region: 'Southern Europe', continent: 'Europe', description: 'Famous white-washed buildings, dramatic caldera views and breathtaking sunsets.', popularityScore: 89, activePackages: 11, averageRating: 4.8, bestTimeToVisit: 'Apr–Oct', currency: 'EUR', language: 'Greek', visaRequired: false, tags: ['Romantic', 'Beach', 'Culture'], isActive: true, createdAt: new Date('2022-01-01') },
  { id: 6, name: 'Tanzania', country: 'Tanzania', region: 'East Africa', continent: 'Africa', description: 'Home to the Serengeti, Kilimanjaro, and incredible wildlife experiences.', popularityScore: 85, activePackages: 9, averageRating: 4.9, bestTimeToVisit: 'Jun–Oct', currency: 'TZS', language: 'Swahili', visaRequired: true, tags: ['Safari', 'Adventure', 'Wildlife'], isActive: true, createdAt: new Date('2022-01-01') },
  { id: 7, name: 'Cancún', country: 'Mexico', region: 'Caribbean', continent: 'Americas', description: 'White sand beaches, ancient Mayan ruins, and vibrant resort culture.', popularityScore: 87, activePackages: 16, averageRating: 4.4, bestTimeToVisit: 'Dec–Apr', currency: 'MXN', language: 'Spanish', visaRequired: false, tags: ['Beach', 'Family', 'All-Inclusive'], isActive: true, createdAt: new Date('2022-01-01') },
  { id: 8, name: 'Norway', country: 'Norway', region: 'Northern Europe', continent: 'Europe', description: 'Dramatic fjords, the Northern Lights and pristine arctic wilderness.', popularityScore: 82, activePackages: 7, averageRating: 4.6, bestTimeToVisit: 'Sep–Mar', currency: 'NOK', language: 'Norwegian', visaRequired: false, tags: ['Aurora', 'Adventure', 'Nature'], isActive: true, createdAt: new Date('2022-01-01') },
];

@Component({
  selector: 'app-destination-list',
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
          <h2>Destinations</h2>
          <span class="subtitle">Manage travel destinations in your catalog</span>
        </div>
        <div class="page-actions">
          <button mat-stroked-button class="mr-2">
            <i-tabler name="download" class="icon-sm mr-1"></i-tabler> Export
          </button>
          <button mat-flat-button color="primary">
            <i-tabler name="plus" class="icon-sm mr-1"></i-tabler> Add Destination
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
              <mat-label>Search destinations…</mat-label>
              <input matInput (keyup)="applyFilter($event)" placeholder="Destination, country, region">
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>
            <mat-form-field appearance="outline" class="filter-select">
              <mat-label>Continent</mat-label>
              <mat-select [(ngModel)]="continentFilter" (ngModelChange)="filterChanged()">
                <mat-option value="">All</mat-option>
                <mat-option *ngFor="let c of continents" [value]="c">{{ c }}</mat-option>
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
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Destination</th>
                <td mat-cell *matCellDef="let row">
                  <div class="dest-cell">
                    <div class="dest-icon">
                      <i-tabler name="map-pin" class="icon-sm text-primary"></i-tabler>
                    </div>
                    <div>
                      <strong>{{ row.name }}</strong>
                      <div class="sub-text">{{ row.country }} · {{ row.region }}</div>
                    </div>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="continent">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Continent</th>
                <td mat-cell *matCellDef="let row">{{ row.continent }}</td>
              </ng-container>

              <ng-container matColumnDef="activePackages">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Packages</th>
                <td mat-cell *matCellDef="let row"><span class="badge">{{ row.activePackages }}</span></td>
              </ng-container>

              <ng-container matColumnDef="popularityScore">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Popularity</th>
                <td mat-cell *matCellDef="let row">
                  <div class="pop-cell">
                    <div class="pop-bar"><div class="pop-fill" [style.width.%]="row.popularityScore"></div></div>
                    <span>{{ row.popularityScore }}</span>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="averageRating">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Rating</th>
                <td mat-cell *matCellDef="let row">
                  <span class="rating"><i-tabler name="star-filled" class="icon-xs text-warning"></i-tabler> {{ row.averageRating }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="bestTimeToVisit">
                <th mat-header-cell *matHeaderCellDef>Best Season</th>
                <td mat-cell *matCellDef="let row">{{ row.bestTimeToVisit }}</td>
              </ng-container>

              <ng-container matColumnDef="visaRequired">
                <th mat-header-cell *matHeaderCellDef>Visa</th>
                <td mat-cell *matCellDef="let row">
                  <span [ngClass]="row.visaRequired ? 'visa-required' : 'visa-free'">
                    {{ row.visaRequired ? 'Required' : 'Visa Free' }}
                  </span>
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
                    <button mat-menu-item><i-tabler name="package" class="icon-xs mr-1"></i-tabler> View Packages</button>
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
    .dest-cell { display: flex; align-items: center; gap: 10px; padding: 8px 0; }
    .dest-icon { width: 36px; height: 36px; border-radius: 8px; background: #e8f0fe; display: flex; align-items: center; justify-content: center; }
    .sub-text { font-size: 12px; color: #6c757d; }
    .badge { padding: 3px 10px; border-radius: 12px; background: #e8f0fe; color: #1a73e8; font-size: 13px; font-weight: 600; }
    .pop-cell { display: flex; align-items: center; gap: 8px; min-width: 100px; }
    .pop-bar { height: 6px; flex: 1; background: #e9ecef; border-radius: 3px; overflow: hidden; }
    .pop-fill { height: 100%; background: #1a73e8; border-radius: 3px; }
    .rating { display: flex; align-items: center; gap: 4px; font-weight: 700; }
    .visa-required { padding: 3px 8px; border-radius: 12px; background: #fce4ec; color: #c62828; font-size: 12px; }
    .visa-free { padding: 3px 8px; border-radius: 12px; background: #e8f5e9; color: #2e7d32; font-size: 12px; }
    .text-primary { color: #1a73e8; }
    .text-warning { color: #fd7e14; }
    .text-error { color: #dc3545; }
    .mr-1 { margin-right: 4px; }
    .mr-2 { margin-right: 8px; }
    .table-row:hover { background: rgba(0,0,0,0.02); }
    .icon-xs { font-size: 14px; width: 14px; height: 14px; }
    .icon-sm { font-size: 18px; width: 18px; height: 18px; }
    .icon-md { font-size: 24px; width: 24px; height: 24px; }
  `],
})
export class DestinationListComponent implements OnInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns = ['name', 'continent', 'activePackages', 'popularityScore', 'averageRating', 'bestTimeToVisit', 'visaRequired', 'isActive', 'actions'];
  dataSource = new MatTableDataSource<Destination>(MOCK_DESTINATIONS);

  continentFilter = '';
  continents = ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania'];

  kpis = [
    { label: 'Total Destinations', value: 52, icon: 'world', color: '#1a73e8', bg: '#e8f0fe' },
    { label: 'Active', value: 48, icon: 'map-pin', color: '#16a34a', bg: '#dcfce7' },
    { label: 'Continents', value: 6, icon: 'globe', color: '#7c3aed', bg: '#ede9fe' },
    { label: 'Top Rated', value: 14, icon: 'star', color: '#ea580c', bg: '#ffedd5' },
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
    this.dataSource.filterPredicate = (data) => !this.continentFilter || data.continent === this.continentFilter;
    this.dataSource.filter = this.continentFilter || ' ';
  }
}
