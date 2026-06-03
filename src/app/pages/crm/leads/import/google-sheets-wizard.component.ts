import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { SidePanelRef } from '../../../../shared/side-panel';
import { LeadImportService } from '../../../../core/services/lead-import.service';
import {
  GoogleStatus,
  LeadSourceSyncCadence,
  SheetTab,
} from '../../../../core/models/lead-import.model';
import { LeadImportMappingComponent } from './lead-import-mapping.component';

type Step =
  | 'loading'
  | 'not-configured'
  | 'connect'
  | 'pick-sheet'
  | 'map'
  | 'save'
  | 'done';

/**
 * Google Sheets connection wizard (Task 14).
 *
 * Walks the user from "check OAuth status" → "connect Google" → "pick a
 * sheet + tab" → "map columns" → "save & sync".  Reuses the same
 * `<app-lead-import-mapping>` component as the Excel wizard from Task 8.
 *
 * The host {@link SidePanelRef} closes with `true` on success so the
 * lead list reloads, or `false` if the user bails out early.
 */
@Component({
  selector: 'app-google-sheets-wizard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    LeadImportMappingComponent,
  ],
  template: `
    <div class="gsw-host">

      <!-- ── Step indicator ─────────────────────────── -->
      <ol class="gsw-steps">
        <li [class.active]="step()==='connect' || step()==='not-configured' || step()==='loading'"
            [class.done]="stepIndex() > 0">1. Connect</li>
        <li [class.active]="step()==='pick-sheet'"
            [class.done]="stepIndex() > 1">2. Pick sheet</li>
        <li [class.active]="step()==='map'"
            [class.done]="stepIndex() > 2">3. Map columns</li>
        <li [class.active]="step()==='save'"
            [class.done]="stepIndex() > 3">4. Save</li>
        <li [class.active]="step()==='done'">5. Done</li>
      </ol>

      <!-- ── Error banner ───────────────────────────── -->
      <div class="gsw-error" *ngIf="error()">
        <mat-icon>error_outline</mat-icon>
        <span>{{ error() }}</span>
      </div>

      <!-- ── Step: loading ──────────────────────────── -->
      <ng-container *ngIf="step()==='loading'">
        <div class="gsw-loading">
          <mat-spinner diameter="22"></mat-spinner>
          <span>Checking Google connection…</span>
        </div>
      </ng-container>

      <!-- ── Step: not configured ───────────────────── -->
      <ng-container *ngIf="step()==='not-configured'">
        <mat-card class="gsw-info-card">
          <mat-icon class="gsw-info-icon">info</mat-icon>
          <h3>Google Sheets isn't set up on this server</h3>
          <p>
            The administrator hasn't configured Google OAuth credentials yet,
            so Google Sheets import isn't available. Please contact your
            administrator.
          </p>
        </mat-card>
        <div class="gsw-actions">
          <button mat-flat-button color="primary" type="button" (click)="cancel()">
            Close
          </button>
        </div>
      </ng-container>

      <!-- ── Step: connect ──────────────────────────── -->
      <ng-container *ngIf="step()==='connect'">
        <p class="gsw-hint">
          Connect a Google account so we can read the rows in your spreadsheet.
          We only request <strong>read-only</strong> access to Sheets.
        </p>
        <div class="gsw-actions">
          <button mat-button type="button"
                  *ngIf="status()?.connected"
                  [disabled]="loading()"
                  (click)="disconnect()">
            Disconnect
          </button>
          <button mat-flat-button color="primary" type="button"
                  [disabled]="loading()"
                  (click)="connectGoogle()">
            <mat-spinner *ngIf="loading()" diameter="16"></mat-spinner>
            <span *ngIf="!loading()">
              <mat-icon class="gsw-btn-icon">link</mat-icon>
              Connect Google
            </span>
          </button>
        </div>
      </ng-container>

      <!-- ── Step: pick sheet ───────────────────────── -->
      <ng-container *ngIf="step()==='pick-sheet'">
        <p class="gsw-hint">
          Paste the URL of the Google Sheet (or just its ID), then choose a tab.
        </p>

        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="gsw-field">
          <mat-label>Spreadsheet URL or ID</mat-label>
          <input matInput type="text"
                 [ngModel]="spreadsheetUrlOrId()"
                 (ngModelChange)="spreadsheetUrlOrId.set($event)"
                 (blur)="onSpreadsheetBlur()"
                 placeholder="https://docs.google.com/spreadsheets/d/…">
        </mat-form-field>

        <div class="gsw-actions-inline">
          <button mat-stroked-button type="button"
                  [disabled]="loading() || !spreadsheetUrlOrId().trim()"
                  (click)="loadTabs()">
            <mat-spinner *ngIf="loading()" diameter="16"></mat-spinner>
            <span *ngIf="!loading()">Load tabs</span>
          </button>
        </div>

        <mat-form-field appearance="outline" subscriptSizing="dynamic"
                        class="gsw-field" *ngIf="tabs() as ts">
          <mat-label>Tab</mat-label>
          <mat-select
            [ngModel]="selectedTab()"
            (ngModelChange)="onTabSelected($event)">
            <mat-option *ngFor="let t of ts" [value]="t.title">{{ t.title }}</mat-option>
          </mat-select>
        </mat-form-field>

        <div class="gsw-loading" *ngIf="loading() && headers() === null && selectedTab()">
          <mat-spinner diameter="18"></mat-spinner>
          <span>Reading headers…</span>
        </div>

        <div class="gsw-actions">
          <button mat-button type="button" (click)="cancel()" [disabled]="loading()">
            Cancel
          </button>
          <button mat-flat-button color="primary" type="button"
                  [disabled]="loading() || !headers() || !selectedTab()"
                  (click)="step.set('map')">
            Next
          </button>
        </div>
      </ng-container>

      <!-- ── Step: map columns ──────────────────────── -->
      <ng-container *ngIf="step()==='map' && headers() as hs">
        <p class="gsw-hint">
          Map each Google Sheet column to a lead field. Email is required.
        </p>

        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="gsw-field">
          <mat-label>Connection name</mat-label>
          <input matInput type="text" required
                 [ngModel]="displayName()"
                 (ngModelChange)="displayName.set($event)"
                 placeholder="e.g. Marketing leads sheet">
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="gsw-field">
          <mat-label>Sync cadence</mat-label>
          <mat-select [ngModel]="cadence()" (ngModelChange)="cadence.set($event)">
            <mat-option value="Manual">Manual only</mat-option>
            <mat-option value="Every15Min">Every 15 minutes</mat-option>
            <mat-option value="Hourly">Hourly</mat-option>
            <mat-option value="Daily">Daily</mat-option>
          </mat-select>
        </mat-form-field>

        <app-lead-import-mapping
          [headers]="hs"
          [initialMapping]="mapping()"
          (mappingChange)="mapping.set($event)"
          (matchKeyChange)="matchKeyField.set($event)"
          (validityChange)="mappingValid.set($event)">
        </app-lead-import-mapping>

        <div class="gsw-actions">
          <button mat-button type="button" (click)="step.set('pick-sheet')" [disabled]="loading()">
            Back
          </button>
          <button mat-flat-button color="primary" type="button"
                  [disabled]="!mappingValid() || !displayName().trim() || loading()"
                  (click)="step.set('save')">
            Next
          </button>
        </div>
      </ng-container>

      <!-- ── Step: save ─────────────────────────────── -->
      <ng-container *ngIf="step()==='save'">
        <p class="gsw-hint">Review and save the connection. We'll trigger the first sync immediately.</p>
        <mat-card class="gsw-summary">
          <div class="gsw-summary-row">
            <span class="gsw-summary-lbl">Name</span>
            <span class="gsw-summary-val">{{ displayName() }}</span>
          </div>
          <div class="gsw-summary-row">
            <span class="gsw-summary-lbl">Spreadsheet ID</span>
            <span class="gsw-summary-val gsw-mono">{{ spreadsheetId() }}</span>
          </div>
          <div class="gsw-summary-row">
            <span class="gsw-summary-lbl">Tab</span>
            <span class="gsw-summary-val">{{ selectedTab() }}</span>
          </div>
          <div class="gsw-summary-row">
            <span class="gsw-summary-lbl">Cadence</span>
            <span class="gsw-summary-val">{{ cadence() }}</span>
          </div>
          <div class="gsw-summary-row">
            <span class="gsw-summary-lbl">Match key</span>
            <span class="gsw-summary-val">{{ matchKeyField() }}</span>
          </div>
        </mat-card>

        <div class="gsw-actions">
          <button mat-button type="button" (click)="step.set('map')" [disabled]="loading()">
            Back
          </button>
          <button mat-flat-button color="primary" type="button"
                  [disabled]="loading()" (click)="save()">
            <mat-spinner *ngIf="loading()" diameter="16"></mat-spinner>
            <span *ngIf="!loading()">Save & Sync</span>
          </button>
        </div>
      </ng-container>

      <!-- ── Step: done ─────────────────────────────── -->
      <ng-container *ngIf="step()==='done'">
        <div class="gsw-success">
          <mat-icon class="gsw-success-icon">check_circle</mat-icon>
          <h3>Connected — initial sync started</h3>
        </div>
        <p class="gsw-hint">
          We'll keep <strong>{{ displayName() }}</strong> in sync on the
          <strong>{{ cadence() }}</strong> schedule. You can manage it from
          the Lead Sources page.
        </p>
        <div class="gsw-actions">
          <button mat-flat-button color="primary" type="button" (click)="finish()">
            Close
          </button>
        </div>
      </ng-container>

    </div>
  `,
  styles: [`
    :host {
      --gsw-bg: #ffffff;
      --gsw-text: #1e293b;
      --gsw-text-muted: #64748b;
      --gsw-border: #e2e8f0;
      --gsw-bg-alt: #f8fafc;
      --gsw-create: #dcfce7; --gsw-create-text: #15803d;
      --gsw-info-bg: #eff6ff; --gsw-info-text: #1d4ed8;
      --gsw-warn-bg: #fef2f2; --gsw-warn-text: #b91c1c;
      display: block;
    }
    :host-context(.dark-theme) {
      --gsw-bg: #1a2537;
      --gsw-text: rgba(255, 255, 255, .80);
      --gsw-text-muted: rgba(255, 255, 255, .48);
      --gsw-border: #2e3f50;
      --gsw-bg-alt: #1f2a3d;
      --gsw-create: rgba(34, 197, 94, .18); --gsw-create-text: #86efac;
      --gsw-info-bg: rgba(59, 130, 246, .12); --gsw-info-text: #93c5fd;
      --gsw-warn-bg: rgba(239, 68, 68, .12); --gsw-warn-text: #fca5a5;
    }

    .gsw-host { padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; }

    .gsw-steps {
      list-style: none; margin: 0; padding: 0;
      display: flex; gap: 6px; font-size: 11.5px; color: var(--gsw-text-muted);
    }
    .gsw-steps li {
      flex: 1; padding: 6px 6px; border-radius: 6px;
      background: var(--gsw-bg-alt); text-align: center;
    }
    .gsw-steps li.active { color: var(--gsw-text); font-weight: 600; }
    .gsw-steps li.done   { background: var(--gsw-create); color: var(--gsw-create-text); }

    .gsw-hint { margin: 0; font-size: 13px; color: var(--gsw-text-muted); }

    .gsw-error {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 12px; border-radius: 6px;
      background: var(--gsw-warn-bg); color: var(--gsw-warn-text);
      font-size: 13px;
    }
    .gsw-error mat-icon { width: 18px; height: 18px; font-size: 18px; }

    .gsw-loading { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--gsw-text-muted); }

    .gsw-info-card {
      display: flex; flex-direction: column; align-items: flex-start; gap: 6px;
      padding: 14px; background: var(--gsw-info-bg); color: var(--gsw-info-text);
      box-shadow: none;
    }
    .gsw-info-icon { width: 22px; height: 22px; font-size: 22px; }
    .gsw-info-card h3 { margin: 0; font-size: 14px; font-weight: 600; }
    .gsw-info-card p { margin: 0; font-size: 13px; }

    .gsw-field { width: 100%; }

    .gsw-actions-inline { display: flex; gap: 8px; }

    .gsw-summary {
      padding: 12px; background: var(--gsw-bg-alt); box-shadow: none;
      display: flex; flex-direction: column; gap: 6px;
    }
    .gsw-summary-row { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; }
    .gsw-summary-lbl { color: var(--gsw-text-muted); }
    .gsw-summary-val { color: var(--gsw-text); font-weight: 500; text-align: right; word-break: break-all; }
    .gsw-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }

    .gsw-success { display: flex; align-items: center; gap: 8px; }
    .gsw-success-icon {
      width: 28px; height: 28px; font-size: 28px; color: var(--gsw-create-text);
    }
    .gsw-success h3 { margin: 0; font-size: 16px; color: var(--gsw-text); }

    .gsw-btn-icon { width: 16px; height: 16px; font-size: 16px; vertical-align: middle; margin-right: 4px; }

    .gsw-actions {
      display: flex; justify-content: flex-end; gap: 8px;
      padding-top: 8px; border-top: 1px solid var(--gsw-border);
    }
  `],
})
export class GoogleSheetsWizardComponent implements OnInit {
  private readonly svc = inject(LeadImportService);
  private readonly snack = inject(MatSnackBar);
  private readonly sidePanelRef = inject(SidePanelRef<boolean>, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  readonly step = signal<Step>('loading');
  readonly status = signal<GoogleStatus | null>(null);
  readonly spreadsheetUrlOrId = signal('');
  readonly spreadsheetId = signal('');
  readonly tabs = signal<SheetTab[] | null>(null);
  readonly selectedTab = signal<string>('');
  readonly headers = signal<string[] | null>(null);
  readonly previewRows = signal<Record<string, string>[]>([]);
  readonly mapping = signal<Record<string, string>>({});
  readonly matchKeyField = signal<string>('email');
  readonly mappingValid = signal<boolean>(false);
  readonly displayName = signal<string>('');
  readonly cadence = signal<LeadSourceSyncCadence>('Hourly');
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  /** Listener handle for the OAuth popup `postMessage`. Cleared on destroy. */
  private oauthMsgListener: ((ev: MessageEvent) => void) | null = null;

  ngOnInit(): void {
    this.fetchStatus();
    this.destroyRef.onDestroy(() => this.removeOAuthListener());
  }

  stepIndex(): number {
    return ({
      loading: 0,
      'not-configured': 0,
      connect: 0,
      'pick-sheet': 1,
      map: 2,
      save: 3,
      done: 4,
    } as const)[this.step()];
  }

  // ── OAuth status / connect / disconnect ────────────────────────────────

  private fetchStatus(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.googleStatus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (s) => {
          this.status.set(s);
          this.step.set(
            !s.configured ? 'not-configured'
              : !s.connected ? 'connect'
                : 'pick-sheet',
          );
          this.loading.set(false);
        },
        error: (e) => {
          this.error.set(this.msg(e, 'Failed to check Google status.'));
          this.loading.set(false);
        },
      });
  }

  connectGoogle(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.googleAuthUrl()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.loading.set(false);
          const popup = window.open(
            r.url,
            'goog-oauth',
            'width=520,height=680',
          );

          // Pin the postMessage listener to the OAuth callback origin so a
          // hostile page in another tab can't spoof 'google-connected'.
          // (Defense in depth: fetchStatus() re-validates server-side.)
          let expectedOrigin: string | null = null;
          try { expectedOrigin = new URL(r.url).origin; } catch { /* malformed url */ }

          this.removeOAuthListener();
          const onMsg = (ev: MessageEvent) => {
            if (expectedOrigin !== null && ev.origin !== expectedOrigin) return;
            if (ev.data === 'google-connected') {
              this.removeOAuthListener();
              try { popup?.close(); } catch { /* ignore */ }
              this.fetchStatus();
            }
          };
          this.oauthMsgListener = onMsg;
          window.addEventListener('message', onMsg);
        },
        error: (e) => {
          this.loading.set(false);
          this.error.set(this.msg(e, 'Could not start Google connect.'));
        },
      });
  }

  disconnect(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.googleDisconnect()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.snack.open('Google account disconnected.', 'Close', { duration: 2500 });
          this.fetchStatus();
        },
        error: (e) => {
          this.loading.set(false);
          this.error.set(this.msg(e, 'Could not disconnect Google.'));
        },
      });
  }

  private removeOAuthListener(): void {
    if (this.oauthMsgListener) {
      window.removeEventListener('message', this.oauthMsgListener);
      this.oauthMsgListener = null;
    }
  }

  // ── Sheet pick — tabs + headers ───────────────────────────────────────

  onSpreadsheetBlur(): void {
    const id = this.extractSpreadsheetId(this.spreadsheetUrlOrId());
    if (id && id !== this.spreadsheetId()) {
      this.spreadsheetId.set(id);
    }
  }

  loadTabs(): void {
    const id = this.extractSpreadsheetId(this.spreadsheetUrlOrId());
    if (!id) {
      this.error.set('Please paste a Google Sheet URL or ID.');
      return;
    }
    this.spreadsheetId.set(id);
    this.tabs.set(null);
    this.headers.set(null);
    this.selectedTab.set('');
    this.previewRows.set([]);
    this.loading.set(true);
    this.error.set(null);

    this.svc.sheetTabs(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (ts) => {
          this.tabs.set(ts);
          this.loading.set(false);
          if (ts.length === 0) {
            this.error.set('No tabs found in this spreadsheet.');
          }
        },
        error: (e) => {
          this.loading.set(false);
          this.error.set(this.msg(e, 'Could not load tabs from this sheet.'));
        },
      });
  }

  onTabSelected(tab: string): void {
    this.selectedTab.set(tab);
    this.headers.set(null);
    this.previewRows.set([]);
    if (!tab) return;

    this.loading.set(true);
    this.error.set(null);
    this.svc.sheetHeaders(this.spreadsheetId(), tab)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.headers.set(r.headers);
          this.previewRows.set(r.previewRows);
          // Reset mapping when switching tabs so stale picks don't carry over.
          this.mapping.set({});
          this.mappingValid.set(false);
          this.matchKeyField.set('email');
          this.loading.set(false);
        },
        error: (e) => {
          this.loading.set(false);
          this.error.set(this.msg(e, 'Could not read headers from this tab.'));
        },
      });
  }

  /**
   * Extracts the spreadsheetId from a URL like
   * `https://docs.google.com/spreadsheets/d/{id}/edit#gid=0`. Falls back to
   * the trimmed raw input when it isn't a URL.
   */
  private extractSpreadsheetId(input: string): string {
    const t = (input ?? '').trim();
    if (!t) return '';
    const m = t.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return m ? m[1] : t;
  }

  // ── Save ──────────────────────────────────────────────────────────────

  save(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.createSource({
      displayName: this.displayName().trim(),
      spreadsheetId: this.spreadsheetId(),
      sheetName: this.selectedTab(),
      columnMapping: this.mapping(),
      matchKeyField: this.matchKeyField(),
      syncCadence: this.cadence(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.step.set('done');
          this.snack.open('Lead source created — initial sync queued.', 'Close', { duration: 3000 });
        },
        error: (e) => {
          this.loading.set(false);
          this.error.set(this.msg(e, 'Could not save the connection.'));
        },
      });
  }

  // ── Side-panel close handlers ─────────────────────────────────────────

  finish(): void {
    this.sidePanelRef?.close(true);
  }

  cancel(): void {
    this.sidePanelRef?.close(false);
  }

  // ── Utility ───────────────────────────────────────────────────────────

  private msg(e: unknown, fallback: string): string {
    const err = e as { error?: { error?: string }; message?: string };
    return err?.error?.error ?? err?.message ?? fallback;
  }
}
