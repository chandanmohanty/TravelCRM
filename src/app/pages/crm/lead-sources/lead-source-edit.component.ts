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
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { SIDE_PANEL_DATA, SidePanelRef } from '../../../shared/side-panel';
import { LeadImportService } from '../../../core/services/lead-import.service';
import {
  LeadSource,
  LeadSourceSyncCadence,
} from '../../../core/models/lead-import.model';
import { LeadImportMappingComponent } from '../leads/import/lead-import-mapping.component';

/**
 * Edit-mode side panel for a connected Google Sheet lead source.
 *
 * Re-fetches fresh headers from the spreadsheet so column changes in Google
 * are reflected in the mapping UI, then PUTs the updated source via
 * {@link LeadImportService.updateSource}.
 *
 * Opened from {@link LeadSourcesComponent}; closes with `true` on success.
 */
@Component({
  selector: 'app-lead-source-edit',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    LeadImportMappingComponent,
  ],
  template: `
    <div class="lse-host">

      <div class="lse-error" *ngIf="error()">
        <mat-icon>error_outline</mat-icon>
        <span>{{ error() }}</span>
      </div>

      <div class="lse-loading" *ngIf="loadingHeaders()">
        <mat-spinner diameter="22"></mat-spinner>
        <span>Re-reading sheet headers…</span>
      </div>

      <ng-container *ngIf="!loadingHeaders() && headers() as hs">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="lse-field">
          <mat-label>Connection name</mat-label>
          <input matInput type="text" required
                 [ngModel]="displayName()"
                 (ngModelChange)="displayName.set($event)">
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="lse-field">
          <mat-label>Sheet tab</mat-label>
          <input matInput type="text" required
                 [ngModel]="sheetName()"
                 (ngModelChange)="sheetName.set($event)">
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="lse-field">
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

        <div class="lse-actions">
          <button mat-button type="button" (click)="cancel()" [disabled]="saving()">
            Cancel
          </button>
          <button mat-flat-button color="primary" type="button"
                  [disabled]="saving() || !mappingValid() || !displayName().trim() || !sheetName().trim()"
                  (click)="save()">
            <mat-spinner *ngIf="saving()" diameter="16"></mat-spinner>
            <span *ngIf="!saving()">Save changes</span>
          </button>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    :host {
      --lse-text: #1e293b;
      --lse-text-muted: #64748b;
      --lse-border: #e2e8f0;
      --lse-warn-bg: #fef2f2; --lse-warn-text: #b91c1c;
      display: block;
    }
    :host-context(.dark-theme) {
      --lse-text: rgba(255,255,255,.80);
      --lse-text-muted: rgba(255,255,255,.48);
      --lse-border: #2e3f50;
      --lse-warn-bg: rgba(239,68,68,.12); --lse-warn-text: #fca5a5;
    }
    .lse-host { padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; }
    .lse-field { width: 100%; }
    .lse-error {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 12px; border-radius: 6px;
      background: var(--lse-warn-bg); color: var(--lse-warn-text); font-size: 13px;
    }
    .lse-error mat-icon { width: 18px; height: 18px; font-size: 18px; }
    .lse-loading { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--lse-text-muted); }
    .lse-actions {
      display: flex; justify-content: flex-end; gap: 8px;
      padding-top: 8px; border-top: 1px solid var(--lse-border);
    }
  `],
})
export class LeadSourceEditComponent implements OnInit {
  private readonly svc = inject(LeadImportService);
  private readonly snack = inject(MatSnackBar);
  private readonly source = inject<LeadSource>(SIDE_PANEL_DATA);
  private readonly sidePanelRef = inject(SidePanelRef<boolean>, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  readonly displayName = signal<string>('');
  readonly sheetName = signal<string>('');
  readonly cadence = signal<LeadSourceSyncCadence>('Hourly');
  readonly headers = signal<string[] | null>(null);
  readonly mapping = signal<Record<string, string>>({});
  readonly matchKeyField = signal<string>('email');
  readonly mappingValid = signal<boolean>(false);
  readonly loadingHeaders = signal<boolean>(true);
  readonly saving = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    // Seed signals from the source so the form is pre-filled before headers arrive.
    this.displayName.set(this.source.displayName);
    this.sheetName.set(this.source.sheetName);
    this.cadence.set(this.source.syncCadence);
    this.mapping.set({ ...this.source.columnMapping });
    this.matchKeyField.set(this.source.matchKeyField);
    this.refreshHeaders();
  }

  private refreshHeaders(): void {
    this.loadingHeaders.set(true);
    this.error.set(null);
    this.svc.sheetHeaders(this.source.spreadsheetId, this.sheetName())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.headers.set(r.headers);
          this.loadingHeaders.set(false);
        },
        error: (e) => {
          this.loadingHeaders.set(false);
          this.error.set(this.msg(e, 'Could not re-read sheet headers — the mapping below uses the cached layout.'));
          // Fall back to keys from the existing mapping so the user can still edit.
          this.headers.set(Object.values(this.source.columnMapping).filter((v) => !!v));
        },
      });
  }

  save(): void {
    this.saving.set(true);
    this.error.set(null);
    this.svc.updateSource(this.source.id, {
      rowVersion: this.source.rowVersion,
      displayName: this.displayName().trim(),
      sheetName: this.sheetName().trim(),
      columnMapping: this.mapping(),
      matchKeyField: this.matchKeyField(),
      syncCadence: this.cadence(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.snack.open('Lead source updated.', 'Close', { duration: 2500 });
          this.sidePanelRef?.close(true);
        },
        error: (e) => {
          this.saving.set(false);
          this.error.set(this.msg(e, 'Could not save changes.'));
        },
      });
  }

  cancel(): void {
    this.sidePanelRef?.close(false);
  }

  private msg(e: unknown, fallback: string): string {
    const err = e as { error?: { error?: string }; message?: string };
    return err?.error?.error ?? err?.message ?? fallback;
  }
}
