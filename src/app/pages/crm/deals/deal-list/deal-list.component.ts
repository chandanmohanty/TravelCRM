import {
  Component, ChangeDetectionStrategy, inject, OnInit, signal,
  computed, ViewChild, AfterViewInit,
} from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SidePanelService } from '../../../../shared/side-panel';
import { DealFormComponent } from '../deal-form/deal-form.component';
import { DealDetailComponent } from '../deal-detail/deal-detail.component';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TablerIconsModule } from 'angular-tabler-icons';
import { DealsService } from '../../../../core/services/deals.service';
import { PipelinesService } from '../../../../core/services/pipelines.service';
import { IdentityApiService } from '../../../../core/services/identity-api.service';
import { DealDto, DealStatus, PipelineDto, PipelineStageDto } from '../../../../core/models/crm.models';
import { UserDto } from '../../../../core/models/identity.model';

@Component({
  selector: 'app-deal-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, CurrencyPipe, DatePipe, RouterModule, FormsModule,
    MatTableModule, MatPaginatorModule, MatSortModule,
    MatInputModule, MatFormFieldModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatChipsModule,
    MatTooltipModule, MatMenuModule,
    MatProgressSpinnerModule, MatCardModule, MatSnackBarModule,
    TablerIconsModule,
  ],
  template: `
    <div class="dl-page">

      <!-- ── Header ───────────────────────────────── -->
      <div class="dl-header">
        <div>
          <h2 class="dl-title">Deals</h2>
          <p class="dl-sub">Track and manage your sales pipeline</p>
        </div>
        <button mat-flat-button color="primary" class="dl-add-btn" (click)="openForm()">
          <i-tabler name="plus" class="dl-btn-icon"></i-tabler> Add Deal
        </button>
      </div>

      <!-- ── KPI strip ─────────────────────────────── -->
      <div class="dl-stats">
        <div class="dl-stat">
          <div class="dl-stat-icon" style="--c:#e8f0fe;--t:#1a73e8">
            <i-tabler name="briefcase"></i-tabler>
          </div>
          <div class="dl-stat-body">
            <span class="dl-stat-num">{{ openCount() }}</span>
            <span class="dl-stat-lbl">Open Deals</span>
          </div>
        </div>
        <div class="dl-stat-sep"></div>
        <div class="dl-stat">
          <div class="dl-stat-icon" style="--c:#ccfbf1;--t:#0d9488">
            <i-tabler name="currency-dollar"></i-tabler>
          </div>
          <div class="dl-stat-body">
            <span class="dl-stat-num dl-stat-multi">{{ pipelineValue() }}</span>
            <span class="dl-stat-lbl">Pipeline Value</span>
          </div>
        </div>
        <div class="dl-stat-sep"></div>
        <div class="dl-stat">
          <div class="dl-stat-icon" style="--c:#ede9fe;--t:#7c3aed">
            <i-tabler name="chart-bar"></i-tabler>
          </div>
          <div class="dl-stat-body">
            <span class="dl-stat-num dl-stat-multi">{{ weightedForecast() }}</span>
            <span class="dl-stat-lbl">Weighted Forecast</span>
          </div>
        </div>
        <div class="dl-stat-sep"></div>
        <div class="dl-stat">
          <div class="dl-stat-icon" style="--c:#dcfce7;--t:#15803d">
            <i-tabler name="rosette-discount-check"></i-tabler>
          </div>
          <div class="dl-stat-body">
            <span class="dl-stat-num">{{ wonThisMonth() }}</span>
            <span class="dl-stat-lbl">Won This Month</span>
          </div>
        </div>
      </div>

      <!-- ── Loading ───────────────────────────────── -->
      @if (loading()) {
        <div class="dl-loading"><mat-spinner diameter="32"></mat-spinner></div>
      }

      <!-- ── Main card: filter toolbar + table ─────── -->
      @if (!loading()) {
        <div class="dl-card">

          <!-- filter toolbar -->
          <div class="dl-toolbar">
            <div class="dl-search-wrap">
              <i-tabler name="search" class="dl-search-icon"></i-tabler>
              <input class="dl-search-input" placeholder="Search by title or contact…"
                     [(ngModel)]="searchText"
                     (input)="onSearchChange()" />
            </div>

            <!-- Pipeline filter -->
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="dl-filter-field">
              <mat-label>Pipeline</mat-label>
              <mat-select [(ngModel)]="pipelineFilter" (ngModelChange)="onPipelineChange()">
                <mat-option value="">All</mat-option>
                <mat-option *ngFor="let p of pipelines()" [value]="p.id">{{ p.name }}</mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Stage filter — disabled until a pipeline is selected -->
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="dl-filter-field">
              <mat-label>Stage</mat-label>
              <mat-select [(ngModel)]="stageFilter" [disabled]="!pipelineFilter"
                          (ngModelChange)="reload()">
                <mat-option value="">All</mat-option>
                <mat-option *ngFor="let s of availableStages()" [value]="s.id">{{ s.name }}</mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Owner filter -->
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="dl-filter-field">
              <mat-label>Owner</mat-label>
              <mat-select [(ngModel)]="ownerFilter" (ngModelChange)="reload()">
                <mat-option value="">All</mat-option>
                <mat-option *ngFor="let u of users()" [value]="u.id">{{ u.fullName }}</mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Status filter -->
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="dl-filter-field">
              <mat-label>Status</mat-label>
              <mat-select [(ngModel)]="statusFilter" (ngModelChange)="reload()">
                <mat-option value="">All</mat-option>
                <mat-option value="Open">Open</mat-option>
                <mat-option value="Won">Won</mat-option>
                <mat-option value="Lost">Lost</mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Has Lead filter -->
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="dl-filter-field">
              <mat-label>Lead</mat-label>
              <mat-select [(ngModel)]="hasLeadFilter" (ngModelChange)="reload()">
                <mat-option value="">All</mat-option>
                <mat-option value="true">With Lead</mat-option>
                <mat-option value="false">Without Lead</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <!-- table -->
          <div class="dl-table-wrap">
            <table mat-table [dataSource]="dataSource" class="dl-table">

              <!-- Title column -->
              <ng-container matColumnDef="title">
                <th mat-header-cell *matHeaderCellDef>Title</th>
                <td mat-cell *matCellDef="let row">
                  <div class="dl-title-cell">
                    <span class="dl-stage-dot"
                          [style.background]="'#' + row.stageColor"></span>
                    <span class="dl-name-primary">{{ row.title }}</span>
                  </div>
                </td>
              </ng-container>

              <!-- Contact column -->
              <ng-container matColumnDef="contact">
                <th mat-header-cell *matHeaderCellDef>Contact</th>
                <td mat-cell *matCellDef="let row">
                  <div class="dl-name-text">
                    <span class="dl-name-primary">{{ row.contactName }}</span>
                    @if (row.companyName) {
                      <span class="dl-name-secondary">{{ row.companyName }}</span>
                    }
                  </div>
                </td>
              </ng-container>

              <!-- Stage column -->
              <ng-container matColumnDef="stage">
                <th mat-header-cell *matHeaderCellDef>Stage</th>
                <td mat-cell *matCellDef="let row">
                  <span class="dl-stage-badge"
                        [style.background]="'#' + row.stageColor + '33'"
                        [style.color]="'#' + row.stageColor">
                    {{ row.stageName }}
                  </span>
                </td>
              </ng-container>

              <!-- Value column -->
              <ng-container matColumnDef="value">
                <th mat-header-cell *matHeaderCellDef>Value</th>
                <td mat-cell *matCellDef="let row">
                  @if (row.value != null) {
                    <span class="dl-value">{{ row.value | currency:row.currency:'symbol':'1.0-0' }}</span>
                  } @else {
                    <span class="dl-muted">—</span>
                  }
                </td>
              </ng-container>

              <!-- Owner column -->
              <ng-container matColumnDef="owner">
                <th mat-header-cell *matHeaderCellDef>Owner</th>
                <td mat-cell *matCellDef="let row">
                  <span class="dl-muted">{{ row.ownerName || '—' }}</span>
                </td>
              </ng-container>

              <!-- Expected Close column -->
              <ng-container matColumnDef="expectedClose">
                <th mat-header-cell *matHeaderCellDef>Expected Close</th>
                <td mat-cell *matCellDef="let row">
                  @if (row.expectedCloseDate) {
                    <span class="dl-muted">{{ row.expectedCloseDate | date:'d MMM y' }}</span>
                  } @else {
                    <span class="dl-muted">—</span>
                  }
                </td>
              </ng-container>

              <!-- Updated column -->
              <ng-container matColumnDef="updatedAt">
                <th mat-header-cell *matHeaderCellDef>Updated</th>
                <td mat-cell *matCellDef="let row">
                  <span class="dl-muted">{{ row.updatedAt | date:'d MMM y' }}</span>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="dl-row"
                  (click)="openDetail(row)"></tr>
            </table>
          </div>

          <mat-paginator
            [length]="total()"
            [pageSize]="pageSize"
            [pageSizeOptions]="[10, 25, 50]"
            showFirstLastButtons
            (page)="onPage($event)"
            class="dl-paginator">
          </mat-paginator>
        </div>
      }

    </div>
  `,
  styles: [`
    /* ══════════════════════════════════════════════
       Design tokens — one block per theme.
       All rules below reference var(--dl-*) only;
       no hardcoded palette values past this section.
       ══════════════════════════════════════════════ */

    /* Light */
    :host {
      --dl-bg:           #ffffff;
      --dl-bg-alt:       #f8fafc;
      --dl-bg-header:    #fafafa;
      --dl-border:       #f1f5f9;
      --dl-border-input: #e2e8f0;
      --dl-shadow:       rgba(15, 23, 42, .07);
      --dl-text-hi:      #0f172a;
      --dl-text:         #1e293b;
      --dl-text-lo:      #334155;
      --dl-text-muted:   #64748b;
      --dl-text-dim:     #94a3b8;
    }
    /* Dark — mirrors _dark-theme-variables.scss tokens */
    :host-context(.dark-theme) {
      --dl-bg:           #1a2537;
      --dl-bg-alt:       #1f2a3d;
      --dl-bg-header:    #1c2840;
      --dl-border:       #2e3f50;
      --dl-border-input: #2e3f50;
      --dl-shadow:       rgba(0, 0, 0, .22);
      --dl-text-hi:      rgba(255, 255, 255, .90);
      --dl-text:         rgba(255, 255, 255, .80);
      --dl-text-lo:      rgba(255, 255, 255, .65);
      --dl-text-muted:   rgba(255, 255, 255, .48);
      --dl-text-dim:     rgba(255, 255, 255, .32);
    }

    /* ── Page shell ─────────────────────────────── */
    .dl-page { padding: 20px; display: flex; flex-direction: column; gap: 12px; }

    /* ── Header ─────────────────────────────────── */
    .dl-header { display: flex; justify-content: space-between; align-items: center; }
    .dl-title  { margin: 0; font-size: 20px; font-weight: 700; color: var(--dl-text-hi); line-height: 1.2; }
    .dl-sub    { margin: 2px 0 0; font-size: 13px; color: var(--dl-text-muted); }
    .dl-add-btn  { height: 36px; font-size: 13px; font-weight: 600; border-radius: 8px; }
    .dl-btn-icon { width: 16px; height: 16px; margin-right: 4px; vertical-align: middle; }

    /* ── KPI strip ──────────────────────────────── */
    .dl-stats {
      display: flex; align-items: center;
      background: var(--dl-bg); border-radius: 10px;
      box-shadow: 0 1px 4px var(--dl-shadow); padding: 0 4px;
    }
    .dl-stat {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 20px; flex: 1;
    }
    .dl-stat-sep { width: 1px; height: 32px; background: var(--dl-border); flex-shrink: 0; }
    .dl-stat-icon {
      width: 34px; height: 34px; border-radius: 8px;
      background: var(--c); color: var(--t);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      transition: background 200ms;
    }
    :host-context(.dark-theme) .dl-stat-icon {
      background: rgba(255, 255, 255, .08) !important;
    }
    .dl-stat-icon i-tabler { width: 18px; height: 18px; }
    .dl-stat-body { display: flex; flex-direction: column; line-height: 1; }
    .dl-stat-num  { font-size: 20px; font-weight: 700; color: var(--dl-text-hi); }
    /* Multi-currency KPIs use smaller text to fit multiple currency segments */
    .dl-stat-multi { font-size: 13px; font-weight: 700; line-height: 1.5; }
    .dl-stat-lbl  { font-size: 11.5px; color: var(--dl-text-muted); margin-top: 3px; }

    /* ── Loading ────────────────────────────────── */
    .dl-loading { display: flex; justify-content: center; padding: 40px; }

    /* ── Main card ──────────────────────────────── */
    .dl-card {
      background: var(--dl-bg); border-radius: 10px;
      box-shadow: 0 1px 4px var(--dl-shadow); overflow: hidden;
    }

    /* ── Filter toolbar ─────────────────────────── */
    .dl-toolbar {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      padding: 10px 16px; border-bottom: 1px solid var(--dl-border);
    }
    .dl-search-wrap {
      flex: 1; min-width: 180px; display: flex; align-items: center; gap: 8px;
      background: var(--dl-bg-alt); border: 1px solid var(--dl-border-input);
      border-radius: 8px; padding: 0 12px; height: 38px;
    }
    .dl-search-icon  { width: 16px; height: 16px; color: var(--dl-text-dim); flex-shrink: 0; }
    .dl-search-input {
      border: none; background: transparent; outline: none;
      font-size: 13px; color: var(--dl-text); width: 100%;
    }
    .dl-search-input::placeholder { color: var(--dl-text-dim); }
    .dl-filter-field { width: 130px; }

    /* ── Table ──────────────────────────────────── */
    .dl-table-wrap { overflow-x: auto; }
    .dl-table { width: 100%; }

    .dl-table .mat-mdc-header-cell {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.5px; color: var(--dl-text-dim);
      padding: 0 12px; height: 36px;
      border-bottom: 1px solid var(--dl-border);
      background: var(--dl-bg-header);
    }
    .dl-table .mat-mdc-cell {
      padding: 0 12px; height: 46px;
      border-bottom: 1px solid var(--dl-border);
      font-size: 13px; color: var(--dl-text);
    }

    /* ── Title cell ─────────────────────────────── */
    .dl-title-cell {
      display: flex; align-items: center; gap: 8px;
    }
    .dl-stage-dot {
      width: 8px; height: 8px; border-radius: 50%;
      flex-shrink: 0; display: inline-block;
    }

    /* ── Name cell ──────────────────────────────── */
    .dl-name-text      { display: flex; flex-direction: column; line-height: 1.2; }
    .dl-name-primary   { font-size: 13px; font-weight: 600; color: var(--dl-text-hi); }
    .dl-name-secondary { font-size: 11.5px; color: var(--dl-text-dim); }

    /* ── Stage badge ────────────────────────────── */
    .dl-stage-badge {
      display: inline-block; padding: 3px 9px; border-radius: 20px;
      font-size: 11.5px; font-weight: 600; white-space: nowrap;
    }

    /* ── Other cells ────────────────────────────── */
    .dl-muted  { font-size: 12.5px; color: var(--dl-text-muted); }
    .dl-value  { font-size: 13px; font-weight: 600; color: var(--dl-text-hi); }

    /* ── Row hover ──────────────────────────────── */
    .dl-row { cursor: pointer; transition: background 120ms; }
    .dl-row:hover .mat-mdc-cell { background: var(--dl-bg-alt); }

    /* ── Paginator ──────────────────────────────── */
    .dl-paginator { border-top: 1px solid var(--dl-border); }

    /* ── Responsive ─────────────────────────────── */
    @media (max-width: 768px) {
      .dl-stats { flex-wrap: wrap; }
      .dl-stat  { flex: 1 1 40%; }
      .dl-stat-sep { display: none; }
    }
  `],
})
export class DealListComponent implements OnInit {
  private readonly dealsApi    = inject(DealsService);
  private readonly pipelinesApi = inject(PipelinesService);
  private readonly identityApi = inject(IdentityApiService);
  private readonly snack       = inject(MatSnackBar);
  private readonly sidePanel   = inject(SidePanelService);

