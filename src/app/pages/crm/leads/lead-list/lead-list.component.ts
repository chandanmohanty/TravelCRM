import {
  Component, ChangeDetectionStrategy, inject, OnInit, signal,
  computed, ViewChild, AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SidePanelService } from '../../../../shared/side-panel';
import { LeadFormComponent } from '../lead-form/lead-form.component';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TablerIconsModule } from 'angular-tabler-icons';
import { LeadsService, LeadDto } from '../../../../core/services/leads.service';
import { LeadStatus, LeadSource } from '../../../../core/models/crm.models';

@Component({
  selector: 'app-lead-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterModule, FormsModule,
    MatTableModule, MatPaginatorModule, MatSortModule,
    MatInputModule, MatFormFieldModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatChipsModule,
    MatTooltipModule, MatMenuModule, MatProgressBarModule,
    MatProgressSpinnerModule, MatCardModule, MatSnackBarModule,
    TablerIconsModule,
  ],
  template: `
    <div class="crm-page">
      <div class="page-header">
        <div class="page-title">
          <h2>Leads</h2>
          <span class="subtitle">Track and manage potential customers</span>
        </div>
        <div class="page-actions">
          <button mat-flat-button color="primary" (click)="openForm()">
            <i-tabler name="plus" class="icon-sm mr-1"></i-tabler> Add Lead
          </button>
        </div>
      </div>

      <!-- KPI Cards -->
      <div class="kpi-grid">
        <mat-card class="kpi-card">
          <mat-card-content>
            <div class="kpi-inner">
              <div class="kpi-icon" style="background:#e8f0fe">
                <i-tabler name="users" style="color:#1a73e8" class="icon-md"></i-tabler>
              </div>
              <div class="kpi-data">
                <span class="kpi-value">{{ totalLeads() }}</span>
                <span class="kpi-label">Total Leads</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="kpi-card">
          <mat-card-content>
            <div class="kpi-inner">
              <div class="kpi-icon" style="background:#ccfbf1">
                <i-tabler name="user-plus" style="color:#0d9488" class="icon-md"></i-tabler>
              </div>
              <div class="kpi-data">
                <span class="kpi-value">{{ newLeads() }}</span>
                <span class="kpi-label">New</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="kpi-card">
          <mat-card-content>
            <div class="kpi-inner">
              <div class="kpi-icon" style="background:#ede9fe">
                <i-tabler name="check-circle" style="color:#7c3aed" class="icon-md"></i-tabler>
              </div>
              <div class="kpi-data">
                <span class="kpi-value">{{ qualifiedLeads() }}</span>
                <span class="kpi-label">Qualified</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="kpi-card">
          <mat-card-content>
            <div class="kpi-inner">
              <div class="kpi-icon" style="background:#ffedd5">
                <i-tabler name="arrow-right-circle" style="color:#ea580c" class="icon-md"></i-tabler>
              </div>
              <div class="kpi-data">
                <span class="kpi-value">{{ convertedLeads() }}</span>
                <span class="kpi-label">Converted</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="40"></mat-spinner></div>
      }

      @if (!loading()) {
        <mat-card class="filter-card">
          <mat-card-content>
            <div class="filter-row">
              <mat-form-field appearance="outline" class="filter-search">
                <mat-label>Search leads</mat-label>
                <input matInput (keyup)="applyFilter($event)" placeholder="Name, email, company">
                <mat-icon matSuffix>search</mat-icon>
              </mat-form-field>
              <mat-form-field appearance="outline" class="filter-select">
                <mat-label>Status</mat-label>
                <mat-select [(ngModel)]="statusFilter" (ngModelChange)="filterByDropdown()">
                  <mat-option value="">All</mat-option>
                  <mat-option *ngFor="let s of statuses" [value]="s">{{ s }}</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline" class="filter-select">
                <mat-label>Source</mat-label>
                <mat-select [(ngModel)]="sourceFilter" (ngModelChange)="filterByDropdown()">
                  <mat-option value="">All</mat-option>
                  <mat-option *ngFor="let s of sources" [value]="s">{{ s }}</mat-option>
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
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>Name</th>
                  <td mat-cell *matCellDef="let row">
                    <div class="lead-name">
                      <div class="avatar" [style.background]="getAvatarColor(row.firstName)">
                        {{ row.firstName[0] }}{{ row.lastName[0] }}
                      </div>
                      <div>
                        <strong>{{ row.firstName }} {{ row.lastName }}</strong>
                        <div class="sub-text">{{ row.jobTitle }}</div>
                      </div>
                    </div>
                  </td>
                </ng-container>
                <ng-container matColumnDef="company">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>Company</th>
                  <td mat-cell *matCellDef="let row">
                    <div class="company-cell">
                      <i-tabler name="building" class="icon-xs text-muted mr-1"></i-tabler>
                      {{ row.company }}
                    </div>
                  </td>
                </ng-container>
                <ng-container matColumnDef="status">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>Status</th>
                  <td mat-cell *matCellDef="let row">
                    <span class="status-badge" [ngClass]="getStatusClass(row.status)">{{ row.status }}</span>
                  </td>
                </ng-container>
                <ng-container matColumnDef="score">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>Score</th>
                  <td mat-cell *matCellDef="let row">
                    <div class="score-cell">
                      <span class="score-num" [ngClass]="getScoreClass(row.score)">{{ row.score }}</span>
                      <mat-progress-bar mode="determinate" [value]="row.score"
                        [ngClass]="getScoreBarClass(row.score)" class="score-bar"></mat-progress-bar>
                    </div>
                  </td>
                </ng-container>
                <ng-container matColumnDef="source">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>Source</th>
                  <td mat-cell *matCellDef="let row">{{ row.source }}</td>
                </ng-container>
                <ng-container matColumnDef="estimatedValue">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>Est. Value</th>
                  <td mat-cell *matCellDef="let row">
                    <strong>{{ row.estimatedValue | currency:'USD':'symbol':'1.0-0' }}</strong>
                  </td>
                </ng-container>
                <ng-container matColumnDef="assignedTo">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>Assigned To</th>
                  <td mat-cell *matCellDef="let row">{{ row.assignedTo }}</td>
                </ng-container>
                <ng-container matColumnDef="createdAt">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>Created</th>
                  <td mat-cell *matCellDef="let row">{{ row.createdAt | date:'mediumDate' }}</td>
                </ng-container>
                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef></th>
                  <td mat-cell *matCellDef="let row">
                    <button mat-icon-button [matMenuTriggerFor]="menu">
                      <i-tabler name="dots-vertical" class="icon-sm"></i-tabler>
                    </button>
                    <mat-menu #menu="matMenu">
                      <button mat-menu-item (click)="openForm(row)">
                        <i-tabler name="edit" class="icon-xs mr-1"></i-tabler> Edit
                      </button>
                      <button mat-menu-item (click)="convertLead(row)"
                              [disabled]="row.status === 'Converted' || row.status === 'Unqualified'">
                        <i-tabler name="arrow-right" class="icon-xs mr-1"></i-tabler> Convert
                      </button>
                      <button mat-menu-item (click)="deleteLead(row)"
                              [disabled]="row.status === 'Converted'"
                              class="text-error">
                        <i-tabler name="trash" class="icon-xs mr-1"></i-tabler> Delete
                      </button>
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
      }
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
    .kpi-value { font-size: 24px; font-weight: 700; line-height: 1; }
    .kpi-label { font-size: 13px; color: #6c757d; margin-top: 4px; }
    .loading-center { display: flex; justify-content: center; padding: 40px; }
    .filter-card { margin-bottom: 20px; }
    .filter-card mat-card-content { padding: 16px; }
    .filter-row { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
    .filter-search { flex: 1; min-width: 200px; }
    .filter-select { width: 160px; }
    .table-card mat-card-content { padding: 0; }
    .table-wrapper { overflow-x: auto; }
    .crm-table { width: 100%; }
    .lead-name { display: flex; align-items: center; gap: 10px; padding: 8px 0; }
    .avatar { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; color: white; flex-shrink: 0; }
    .sub-text { font-size: 12px; color: #6c757d; }
    .company-cell { display: flex; align-items: center; }
    .text-muted { color: #6c757d; }
    .mr-1 { margin-right: 4px; }
    .status-badge { padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .status-new { background: #e3f2fd; color: #1565c0; }
    .status-contacted { background: #fff3e0; color: #e65100; }
    .status-qualified { background: #e8f5e9; color: #2e7d32; }
    .status-unqualified { background: #fce4ec; color: #c62828; }
    .status-converted { background: #f3e5f5; color: #6a1b9a; }
    .score-cell { display: flex; flex-direction: column; gap: 4px; min-width: 80px; }
    .score-num { font-weight: 700; font-size: 14px; }
    .score-bar { height: 4px; border-radius: 2px; }
    .score-high { color: #28a745; }
    .score-mid { color: #fd7e14; }
    .score-low { color: #dc3545; }
    .text-error { color: #dc3545; }
    .table-row:hover { background: rgba(0,0,0,0.02); cursor: pointer; }
    .icon-xs { font-size: 14px; width: 14px; height: 14px; }
    .icon-sm { font-size: 18px; width: 18px; height: 18px; }
    .icon-md { font-size: 24px; width: 24px; height: 24px; }
    @media (max-width: 768px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
  `],
})
export class LeadListComponent implements OnInit, AfterViewInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort)      sort!: MatSort;

  private readonly api       = inject(LeadsService);
  private readonly snack     = inject(MatSnackBar);
  private readonly sidePanel = inject(SidePanelService);

  readonly loading        = signal(true);
  private readonly leads$ = signal<LeadDto[]>([]);

  readonly totalLeads     = computed(() => this.leads$().length);
  readonly newLeads       = computed(() => this.leads$().filter(l => l.status === 'New').length);
  readonly qualifiedLeads = computed(() => this.leads$().filter(l => l.status === 'Qualified').length);
  readonly convertedLeads = computed(() => this.leads$().filter(l => l.status === 'Converted').length);

  displayedColumns = ['name','company','status','score','source','estimatedValue','assignedTo','createdAt','actions'];
  dataSource = new MatTableDataSource<LeadDto>([]);

  statusFilter = '';
  sourceFilter = '';

  statuses: LeadStatus[] = ['New','Contacted','Qualified','Unqualified','Converted'];
  sources: LeadSource[]  = ['Website','Referral','Social Media','Email Campaign','Trade Show','Cold Call','Partner','Other'];

  ngOnInit(): void { this.load(); }

  openForm(lead?: LeadDto): void {
    const ref = this.sidePanel.open<LeadFormComponent, { id?: string }, 'saved' | 'cancelled'>(
      LeadFormComponent,
      {
        title:    lead ? 'Edit Lead' : 'New Lead',
        subtitle: lead ? `${lead.firstName} ${lead.lastName}` : 'Capture a new prospect',
        width:    '560px',
        data:     { id: lead?.id },
      },
    );
    ref.afterClosed().subscribe((result) => {
      if (result === 'saved') this.load();
    });
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort      = this.sort;
    this.dataSource.filterPredicate = (data: LeadDto, filter: string) => {
      const f = JSON.parse(filter || '{}');
      const t = f.text || '';
      return (!t || `${data.firstName} ${data.lastName} ${data.email} ${data.company}`.toLowerCase().includes(t))
          && (!f.status || data.status === f.status)
          && (!f.source || data.source === f.source);
    };
  }

  private load(): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: rows => {
        this.leads$.set(rows);
        this.dataSource.data = rows;
        this.loading.set(false);
      },
      error: () => {
        this.snack.open('Failed to load leads.', 'Close', { duration: 3500 });
        this.loading.set(false);
      },
    });
  }

  applyFilter(e: Event): void {
    const text = (e.target as HTMLInputElement).value.trim().toLowerCase();
    this.dataSource.filter = JSON.stringify({ text, status: this.statusFilter, source: this.sourceFilter });
  }

  filterByDropdown(): void {
    this.dataSource.filter = JSON.stringify({ text: '', status: this.statusFilter, source: this.sourceFilter });
  }

  convertLead(row: LeadDto): void {
    if (!confirm(`Convert "${row.firstName} ${row.lastName}" to a customer?`)) return;
    this.api.convert(row.id).subscribe({
      next: updated => {
        this.snack.open('Lead converted.', 'Close', { duration: 2500 });
        const next = this.dataSource.data.map(l => l.id === updated.id ? updated : l);
        this.dataSource.data = next;
        this.leads$.set(next);
      },
      error: err => this.snack.open(err?.error?.error ?? 'Convert failed.', 'Close', { duration: 3500 }),
    });
  }

  deleteLead(row: LeadDto): void {
    if (!confirm(`Delete "${row.firstName} ${row.lastName}"?`)) return;
    this.api.delete(row.id).subscribe({
      next: () => {
        this.snack.open('Lead deleted.', 'Close', { duration: 2500 });
        const next = this.dataSource.data.filter(l => l.id !== row.id);
        this.dataSource.data = next;
        this.leads$.set(next);
      },
      error: err => this.snack.open(err?.error?.error ?? 'Delete failed.', 'Close', { duration: 3500 }),
    });
  }

  getStatusClass(s: string) {
    return {
      'status-new': s==='New', 'status-contacted': s==='Contacted',
      'status-qualified': s==='Qualified', 'status-unqualified': s==='Unqualified',
      'status-converted': s==='Converted',
    };
  }
  getScoreClass(n: number)    { return n>=75 ? 'score-high' : n>=50 ? 'score-mid' : 'score-low'; }
  getScoreBarClass(n: number) { return n>=75 ? 'bar-success' : n>=50 ? 'bar-warn' : 'bar-danger'; }
  getAvatarColor(name: string) {
    const c = ['#1a73e8','#0d9488','#7c3aed','#ea580c','#db2777','#16a34a'];
    return c[(name?.charCodeAt(0) ?? 0) % c.length];
  }
}
