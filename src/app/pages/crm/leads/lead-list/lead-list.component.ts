import {
  Component, ChangeDetectionStrategy, inject, OnInit, signal,
  computed, ViewChild, AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SidePanelService } from '../../../../shared/side-panel';
import { LeadFormComponent } from '../lead-form/lead-form.component';
import { DealFormComponent } from '../../deals/deal-form/deal-form.component';
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
import { LeadsService, LeadDto, LeadListFilters } from '../../../../core/services/leads.service';
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
    <div class="ll-page">

      <!-- ── Header ───────────────────────────────── -->
      <div class="ll-header">
        <div>
          <h2 class="ll-title">Leads</h2>
          <p class="ll-sub">Track and manage potential customers</p>
        </div>
        <button mat-flat-button color="primary" class="ll-add-btn" (click)="openForm()">
          <i-tabler name="plus" class="ll-btn-icon"></i-tabler> Add Lead
        </button>
      </div>

      <!-- ── KPI strip ─────────────────────────────── -->
      <div class="ll-stats">
        <div class="ll-stat">
          <div class="ll-stat-icon" style="--c:#e8f0fe;--t:#1a73e8">
            <i-tabler name="users"></i-tabler>
          </div>
          <div class="ll-stat-body">
            <span class="ll-stat-num">{{ totalLeads() }}</span>
            <span class="ll-stat-lbl">Total Leads</span>
          </div>
        </div>
        <div class="ll-stat-sep"></div>
        <div class="ll-stat">
          <div class="ll-stat-icon" style="--c:#ccfbf1;--t:#0d9488">
            <i-tabler name="user-plus"></i-tabler>
          </div>
          <div class="ll-stat-body">
            <span class="ll-stat-num">{{ newLeads() }}</span>
            <span class="ll-stat-lbl">New</span>
          </div>
        </div>
        <div class="ll-stat-sep"></div>
        <div class="ll-stat">
          <div class="ll-stat-icon" style="--c:#ede9fe;--t:#7c3aed">
            <i-tabler name="rosette-discount-check"></i-tabler>
          </div>
          <div class="ll-stat-body">
            <span class="ll-stat-num">{{ qualifiedLeads() }}</span>
            <span class="ll-stat-lbl">Qualified</span>
          </div>
        </div>
        <div class="ll-stat-sep"></div>
        <div class="ll-stat">
          <div class="ll-stat-icon" style="--c:#ffedd5;--t:#ea580c">
            <i-tabler name="briefcase"></i-tabler>
          </div>
          <div class="ll-stat-body">
            <span class="ll-stat-num">{{ leadsWithDeals() }}</span>
            <span class="ll-stat-lbl">With Deals</span>
          </div>
        </div>
      </div>

      <!-- ── Loading ───────────────────────────────── -->
      @if (loading()) {
        <div class="ll-loading"><mat-spinner diameter="32"></mat-spinner></div>
      }

      <!-- ── Main card: filter toolbar + table ─────── -->
      @if (!loading()) {
        <div class="ll-card">

          <!-- filter toolbar -->
          <div class="ll-toolbar">
            <div class="ll-search-wrap">
              <i-tabler name="search" class="ll-search-icon"></i-tabler>
              <input class="ll-search-input" placeholder="Search by name, email or company…"
                     (keyup)="applyFilter($event)" />
            </div>
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="ll-filter-field">
              <mat-label>Status</mat-label>
              <mat-select [(ngModel)]="statusFilter" (ngModelChange)="filterByDropdown()">
                <mat-option value="">All</mat-option>
                <mat-option *ngFor="let s of statuses" [value]="s">{{ s }}</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="ll-filter-field">
              <mat-label>Source</mat-label>
              <mat-select [(ngModel)]="sourceFilter" (ngModelChange)="filterByDropdown()">
                <mat-option value="">All</mat-option>
                <mat-option *ngFor="let s of sources" [value]="s">{{ s }}</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="ll-filter-field">
              <mat-label>Has Deals</mat-label>
              <mat-select [(ngModel)]="hasDealsFilter" (ngModelChange)="onHasDealsChange()">
                <mat-option value="">All</mat-option>
                <mat-option value="true">With deals</mat-option>
                <mat-option value="false">Without deals</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <!-- table -->
          <div class="ll-table-wrap">
            <table mat-table [dataSource]="dataSource" matSort class="ll-table">

              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Name</th>
                <td mat-cell *matCellDef="let row">
                  <div class="ll-name-cell">
                    <div class="ll-avatar" [style.background]="getAvatarColor(row.firstName)">
                      {{ row.firstName[0] }}{{ row.lastName[0] }}
                    </div>
                    <div class="ll-name-text">
                      <div class="ll-name-row">
                        <span class="ll-name-primary">{{ row.firstName }} {{ row.lastName }}</span>
                        @if ((row.dealCount ?? 0) > 0) {
                          <span class="ll-deal-badge">
                            {{ row.dealCount }} {{ row.dealCount === 1 ? 'deal' : 'deals' }}
                          </span>
                        }
                      </div>
                      @if (row.jobTitle) {
                        <span class="ll-name-secondary">{{ row.jobTitle }}</span>
                      }
                    </div>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="company">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Company</th>
                <td mat-cell *matCellDef="let row">
                  <span class="ll-company">{{ row.company }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Status</th>
                <td mat-cell *matCellDef="let row">
                  <span class="ll-badge" [ngClass]="getStatusClass(row.status)">{{ row.status }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="score">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Score</th>
                <td mat-cell *matCellDef="let row">
                  <div class="ll-score">
                    <span class="ll-score-num" [ngClass]="getScoreClass(row.score)">{{ row.score }}</span>
                    <mat-progress-bar mode="determinate" [value]="row.score"
                      [ngClass]="getScoreBarClass(row.score)" class="ll-bar"></mat-progress-bar>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="source">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Source</th>
                <td mat-cell *matCellDef="let row">
                  <span class="ll-muted">{{ row.source }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="estimatedValue">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Est. Value</th>
                <td mat-cell *matCellDef="let row">
                  <span class="ll-value">{{ row.estimatedValue | currency:'USD':'symbol':'1.0-0' }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="assignedTo">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Assigned To</th>
                <td mat-cell *matCellDef="let row">
                  <span class="ll-muted">{{ row.assignedTo }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="createdAt">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Created</th>
                <td mat-cell *matCellDef="let row">
                  <span class="ll-muted">{{ row.createdAt | date:'d MMM y' }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let row" class="ll-actions-cell">
                  <button mat-icon-button class="ll-menu-btn" [matMenuTriggerFor]="menu"
                          matTooltip="Actions">
                    <i-tabler name="dots-vertical" class="ll-icon-sm"></i-tabler>
                  </button>
                  <mat-menu #menu="matMenu">
                    <button mat-menu-item (click)="openForm(row)">
                      <i-tabler name="pencil" class="ll-icon-xs ll-mr"></i-tabler> Edit
                    </button>
                    <button mat-menu-item (click)="createDeal(row)">
                      <i-tabler name="briefcase" class="ll-icon-xs ll-mr"></i-tabler> Create Deal
                    </button>
                    <button mat-menu-item (click)="deleteLead(row)"
                            class="ll-danger-item">
                      <i-tabler name="trash" class="ll-icon-xs ll-mr"></i-tabler> Delete
                    </button>
                  </mat-menu>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="ll-row"
                  (click)="openForm(row)"></tr>
            </table>
          </div>

          <mat-paginator [pageSizeOptions]="[10, 25, 50]" showFirstLastButtons
                         class="ll-paginator"></mat-paginator>
        </div>
      }

    </div>
  `,
  styles: [`
    /* ══════════════════════════════════════════════
       Design tokens — one block per theme.
       All rules below reference var(--ll-*) only;
       no hardcoded palette values past this section.
       ══════════════════════════════════════════════ */

    /* Light */
    :host {
      --ll-bg:           #ffffff;
      --ll-bg-alt:       #f8fafc;
      --ll-bg-header:    #fafafa;
      --ll-border:       #f1f5f9;
      --ll-border-input: #e2e8f0;
      --ll-shadow:       rgba(15, 23, 42, .07);
      --ll-text-hi:      #0f172a;
      --ll-text:         #1e293b;
      --ll-text-lo:      #334155;
      --ll-text-muted:   #64748b;
      --ll-text-dim:     #94a3b8;
    }
    /* Dark — mirrors _dark-theme-variables.scss tokens */
    :host-context(.dark-theme) {
      --ll-bg:           #1a2537;   /* --mat-sys-surface          */
      --ll-bg-alt:       #1f2a3d;   /* --mat-sys-surface-container-low */
      --ll-bg-header:    #1c2840;
      --ll-border:       #2e3f50;   /* --mat-sys-outline-variant  */
      --ll-border-input: #2e3f50;
      --ll-shadow:       rgba(0, 0, 0, .22);
      --ll-text-hi:      rgba(255, 255, 255, .90);
      --ll-text:         rgba(255, 255, 255, .80);
      --ll-text-lo:      rgba(255, 255, 255, .65);
      --ll-text-muted:   rgba(255, 255, 255, .48);
      --ll-text-dim:     rgba(255, 255, 255, .32);
    }

    /* ── Page shell ─────────────────────────────── */
    .ll-page { padding: 20px; display: flex; flex-direction: column; gap: 12px; }

    /* ── Header ─────────────────────────────────── */
    .ll-header { display: flex; justify-content: space-between; align-items: center; }
    .ll-title  { margin: 0; font-size: 20px; font-weight: 700; color: var(--ll-text-hi); line-height: 1.2; }
    .ll-sub    { margin: 2px 0 0; font-size: 13px; color: var(--ll-text-muted); }
    .ll-add-btn  { height: 36px; font-size: 13px; font-weight: 600; border-radius: 8px; }
    .ll-btn-icon { width: 16px; height: 16px; margin-right: 4px; vertical-align: middle; }

    /* ── KPI strip ──────────────────────────────── */
    .ll-stats {
      display: flex; align-items: center;
      background: var(--ll-bg); border-radius: 10px;
      box-shadow: 0 1px 4px var(--ll-shadow); padding: 0 4px;
    }
    .ll-stat {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 20px; flex: 1;
    }
    .ll-stat-sep { width: 1px; height: 32px; background: var(--ll-border); flex-shrink: 0; }
    .ll-stat-icon {
      width: 34px; height: 34px; border-radius: 8px;
      background: var(--c); color: var(--t);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      transition: background 200ms;
    }
    /* Dark: replace per-icon palette with uniform glass tint so icons
       stay visible without fighting the dark background */
    :host-context(.dark-theme) .ll-stat-icon {
      background: rgba(255, 255, 255, .08) !important;
    }
    .ll-stat-icon i-tabler { width: 18px; height: 18px; }
    .ll-stat-body { display: flex; flex-direction: column; line-height: 1; }
    .ll-stat-num  { font-size: 20px; font-weight: 700; color: var(--ll-text-hi); }
    .ll-stat-lbl  { font-size: 11.5px; color: var(--ll-text-muted); margin-top: 3px; }

    /* ── Loading ────────────────────────────────── */
    .ll-loading { display: flex; justify-content: center; padding: 40px; }

    /* ── Main card ──────────────────────────────── */
    .ll-card {
      background: var(--ll-bg); border-radius: 10px;
      box-shadow: 0 1px 4px var(--ll-shadow); overflow: hidden;
    }

    /* ── Filter toolbar ─────────────────────────── */
    .ll-toolbar {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 16px; border-bottom: 1px solid var(--ll-border);
    }
    .ll-search-wrap {
      flex: 1; display: flex; align-items: center; gap: 8px;
      background: var(--ll-bg-alt); border: 1px solid var(--ll-border-input);
      border-radius: 8px; padding: 0 12px; height: 38px;
    }
    .ll-search-icon  { width: 16px; height: 16px; color: var(--ll-text-dim); flex-shrink: 0; }
    .ll-search-input {
      border: none; background: transparent; outline: none;
      font-size: 13px; color: var(--ll-text); width: 100%;
    }
    .ll-search-input::placeholder { color: var(--ll-text-dim); }
    .ll-filter-field { width: 140px; }

    /* ── Table ──────────────────────────────────── */
    .ll-table-wrap { overflow-x: auto; }
    .ll-table { width: 100%; }

    .ll-table .mat-mdc-header-cell {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.5px; color: var(--ll-text-dim);
      padding: 0 12px; height: 36px;
      border-bottom: 1px solid var(--ll-border);
      background: var(--ll-bg-header);
    }
    .ll-table .mat-mdc-cell {
      padding: 0 12px; height: 46px;
      border-bottom: 1px solid var(--ll-border);
      font-size: 13px; color: var(--ll-text);
    }

    /* ── Name cell ──────────────────────────────── */
    .ll-name-cell { display: flex; align-items: center; gap: 9px; }
    .ll-avatar {
      width: 30px; height: 30px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700; color: #fff; flex-shrink: 0;
    }
    .ll-name-text    { display: flex; flex-direction: column; line-height: 1.2; }
    .ll-name-row     { display: flex; align-items: center; gap: 6px; }
    .ll-name-primary   { font-size: 13px; font-weight: 600; color: var(--ll-text-hi); }
    .ll-name-secondary { font-size: 11.5px; color: var(--ll-text-dim); }

    /* ── Deal count badge ───────────────────────── */
    .ll-deal-badge {
      display: inline-block; padding: 1px 7px; border-radius: 20px;
      font-size: 10.5px; font-weight: 600; white-space: nowrap;
      background: #dbeafe; color: #1d4ed8;
    }
    :host-context(.dark-theme) .ll-deal-badge {
      background: rgba(59, 130, 246, .18); color: #93c5fd;
    }

    /* ── Other cells ────────────────────────────── */
    .ll-company { font-size: 13px; color: var(--ll-text-lo); }
    .ll-muted   { font-size: 12.5px; color: var(--ll-text-muted); }
    .ll-value   { font-size: 13px; font-weight: 600; color: var(--ll-text-hi); }

    /* ── Status badge — light ───────────────────── */
    .ll-badge {
      display: inline-block; padding: 3px 9px; border-radius: 20px;
      font-size: 11.5px; font-weight: 600; white-space: nowrap;
    }
    .status-new         { background: #dbeafe; color: #1d4ed8; }
    .status-contacted   { background: #fef3c7; color: #b45309; }
    .status-qualified   { background: #dcfce7; color: #15803d; }
    .status-unqualified { background: #fee2e2; color: #b91c1c; }
    .status-converted   { background: #f3e8ff; color: #7e22ce; }

    /* ── Status badge — dark (tinted glass) ─────── */
    :host-context(.dark-theme) .status-new         { background: rgba(59, 130, 246, .18); color: #93c5fd; }
    :host-context(.dark-theme) .status-contacted   { background: rgba(245, 158, 11, .18); color: #fcd34d; }
    :host-context(.dark-theme) .status-qualified   { background: rgba(34, 197, 94,  .18); color: #86efac; }
    :host-context(.dark-theme) .status-unqualified { background: rgba(239, 68,  68,  .18); color: #fca5a5; }
    :host-context(.dark-theme) .status-converted   { background: rgba(168, 85, 247, .18); color: #d8b4fe; }

    /* ── Score cell ─────────────────────────────── */
    .ll-score    { display: flex; flex-direction: column; gap: 3px; min-width: 72px; }
    .ll-score-num { font-size: 13px; font-weight: 700; line-height: 1; }
    .ll-bar      { height: 3px; border-radius: 2px; }
    .score-high  { color: #16a34a; }
    .score-mid   { color: #d97706; }
    .score-low   { color: #dc2626; }
    /* Brighter palette on dark backgrounds */
    :host-context(.dark-theme) .score-high { color: #4ade80; }
    :host-context(.dark-theme) .score-mid  { color: #fbbf24; }
    :host-context(.dark-theme) .score-low  { color: #f87171; }

    /* ── Row hover ──────────────────────────────── */
    .ll-row { cursor: pointer; transition: background 120ms; }
    .ll-row:hover .mat-mdc-cell { background: var(--ll-bg-alt); }

    /* ── Actions cell ───────────────────────────── */
    .ll-actions-cell { width: 40px; text-align: right; }
    .ll-menu-btn { width: 30px; height: 30px; line-height: 30px; }
    .ll-icon-sm  { width: 16px; height: 16px; }
    .ll-icon-xs  { width: 14px; height: 14px; }
    .ll-mr       { margin-right: 6px; }
    .ll-danger-item { color: #dc2626; }
    :host-context(.dark-theme) .ll-danger-item { color: #f87171; }

    /* ── Paginator ──────────────────────────────── */
    .ll-paginator { border-top: 1px solid var(--ll-border); }

    /* ── Responsive ─────────────────────────────── */
    @media (max-width: 768px) {
      .ll-stats { flex-wrap: wrap; }
      .ll-stat  { flex: 1 1 40%; }
      .ll-stat-sep { display: none; }
    }
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
  readonly leadsWithDeals = computed(() => this.leads$().filter(l => (l.dealCount ?? 0) > 0).length);

  displayedColumns = ['name','company','status','score','source','estimatedValue','assignedTo','createdAt','actions'];
  dataSource = new MatTableDataSource<LeadDto>([]);

  statusFilter   = '';
  sourceFilter   = '';
  hasDealsFilter = '';

  statuses: LeadStatus[] = ['New','Contacted','Qualified','Unqualified'];
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

  createDeal(lead: LeadDto): void {
    const ref = this.sidePanel.open<DealFormComponent, { leadId: string }, 'saved' | 'cancelled'>(
      DealFormComponent,
      {
        title:    'New Deal',
        subtitle: `${lead.firstName} ${lead.lastName}${lead.company ? ' · ' + lead.company : ''}`,
        width:    '600px',
        data:     { leadId: lead.id },
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
    const filters: LeadListFilters = {};
    if (this.hasDealsFilter === 'true')  filters.hasDeals = true;
    if (this.hasDealsFilter === 'false') filters.hasDeals = false;
    this.api.list(filters).subscribe({
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

  onHasDealsChange(): void {
    this.load();
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