  readonly loading  = signal(true);
  private readonly deals$ = signal<DealDto[]>([]);
  readonly total    = signal(0);

  // Filter state
  searchText    = '';
  pipelineFilter = '';
  stageFilter   = '';
  ownerFilter   = '';
  statusFilter  = '';
  hasLeadFilter = '';
  page          = 0;
  pageSize      = 25;

  // Reference data
  readonly pipelines = signal<PipelineDto[]>([]);
  readonly users     = signal<UserDto[]>([]);

  /** Stages for the selected pipeline. Empty when no pipeline is chosen. */
  readonly availableStages = computed<PipelineStageDto[]>(() => {
    if (!this.pipelineFilter) return [];
    return this.pipelines().find(p => p.id === this.pipelineFilter)?.stages ?? [];
  });

  // ── KPI computed signals ─────────────────────────────────────────────────
  // NOTE: KPIs reflect the currently loaded page, not the full dataset.
  // This is acceptable for Phase 1 — a server-side aggregate endpoint would
  // give more accurate figures across all pages.

  /** Count of open deals on the current page. */
  readonly openCount = computed(() =>
    this.deals$().filter(d => d.status === 'Open').length,
  );

  /** Pipeline value = Σ value for Open deals, grouped by currency. Rendered as "₹X · $Y · €Z". */
  readonly pipelineValue = computed(() => {
    const byCurrency = new Map<string, number>();
    for (const d of this.deals$()) {
      if (d.status === 'Open' && d.value != null) {
        byCurrency.set(d.currency, (byCurrency.get(d.currency) ?? 0) + d.value);
      }
    }
    return this.formatCurrencyMap(byCurrency);
  });

