import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { SidePanelRef } from '../../../../shared/side-panel';
import { LeadImportService } from '../../../../core/services/lead-import.service';
import {
  LeadImportResult,
  LeadImportRowOutcome,
  ParseResult,
  PreviewResult,
} from '../../../../core/models/lead-import.model';
import { LeadImportMappingComponent } from './lead-import-mapping.component';

type Step = 'upload' | 'map' | 'review' | 'done';

const ALLOWED_EXTENSIONS = ['.xlsx', '.xlsm', '.csv'];
const MAX_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-excel-import-wizard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    LeadImportMappingComponent,
  ],
  template: `
    <div class="eiw-host">

      <!-- ── Step indicator ─────────────────────────── -->
      <ol class="eiw-steps">
        <li [class.active]="step()==='upload'" [class.done]="stepIndex() > 0">1. Upload</li>
        <li [class.active]="step()==='map'"    [class.done]="stepIndex() > 1">2. Map columns</li>
        <li [class.active]="step()==='review'" [class.done]="stepIndex() > 2">3. Review</li>
        <li [class.active]="step()==='done'">4. Done</li>
      </ol>

      <!-- ── Error banner ───────────────────────────── -->
      <div class="eiw-error" *ngIf="error()">
        <mat-icon>error_outline</mat-icon>
        <span>{{ error() }}</span>
      </div>

      <!-- ── Step: upload ───────────────────────────── -->
      <ng-container *ngIf="step()==='upload'">
        <p class="eiw-hint">
          Upload an <strong>.xlsx</strong>, <strong>.xlsm</strong> or <strong>.csv</strong>
          file (max 5 MB). The first row must contain column headers.
        </p>
        <label class="eiw-drop"
               (dragover)="$event.preventDefault()"
               (drop)="onDrop($event)">
          <input #fileInput type="file"
                 accept=".xlsx,.xlsm,.csv"
                 (change)="onFileChange($event)" hidden />
          <mat-icon class="eiw-drop-icon">cloud_upload</mat-icon>
          <span class="eiw-drop-line">Drop a file here, or</span>
          <button mat-stroked-button type="button" (click)="fileInput.click()"
                  [disabled]="loading()">
            Choose file
          </button>
        </label>
        <div class="eiw-loading" *ngIf="loading()">
          <mat-spinner diameter="22"></mat-spinner>
          <span>Parsing…</span>
        </div>
      </ng-container>

      <!-- ── Step: map ──────────────────────────────── -->
      <ng-container *ngIf="step()==='map' && parseResult() as pr">
        <p class="eiw-hint">
          Detected <strong>{{ pr.totalRows }}</strong> data row{{ pr.totalRows === 1 ? '' : 's' }}.
          Map each column to a lead field. Email is required.
        </p>
        <app-lead-import-mapping
          [headers]="pr.headers"
          [initialMapping]="mapping()"
          (mappingChange)="mapping.set($event)"
          (matchKeyChange)="matchKeyField.set($event)"
          (validityChange)="mappingValid.set($event)">
        </app-lead-import-mapping>

        <div class="eiw-actions">
          <button mat-button type="button" (click)="backToUpload()" [disabled]="loading()">
            Back
          </button>
          <button mat-flat-button color="primary" type="button"
                  [disabled]="!mappingValid() || loading()"
                  (click)="runPreview()">
            <mat-spinner *ngIf="loading()" diameter="16"></mat-spinner>
            <span *ngIf="!loading()">Preview</span>
          </button>
        </div>
      </ng-container>

      <!-- ── Step: review ───────────────────────────── -->
      <ng-container *ngIf="step()==='review' && previewResult() as pv">
        <p class="eiw-hint">Review what will happen, then run the import.</p>
        <div class="eiw-counts">
          <div class="eiw-count create">
            <span class="eiw-count-num">{{ pv.willCreate }}</span>
            <span class="eiw-count-lbl">Will create</span>
          </div>
          <div class="eiw-count update">
            <span class="eiw-count-num">{{ pv.willUpdate }}</span>
            <span class="eiw-count-lbl">Will update</span>
          </div>
          <div class="eiw-count skip">
            <span class="eiw-count-num">{{ pv.willSkip }}</span>
            <span class="eiw-count-lbl">Will skip</span>
          </div>
        </div>

        <div class="eiw-errors" *ngIf="pv.sampleErrors.length">
          <h4>Sample issues</h4>
          <ul>
            <li *ngFor="let e of pv.sampleErrors">
              <strong>Row {{ e.rowNumber }}</strong>
              ({{ e.key || '—' }}) — <span class="eiw-pill">{{ e.status }}</span>
              {{ e.reason }}
            </li>
          </ul>
        </div>

        <div class="eiw-actions">
          <button mat-button type="button" (click)="step.set('map')" [disabled]="loading()">
            Back
          </button>
          <button mat-flat-button color="primary" type="button"
                  [disabled]="loading()" (click)="runCommit()">
            <mat-spinner *ngIf="loading()" diameter="16"></mat-spinner>
            <span *ngIf="!loading()">Run import</span>
          </button>
        </div>
      </ng-container>

      <!-- ── Step: done ─────────────────────────────── -->
      <ng-container *ngIf="step()==='done' && commitResult() as cr">
        <div class="eiw-success">
          <mat-icon class="eiw-success-icon">check_circle</mat-icon>
          <h3>Import complete</h3>
        </div>
        <div class="eiw-counts">
          <div class="eiw-count create">
            <span class="eiw-count-num">{{ cr.created }}</span>
            <span class="eiw-count-lbl">Created</span>
          </div>
          <div class="eiw-count update">
            <span class="eiw-count-num">{{ cr.updated }}</span>
            <span class="eiw-count-lbl">Updated</span>
          </div>
          <div class="eiw-count skip">
            <span class="eiw-count-num">{{ cr.skipped }}</span>
            <span class="eiw-count-lbl">Skipped</span>
          </div>
          <div class="eiw-count fail" *ngIf="cr.failed > 0">
            <span class="eiw-count-num">{{ cr.failed }}</span>
            <span class="eiw-count-lbl">Failed</span>
          </div>
        </div>

        <div class="eiw-actions">
          <button mat-stroked-button type="button"
                  *ngIf="cr.errors.length > 0"
                  (click)="downloadErrors(cr.errors)">
            <mat-icon>download</mat-icon>&nbsp;Error report (.csv)
          </button>
          <button mat-flat-button color="primary" type="button" (click)="close()">
            Close
          </button>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    :host {
      --eiw-bg: #ffffff;
      --eiw-text: #1e293b;
      --eiw-text-muted: #64748b;
      --eiw-border: #e2e8f0;
      --eiw-bg-alt: #f8fafc;
      --eiw-create: #dcfce7; --eiw-create-text: #15803d;
      --eiw-update: #dbeafe; --eiw-update-text: #1d4ed8;
      --eiw-skip:   #fef3c7; --eiw-skip-text:   #b45309;
      --eiw-fail:   #fee2e2; --eiw-fail-text:   #b91c1c;
      --eiw-warn-bg: #fef2f2; --eiw-warn-text: #b91c1c;
      display: block;
    }
    :host-context(.dark-theme) {
      --eiw-bg: #1a2537;
      --eiw-text: rgba(255, 255, 255, .80);
      --eiw-text-muted: rgba(255, 255, 255, .48);
      --eiw-border: #2e3f50;
      --eiw-bg-alt: #1f2a3d;
      --eiw-create: rgba(34, 197, 94,  .18); --eiw-create-text: #86efac;
      --eiw-update: rgba(59, 130, 246, .18); --eiw-update-text: #93c5fd;
      --eiw-skip:   rgba(245, 158, 11, .18); --eiw-skip-text:   #fcd34d;
      --eiw-fail:   rgba(239, 68, 68,  .18); --eiw-fail-text:   #fca5a5;
      --eiw-warn-bg: rgba(239, 68, 68, .12); --eiw-warn-text: #fca5a5;
    }

    .eiw-host { padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; }

    .eiw-steps {
      list-style: none; margin: 0; padding: 0;
      display: flex; gap: 6px; font-size: 12px; color: var(--eiw-text-muted);
    }
    .eiw-steps li {
      flex: 1; padding: 6px 8px; border-radius: 6px;
      background: var(--eiw-bg-alt); text-align: center;
    }
    .eiw-steps li.active { color: var(--eiw-text); font-weight: 600; }
    .eiw-steps li.done   { background: var(--eiw-create); color: var(--eiw-create-text); }

    .eiw-hint { margin: 0; font-size: 13px; color: var(--eiw-text-muted); }

    .eiw-error {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 12px; border-radius: 6px;
      background: var(--eiw-warn-bg); color: var(--eiw-warn-text);
      font-size: 13px;
    }
    .eiw-error mat-icon { width: 18px; height: 18px; font-size: 18px; }

    .eiw-drop {
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      padding: 28px 16px; border: 2px dashed var(--eiw-border); border-radius: 10px;
      background: var(--eiw-bg-alt); color: var(--eiw-text-muted); cursor: pointer;
    }
    .eiw-drop-icon { width: 32px; height: 32px; font-size: 32px; color: var(--eiw-text-muted); }
    .eiw-drop-line { font-size: 13px; }

    .eiw-loading { display: flex; align-items: center; gap: 8px; font-size: 13px; }

    .eiw-counts { display: flex; gap: 10px; flex-wrap: wrap; }
    .eiw-count {
      flex: 1 1 100px; min-width: 100px;
      padding: 12px; border-radius: 8px;
      display: flex; flex-direction: column; gap: 2px; align-items: flex-start;
    }
    .eiw-count.create { background: var(--eiw-create); color: var(--eiw-create-text); }
    .eiw-count.update { background: var(--eiw-update); color: var(--eiw-update-text); }
    .eiw-count.skip   { background: var(--eiw-skip);   color: var(--eiw-skip-text);   }
    .eiw-count.fail   { background: var(--eiw-fail);   color: var(--eiw-fail-text);   }
    .eiw-count-num { font-size: 22px; font-weight: 700; line-height: 1; }
    .eiw-count-lbl { font-size: 12px; }

    .eiw-errors { font-size: 12.5px; color: var(--eiw-text); }
    .eiw-errors h4 { margin: 0 0 4px; font-size: 13px; }
    .eiw-errors ul { margin: 0; padding-left: 16px; }
    .eiw-errors li { margin-bottom: 3px; }
    .eiw-pill {
      display: inline-block; padding: 0 6px; border-radius: 10px;
      font-size: 11px; font-weight: 600;
      background: var(--eiw-bg-alt); color: var(--eiw-text-muted);
    }

    .eiw-success { display: flex; align-items: center; gap: 8px; }
    .eiw-success-icon {
      width: 28px; height: 28px; font-size: 28px; color: var(--eiw-create-text);
    }
    .eiw-success h3 { margin: 0; font-size: 16px; color: var(--eiw-text); }

    .eiw-actions {
      display: flex; justify-content: flex-end; gap: 8px;
      padding-top: 8px; border-top: 1px solid var(--eiw-border);
    }
  `],
})
export class ExcelImportWizardComponent {
  private readonly importer = inject(LeadImportService);
  private readonly snack = inject(MatSnackBar);
  private readonly sidePanelRef = inject(SidePanelRef<boolean>, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  readonly step = signal<Step>('upload');
  readonly file = signal<File | null>(null);
  readonly parseResult = signal<ParseResult | null>(null);
  readonly mapping = signal<Record<string, string>>({});
  readonly matchKeyField = signal<string>('email');
  readonly mappingValid = signal<boolean>(false);
  readonly previewResult = signal<PreviewResult | null>(null);
  readonly commitResult = signal<LeadImportResult | null>(null);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  stepIndex(): number {
    return ({ upload: 0, map: 1, review: 2, done: 3 } as const)[this.step()];
  }

  onFileChange(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (file) this.handleFile(file);
    // Reset the input so the same file can be re-selected.
    input.value = '';
  }

  onDrop(ev: DragEvent): void {
    ev.preventDefault();
    const file = ev.dataTransfer?.files?.[0] ?? null;
    if (file) this.handleFile(file);
  }

  backToUpload(): void {
    this.step.set('upload');
    this.parseResult.set(null);
    this.mapping.set({});
    this.mappingValid.set(false);
    this.matchKeyField.set('email');
    this.error.set(null);
  }

  runPreview(): void {
    const pr = this.parseResult();
    if (!pr) return;
    this.loading.set(true);
    this.error.set(null);
    this.importer
      .preview(pr.stagingId, this.mapping(), this.matchKeyField())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.previewResult.set(r);
          this.step.set('review');
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(this.errorMessage(err, 'Preview failed.'));
          this.loading.set(false);
        },
      });
  }

  runCommit(): void {
    const pr = this.parseResult();
    if (!pr) return;
    this.loading.set(true);
    this.error.set(null);
    this.importer
      .commit(pr.stagingId, this.mapping(), this.matchKeyField())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.commitResult.set(r);
          this.step.set('done');
          this.loading.set(false);
          this.snack.open(
            `Imported ${r.created} created, ${r.updated} updated.`,
            'Close',
            { duration: 3000 },
          );
        },
        error: (err) => {
          this.error.set(this.errorMessage(err, 'Import failed.'));
          this.loading.set(false);
        },
      });
  }

  close(): void {
    // `true` signals the lead list to reload.
    this.sidePanelRef?.close(true);
  }

  downloadErrors(errors: LeadImportRowOutcome[]): void {
    const head = 'rowNumber,key,status,reason\n';
    const rows = errors
      .map((e) =>
        [e.rowNumber, csv(e.key), e.status, csv(e.reason ?? '')].join(','),
      )
      .join('\n');
    const blob = new Blob([head + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lead-import-errors.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  private handleFile(file: File): void {
    const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      this.error.set('Unsupported file type. Use .xlsx, .xlsm or .csv.');
      return;
    }
    if (file.size > MAX_BYTES) {
      this.error.set('File is too large (max 5 MB).');
      return;
    }

    this.error.set(null);
    this.file.set(file);
    this.loading.set(true);
    this.importer
      .parseExcel(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.parseResult.set(r);
          this.mapping.set({});
          this.mappingValid.set(false);
          this.matchKeyField.set('email');
          this.step.set('map');
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(this.errorMessage(err, 'Failed to parse file.'));
          this.loading.set(false);
        },
      });
  }

  private errorMessage(err: unknown, fallback: string): string {
    const e = err as { error?: { error?: string }; message?: string };
    return e?.error?.error ?? e?.message ?? fallback;
  }
}

/** RFC 4180 escape: wrap in quotes when the value contains , " or newline; double any quotes inside. */
function csv(value: string): string {
  if (value == null) return '';
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
