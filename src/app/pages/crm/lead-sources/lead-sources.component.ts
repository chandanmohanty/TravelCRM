import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SidePanelService } from '../../../shared/side-panel';
import { LeadImportService } from '../../../core/services/lead-import.service';
import {
  LeadSource,
  LeadSourceStatus,
  LeadSourceSyncCadence,
} from '../../../core/models/lead-import.model';
import { GoogleSheetsWizardComponent } from '../leads/import/google-sheets-wizard.component';
import { LeadSourceEditComponent } from './lead-source-edit.component';
import { HasFeatureDirective } from '../../../core/directives/has-feature.directive';

interface SyncResultSummary {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

/**
 * Lead Sources management page (Task 15).
 *
 * Lists the tenant's connected Google Sheets and exposes per-source actions:
 * Sync Now, Pause/Resume, Edit (re-fetches headers), and Disconnect.
 * "Add new" opens the existing {@link GoogleSheetsWizardComponent} in a side
 * panel; on success the list reloads.
 */
@Component({
  selector: 'app-lead-sources',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule,
    HasFeatureDirective,
  ],
  template: `
    <div class="ls-page" *hasFeature="'lead_import'">

      <!-- ── Header ───────────────────────────────── -->
      <div class="ls-header">
        <div class="ls-header-text">
          <a class="ls-back" routerLink="/crm/leads">
            <mat-icon class="ls-back-icon">arrow_back</mat-icon>
            Back to Leads
          </a>
          <h2 class="ls-title">Lead Sources</h2>
          <p class="ls-sub">
            Connected Google Sheets that sync into your leads on a schedule.
          </p>
        </div>
        <div class="ls-header-actions">
          <button mat-flat-button color="primary" class="ls-add-btn" (click)="addNew()">
            <mat-icon class="ls-btn-icon">add</mat-icon>
            Add new
          </button>
        </div>
      </div>

      <!-- ── Loading ───────────────────────────────── -->
      <div class="ls-loading" *ngIf="loading()">
        <mat-spinner diameter="32"></mat-spinner>
      </div>

      <!-- ── Empty state ───────────────────────────── -->
      <mat-card class="ls-empty" *ngIf="!loading() && sources().length === 0">
        <mat-icon class="ls-empty-icon">cloud_off</mat-icon>
        <h3>No connected sheets yet</h3>
        <p>
          Use <strong>Import Leads ▾ → Connect Google Sheet</strong> from the
          Leads page, or click <strong>Add new</strong> above.
        </p>
      </mat-card>

      <!-- ── Table ─────────────────────────────────── -->
      <div class="ls-card" *ngIf="!loading() && sources().length > 0">
        <div class="ls-table-wrap">
          <table mat-table [dataSource]="sources()" class="ls-table">

            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Name</th>
              <td mat-cell *matCellDef="let row">
                <span class="ls-name">{{ row.displayName }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="sheet">
              <th mat-header-cell *matHeaderCellDef>Sheet / Tab</th>
              <td mat-cell *matCellDef="let row">
                <div class="ls-sheet">
                  <span class="ls-sheet-tab">{{ row.sheetName }}</span>
                  <a class="ls-sheet-link"
                     [href]="'https://docs.google.com/spreadsheets/d/' + row.spreadsheetId + '/edit'"
                     target="_blank" rel="noopener noreferrer"
                     matTooltip="Open in Google Sheets">
                    <mat-icon class="ls-sheet-link-icon">open_in_new</mat-icon>
                  </a>
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="cadence">
              <th mat-header-cell *matHeaderCellDef>Cadence</th>
              <td mat-cell *matCellDef="let row">
                <span class="ls-muted">{{ cadenceLabel(row.syncCadence) }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let row">
                <span class="ls-chip"
                      [ngClass]="statusClass(row.status)"
                      [matTooltip]="row.status === 'Error' ? (row.lastError || '') : ''">
                  {{ row.status }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="lastSync">
              <th mat-header-cell *matHeaderCellDef>Last Sync</th>
              <td mat-cell *matCellDef="let row">
                <span class="ls-muted">
                  {{ row.lastSuccessAt ? (row.lastSuccessAt | date:'short') : 'Never' }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="lastResult">
              <th mat-header-cell *matHeaderCellDef>Last Result</th>
              <td mat-cell *matCellDef="let row">
                <span class="ls-muted"
                      [matTooltip]="row.status === 'Error' ? (row.lastError || '') : ''">
                  {{ resultSummary(row.lastResultJson) }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="ls-actions-head">Actions</th>
              <td mat-cell *matCellDef="let row" class="ls-actions-cell">
                <button mat-icon-button
                        aria-label="Sync now"
                        [matTooltip]="row.status === 'Disconnected' ? 'Reconnect Google to enable' : 'Sync now'"
                        [disabled]="busyId() === row.id || row.status === 'Disconnected'"
                        (click)="syncNow(row)">
                  <mat-icon>cloud_sync</mat-icon>
                </button>
                <button mat-icon-button
                        *ngIf="row.status !== 'Paused'"
                        aria-label="Pause sync"
                        matTooltip="Pause"
                        [disabled]="busyId() === row.id || row.status === 'Disconnected'"
                        (click)="pause(row)">
                  <mat-icon>pause</mat-icon>
                </button>
                <button mat-icon-button
                        *ngIf="row.status === 'Paused'"
                        aria-label="Resume sync"
                        matTooltip="Resume"
                        [disabled]="busyId() === row.id"
                        (click)="resume(row)">
                  <mat-icon>play_arrow</mat-icon>
                </button>
                <button mat-icon-button
                        aria-label="Edit mapping"
                        [matTooltip]="row.status === 'Disconnected' ? 'Reconnect Google to enable' : 'Edit mapping'"
                        [disabled]="busyId() === row.id || row.status === 'Disconnected'"
                        (click)="edit(row)">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button class="ls-danger"
                        aria-label="Disconnect source"
                        matTooltip="Disconnect"
                        [disabled]="busyId() === row.id"
                        (click)="disconnect(row)">
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="ls-row"></tr>
          </table>
        </div>
      </div>

    </div>
  `,
  styles: [`
    /* Light tokens */
    :host {
      --ls-bg:           #ffffff;
      --ls-bg-alt:       #f8fafc;
      --ls-bg-header:    #fafafa;
      --ls-border:       #f1f5f9;
      --ls-shadow:       rgba(15, 23, 42, .07);
      --ls-text-hi:      #0f172a;
      --ls-text:         #1e293b;
      --ls-text-muted:   #64748b;
      --ls-link:         #1d4ed8;

      --ls-chip-active-bg:   #dcfce7; --ls-chip-active-fg:   #15803d;
      --ls-chip-paused-bg:   #e2e8f0; --ls-chip-paused-fg:   #475569;
      --ls-chip-error-bg:    #fee2e2; --ls-chip-error-fg:    #b91c1c;
      --ls-chip-disc-bg:     #fef3c7; --ls-chip-disc-fg:     #92400e;

      --ls-danger:           #b91c1c;
      display: block;
    }
    :host-context(.dark-theme) {
      --ls-bg:           #1a2537;
      --ls-bg-alt:       #1f2a3d;
      --ls-bg-header:    #1f2a3d;
      --ls-border:       #2e3f50;
      --ls-shadow:       rgba(0, 0, 0, .3);
      --ls-text-hi:      rgba(255, 255, 255, .92);
      --ls-text:         rgba(255, 255, 255, .80);
      --ls-text-muted:   rgba(255, 255, 255, .48);
      --ls-link:         #93c5fd;

      --ls-chip-active-bg: rgba(34, 197, 94, .18);  --ls-chip-active-fg: #86efac;
      --ls-chip-paused-bg: rgba(148, 163, 184, .22); --ls-chip-paused-fg: #cbd5e1;
      --ls-chip-error-bg:  rgba(239, 68, 68, .18);   --ls-chip-error-fg:  #fca5a5;
      --ls-chip-disc-bg:   rgba(245, 158, 11, .18);  --ls-chip-disc-fg:   #fcd34d;

      --ls-danger:         #fca5a5;
    }

    .ls-page { padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; }

    .ls-header {
      display: flex; justify-content: space-between; align-items: flex-end; gap: 16px;
    }
    .ls-header-text { display: flex; flex-direction: column; gap: 2px; }
    .ls-back {
      display: inline-flex; align-items: center; gap: 4px;
      color: var(--ls-link); text-decoration: none; font-size: 12.5px;
      margin-bottom: 4px;
    }
    .ls-back:hover { text-decoration: underline; }
    .ls-back-icon { width: 16px; height: 16px; font-size: 16px; }
    .ls-title { margin: 0; font-size: 22px; font-weight: 600; color: var(--ls-text-hi); }
    .ls-sub { margin: 2px 0 0; font-size: 13px; color: var(--ls-text-muted); }
    .ls-btn-icon { width: 18px; height: 18px; font-size: 18px; margin-right: 4px; }

    .ls-loading {
      display: flex; justify-content: center; padding: 48px 0;
    }

    .ls-empty {
      padding: 32px 24px; text-align: center; background: var(--ls-bg);
      box-shadow: 0 1px 2px var(--ls-shadow);
      display: flex; flex-direction: column; align-items: center; gap: 8px;
    }
    .ls-empty-icon {
      width: 40px; height: 40px; font-size: 40px; color: var(--ls-text-muted);
    }
    .ls-empty h3 { margin: 0; font-size: 16px; color: var(--ls-text-hi); }
    .ls-empty p  { margin: 0; font-size: 13px; color: var(--ls-text-muted); }

    .ls-card {
      background: var(--ls-bg); border-radius: 8px;
      box-shadow: 0 1px 2px var(--ls-shadow); overflow: hidden;
    }
    .ls-table-wrap { overflow-x: auto; }
    .ls-table { width: 100%; background: var(--ls-bg); }

    .ls-table th {
      background: var(--ls-bg-header); color: var(--ls-text-muted);
      font-weight: 600; font-size: 12px; text-transform: uppercase;
      letter-spacing: .03em; border-bottom: 1px solid var(--ls-border);
    }
    .ls-table td {
      color: var(--ls-text); font-size: 13.5px;
      border-bottom: 1px solid var(--ls-border);
    }
    .ls-row { background: var(--ls-bg); }
    .ls-row:hover { background: var(--ls-bg-alt); }

    .ls-name { font-weight: 500; color: var(--ls-text-hi); }
    .ls-muted { color: var(--ls-text-muted); }

    .ls-sheet { display: inline-flex; align-items: center; gap: 4px; }
    .ls-sheet-tab { color: var(--ls-text); }
    .ls-sheet-link {
      color: var(--ls-link); display: inline-flex; align-items: center;
    }
    .ls-sheet-link-icon { width: 14px; height: 14px; font-size: 14px; }

    .ls-chip {
      display: inline-block; padding: 2px 8px; border-radius: 9999px;
      font-size: 11.5px; font-weight: 600; letter-spacing: .02em;
    }
    .ls-chip.is-active  { background: var(--ls-chip-active-bg); color: var(--ls-chip-active-fg); }
    .ls-chip.is-paused  { background: var(--ls-chip-paused-bg); color: var(--ls-chip-paused-fg); }
    .ls-chip.is-error   { background: var(--ls-chip-error-bg);  color: var(--ls-chip-error-fg); }
    .ls-chip.is-disc    { background: var(--ls-chip-disc-bg);   color: var(--ls-chip-disc-fg); }

    .ls-actions-head { text-align: right; padding-right: 16px; }
    .ls-actions-cell { text-align: right; white-space: nowrap; }
    .ls-danger { color: var(--ls-danger); }
  `],
})
export class LeadSourcesComponent implements OnInit {
  private readonly svc = inject(LeadImportService);
  private readonly snack = inject(MatSnackBar);
  private readonly sidePanel = inject(SidePanelService);
  private readonly destroyRef = inject(DestroyRef);