  /** Weighted forecast = Σ value * (probability/100) for Open deals, per currency. */
  readonly weightedForecast = computed(() => {
    const byCurrency = new Map<string, number>();
    for (const d of this.deals$()) {
      if (d.status === 'Open' && d.value != null) {
        const weighted = d.value * (d.probability / 100);
        byCurrency.set(d.currency, (byCurrency.get(d.currency) ?? 0) + weighted);
      }
    }
    return this.formatCurrencyMap(byCurrency);
  });

  /** Count of Won deals whose actualCloseDate falls in the current calendar month. */
  readonly wonThisMonth = computed(() => {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return this.deals$().filter(d => {
      if (d.status !== 'Won' || !d.actualCloseDate) return false;
      return new Date(d.actualCloseDate).getTime() >= start;
    }).length;
  });

  displayedColumns = ['title', 'contact', 'stage', 'value', 'owner', 'expectedClose', 'updatedAt'];
  dataSource = new MatTableDataSource<DealDto>([]);

  ngOnInit(): void {
    // Load reference data in parallel with the first deals page
    this.pipelinesApi.list().subscribe(ps => this.pipelines.set(ps));
    this.identityApi.listUsers({ pageSize: 200 }).subscribe(resp => this.users.set(resp.data));
    this.reload();
  }

