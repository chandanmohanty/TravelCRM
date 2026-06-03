import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import {
  ImportField,
  LEAD_IMPORT_FIELDS,
} from '../../../../core/models/lead-import.model';

/**
 * Reusable header-to-field mapper used by both the Excel wizard and the
 * Google Sheets wizard (Task 14).
 *
 * Emits:
 *  - `mappingChange`  — Record<field, header> with empty-string for "ignore"
 *  - `matchKeyChange` — currently selected dedupe key (default `email`)
 *  - `validityChange` — true when the required `email` field is mapped
 */
@Component({
  selector: 'app-lead-import-mapping',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
  ],
  template: `
    <div class="lim-grid">
      <div class="lim-row" *ngFor="let field of fields">
        <label class="lim-label">
          {{ field.label }}
          <span *ngIf="field.required" class="lim-required" aria-hidden="true">*</span>
        </label>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="lim-field">
          <mat-select
            [ngModel]="mapping()[field.key] ?? ''"
            (ngModelChange)="onSelect(field, $event)"
          >
            <mat-option [value]="''" [disabled]="field.required">
              {{ field.required ? '— select a column —' : '— ignore —' }}
            </mat-option>
            <mat-option *ngFor="let h of headers" [value]="h">{{ h }}</mat-option>
          </mat-select>
        </mat-form-field>
      </div>
    </div>

    <div class="lim-warn" *ngIf="!valid()">
      <mat-icon class="lim-warn-icon">error_outline</mat-icon>
      Email column is required — please select a header.
    </div>

    <div class="lim-match">
      <label class="lim-label">Match leads on</label>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="lim-field">
        <mat-select [ngModel]="matchKey()" (ngModelChange)="onMatchKey($event)">
          <mat-option *ngFor="let k of mappedKeys()" [value]="k">
            {{ labelFor(k) }}
          </mat-option>
        </mat-select>
      </mat-form-field>
    </div>
  `,
  styles: [`
    :host {
      --lim-bg: #ffffff;
      --lim-border: #e2e8f0;
      --lim-text: #1e293b;
      --lim-text-muted: #64748b;
      --lim-warn-bg: #fef2f2;
      --lim-warn-text: #b91c1c;
      display: block;
    }
    :host-context(.dark-theme) {
      --lim-bg: #1a2537;
      --lim-border: #2e3f50;
      --lim-text: rgba(255, 255, 255, .80);
      --lim-text-muted: rgba(255, 255, 255, .48);
      --lim-warn-bg: rgba(239, 68, 68, .12);
      --lim-warn-text: #fca5a5;
    }

    .lim-grid { display: flex; flex-direction: column; gap: 8px; }
    .lim-row  { display: grid; grid-template-columns: 160px 1fr; align-items: center; gap: 10px; }
    .lim-label {
      font-size: 12.5px; font-weight: 600; color: var(--lim-text);
    }
    .lim-required { color: #dc2626; margin-left: 2px; }
    :host-context(.dark-theme) .lim-required { color: #f87171; }
    .lim-field { width: 100%; }

    .lim-warn {
      display: flex; align-items: center; gap: 6px;
      margin-top: 10px; padding: 8px 12px;
      background: var(--lim-warn-bg); color: var(--lim-warn-text);
      border-radius: 6px; font-size: 12.5px;
    }
    .lim-warn-icon { width: 16px; height: 16px; font-size: 16px; }

    .lim-match {
      margin-top: 16px; padding-top: 12px;
      border-top: 1px solid var(--lim-border);
      display: grid; grid-template-columns: 160px 1fr; align-items: center; gap: 10px;
    }
  `],
})
export class LeadImportMappingComponent implements OnInit, OnChanges {
  @Input({ required: true }) headers: string[] = [];
  @Input() initialMapping: Record<string, string> = {};

  @Output() mappingChange = new EventEmitter<Record<string, string>>();
  @Output() matchKeyChange = new EventEmitter<string>();
  @Output() validityChange = new EventEmitter<boolean>();

  readonly fields: ImportField[] = LEAD_IMPORT_FIELDS;

  readonly mapping = signal<Record<string, string>>({});
  readonly matchKey = signal<string>('email');
  readonly valid = computed(() => !!this.mapping()['email']);
  readonly mappedKeys = computed(() => {
    const m = this.mapping();
    const keys = Object.keys(m).filter((k) => !!m[k]);
    // Ensure `email` is always selectable when mapped; default to email.
    return keys.length ? keys : ['email'];
  });

  private lastValid: boolean | null = null;

  ngOnInit(): void {
    this.seedFromInput();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialMapping'] && !changes['initialMapping'].firstChange) {
      this.seedFromInput();
    }
  }

  onSelect(field: ImportField, header: string): void {
    const next = { ...this.mapping(), [field.key]: header ?? '' };
    if (!next[field.key]) delete next[field.key];
    this.mapping.set(next);
    this.mappingChange.emit({ ...next });

    // If the chosen match key got un-mapped, fall back to `email` or the first available.
    const currentKey = this.matchKey();
    if (!next[currentKey]) {
      const fallback = next['email'] ? 'email' : (Object.keys(next)[0] ?? 'email');
      if (fallback !== currentKey) {
        this.matchKey.set(fallback);
        this.matchKeyChange.emit(fallback);
      }
    }

    this.emitValidityIfChanged();
  }

  onMatchKey(key: string): void {
    this.matchKey.set(key);
    this.matchKeyChange.emit(key);
  }

  labelFor(key: string): string {
    return this.fields.find((f) => f.key === key)?.label ?? key;
  }

  private seedFromInput(): void {
    // Filter the seed to only headers that actually exist in the file.
    const headerSet = new Set(this.headers);
    const seed: Record<string, string> = {};
    for (const [key, header] of Object.entries(this.initialMapping ?? {})) {
      if (header && headerSet.has(header)) seed[key] = header;
    }
    this.mapping.set(seed);
    this.mappingChange.emit({ ...seed });

    const initialKey = seed['email'] ? 'email' : (Object.keys(seed)[0] ?? 'email');
    this.matchKey.set(initialKey);
    this.matchKeyChange.emit(initialKey);

    this.emitValidityIfChanged();
  }

  private emitValidityIfChanged(): void {
    const v = this.valid();
    if (v !== this.lastValid) {
      this.lastValid = v;
      this.validityChange.emit(v);
    }
  }
}