  readonly sources = signal<LeadSource[]>([]);
  readonly loading = signal<boolean>(true);
  /** Id of the row currently mid-action — disables that row's buttons. */
  readonly busyId = signal<string | null>(null);

  readonly displayedColumns = [
    'name', 'sheet', 'cadence', 'status', 'lastSync', 'lastResult', 'actions',
  ];

  ngOnInit(): void {
    this.loadSources();
  }

  loadSources(): void {
    this.loading.set(true);
    this.svc.listSources()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.sources.set(rows);
          this.loading.set(false);
        },
        error: (e) => {
          this.loading.set(false);
          this.snack.open(this.msg(e, 'Could not load lead sources.'), 'Close', { duration: 4000 });
        },
      });
  }

  // ── Add new ───────────────────────────────────────────────────────────

  addNew(): void {
    const ref = this.sidePanel.open<GoogleSheetsWizardComponent, void, boolean>(
      GoogleSheetsWizardComponent,
      {
        title:    'Connect Google Sheet',
        subtitle: 'Recurring lead sync',
        width:    '560px',
      },
    );
    ref.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((refreshed) => {
      if (refreshed) this.loadSources();
    });
  }

  // ── Per-row actions ───────────────────────────────────────────────────

  syncNow(row: LeadSource): void {
    this.busyId.set(row.id);
    this.svc.syncNow(row.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busyId.set(null);
          this.snack.open('Sync queued.', 'Close', { duration: 2500 });
          this.loadSources();
        },
        error: (e) => {
          this.busyId.set(null);
          this.snack.open(this.msg(e, 'Could not queue sync.'), 'Close', { duration: 4000 });
        },
      });
  }

  pause(row: LeadSource): void {
    this.busyId.set(row.id);
    this.svc.pauseSource(row.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busyId.set(null);
          this.snack.open('Source paused.', 'Close', { duration: 2500 });
          this.loadSources();
        },
        error: (e) => {
          this.busyId.set(null);
          this.snack.open(this.msg(e, 'Could not pause source.'), 'Close', { duration: 4000 });
        },
      });
  }

  resume(row: LeadSource): void {
    this.busyId.set(row.id);
    this.svc.resumeSource(row.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busyId.set(null);
          this.snack.open('Source resumed.', 'Close', { duration: 2500 });
          this.loadSources();
        },
        error: (e) => {
          this.busyId.set(null);
          this.snack.open(this.msg(e, 'Could not resume source.'), 'Close', { duration: 4000 });
        },
      });
  }

  edit(row: LeadSource): void {
    const ref = this.sidePanel.open<LeadSourceEditComponent, LeadSource, boolean>(
      LeadSourceEditComponent,
      {
        title:    'Edit lead source',
        subtitle: row.displayName,
        width:    '560px',
        data:     row,
      },
    );
    ref.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((saved) => {
      if (saved) this.loadSources();
    });
  }

  disconnect(row: LeadSource): void {
    const ok = confirm(
      `Disconnect "${row.displayName}"?\n\n` +
      `Existing leads stay. RowState history is cleared so re-connecting starts fresh.`,
    );
    if (!ok) return;

    this.busyId.set(row.id);
    this.svc.deleteSource(row.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busyId.set(null);
          this.snack.open('Lead source disconnected.', 'Close', { duration: 2500 });
          this.loadSources();
        },
        error: (e) => {
          this.busyId.set(null);
          this.snack.open(this.msg(e, 'Could not disconnect source.'), 'Close', { duration: 4000 });
        },
      });
  }

  // ── View helpers ──────────────────────────────────────────────────────

  cadenceLabel(c: LeadSourceSyncCadence): string {
    switch (c) {
      case 'Manual':     return 'Manual';
      case 'Every15Min': return 'Every 15 min';
      case 'Hourly':     return 'Hourly';
      case 'Daily':      return 'Daily';
    }
  }

  statusClass(s: LeadSourceStatus): string {
    switch (s) {
      case 'Active':       return 'is-active';
      case 'Paused':       return 'is-paused';
      case 'Error':        return 'is-error';
      case 'Disconnected': return 'is-disc';
    }
  }

  resultSummary(json: string | null): string {
    if (!json) return '—';
    try {
      const r = JSON.parse(json) as Partial<SyncResultSummary>;
      const c = r.created ?? 0;
      const u = r.updated ?? 0;
      const s = r.skipped ?? 0;
      const f = r.failed ?? 0;
      return `+${c} ~${u} =${s} !${f}`;
    } catch {
      return '—';
    }
  }

  private msg(e: unknown, fallback: string): string {
    const err = e as { error?: { error?: string }; message?: string };
    return err?.error?.error ?? err?.message ?? fallback;
  }
}