  /** Build filter params and fetch from DealsService. */
  reload(): void {
    this.loading.set(true);
    const filters: Parameters<DealsService['list']>[0] = {
      page:     this.page + 1, // backend is 1-based
      pageSize: this.pageSize,
    };
    if (this.pipelineFilter) filters.pipelineId   = this.pipelineFilter;
    if (this.stageFilter)    filters.stageId       = this.stageFilter;
    if (this.ownerFilter)    filters.ownerUserId   = this.ownerFilter;
    if (this.statusFilter)   filters.status        = this.statusFilter as DealStatus;
    if (this.hasLeadFilter !== '') filters.hasLead  = this.hasLeadFilter === 'true';
    if (this.searchText)     filters.search        = this.searchText.trim();

    this.dealsApi.list(filters).subscribe({
      next: resp => {
        this.deals$.set(resp.items);
        this.total.set(resp.total);
        this.dataSource.data = resp.items;
        this.loading.set(false);
      },
      error: () => {
        this.snack.open('Failed to load deals.', 'Close', { duration: 3500 });
        this.loading.set(false);
      },
    });
  }

  /** When the pipeline dropdown changes, reset stage and reload. */
  onPipelineChange(): void {
    this.stageFilter = '';
    this.page = 0;
    this.reload();
  }

  onSearchChange(): void {
    this.page = 0;
    this.reload();
  }

  onPage(e: PageEvent): void {
    this.page     = e.pageIndex;
    this.pageSize = e.pageSize;
    this.reload();
  }

  /** Row click — open DealDetailComponent in a SidePanel. */
  openDetail(row: DealDto): void {
    const ref = this.sidePanel.open<DealDetailComponent, { dealId: string }, 'saved' | 'cancelled'>(
      DealDetailComponent,
      {
        title:    row.title,
        subtitle: row.stageName,
        width:    '640px',
        data:     { dealId: row.id },
      },
    );
    ref.afterClosed().subscribe(() => this.reload());
  }

  /** "+ Add Deal" button — open DealFormComponent in create mode. */
  openForm(): void {
    const ref = this.sidePanel.open<DealFormComponent, Record<string, never>, 'saved' | 'cancelled'>(
      DealFormComponent,
      {
        title:    'New Deal',
        subtitle: 'Create a new deal',
        width:    '600px',
        data:     {},
      },
    );
    ref.afterClosed().subscribe(result => {
      if (result === 'saved') this.reload();
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Format a currency→amount map as "₹1,200 · $800 · €500".
   * Returns "—" when the map is empty.
   */
  private formatCurrencyMap(map: Map<string, number>): string {
    if (map.size === 0) return '—';
    const symbols: Record<string, string> = {
      INR: '₹', USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$',
      SGD: 'S$', AED: 'AED ', JPY: '¥', CHF: 'CHF ',
    };
    return [...map.entries()]
      .map(([cur, val]) => `${symbols[cur] ?? cur + ' '}${Math.round(val).toLocaleString()}`)
      .join(' · ');
  }
}
