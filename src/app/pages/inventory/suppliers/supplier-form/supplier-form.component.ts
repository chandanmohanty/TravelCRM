import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TablerIconsModule } from 'angular-tabler-icons';
import { SuppliersService } from 'src/app/core/services/suppliers.service';
import { SupplierType, SupplierWriteBody, SupplierUpdateBody } from 'src/app/models/inventory.model';
import { SidePanelRef, SIDE_PANEL_DATA } from 'src/app/shared/side-panel';

@Component({
  selector: 'app-supplier-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule, RouterModule,
    MatButtonModule, MatDatepickerModule, MatNativeDateModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule,
    MatSelectModule, MatSlideToggleModule, TablerIconsModule,
  ],
  template: `
    <div class="sf-wrap" [class.sf-page]="!isPanelMode">

      @if (!isPanelMode) {
        <div class="sf-page-header">
          <button mat-icon-button type="button" (click)="cancel()">
            <i-tabler name="arrow-left" class="icon-sm"></i-tabler>
          </button>
          <div>
            <h2 class="sf-page-title">{{ isEdit() ? 'Edit Supplier' : 'New Supplier' }}</h2>
            <p class="sf-page-sub">{{ isEdit() ? 'Update details and contract dates' : 'Register a new vendor' }}</p>
          </div>
        </div>
      }

      @if (loading()) {
        <div class="sf-spinner"><mat-spinner diameter="32"></mat-spinner></div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="save()" class="sf">

          <!-- ── Basic ───────────────────────────────── -->
          <section class="sf-section">
            <p class="sf-label">Supplier</p>
            <div class="sf-grid g2-1">
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="span2">
                <mat-label>Name *</mat-label>
                <input matInput formControlName="name" maxlength="200" placeholder="e.g. Taj Hotels" />
                @if (form.controls.name.touched && form.controls.name.invalid) {
                  <mat-error>Required</mat-error>
                }
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Type</mat-label>
                <mat-select formControlName="supplierType">
                  <mat-option value="Hotel">Hotel</mat-option>
                  <mat-option value="Transport">Transport</mat-option>
                  <mat-option value="Activity">Activity</mat-option>
                  <mat-option value="Guide">Guide</mat-option>
                  <mat-option value="Other">Other</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
          </section>

          <div class="sf-sep"></div>

          <!-- ── Contact ─────────────────────────────── -->
          <section class="sf-section">
            <p class="sf-label">Contact</p>
            <div class="sf-grid g3">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Contact Name</mat-label>
                <input matInput formControlName="contactName" maxlength="200" />
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Email</mat-label>
                <input matInput type="email" formControlName="contactEmail" maxlength="200" />
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Phone</mat-label>
                <input matInput formControlName="contactPhone" maxlength="50" />
              </mat-form-field>
            </div>
            <div class="sf-grid g1 sf-mt">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Address</mat-label>
                <textarea matInput formControlName="address" rows="2" maxlength="1000"></textarea>
              </mat-form-field>
            </div>
          </section>

          <div class="sf-sep"></div>

          <!-- ── Contract ────────────────────────────── -->
          <section class="sf-section">
            <p class="sf-label">Contract</p>
            <div class="sf-grid g2">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Valid From</mat-label>
                <input matInput [matDatepicker]="fromPicker" formControlName="contractValidFrom" />
                <mat-datepicker-toggle matSuffix [for]="fromPicker"></mat-datepicker-toggle>
                <mat-datepicker #fromPicker></mat-datepicker>
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Valid To</mat-label>
                <input matInput [matDatepicker]="toPicker" formControlName="contractValidTo" />
                <mat-datepicker-toggle matSuffix [for]="toPicker"></mat-datepicker-toggle>
                <mat-datepicker #toPicker></mat-datepicker>
              </mat-form-field>
            </div>

            @if (isEdit()) {
              <div class="sf-toggle-row sf-mt">
                <mat-slide-toggle formControlName="isActive">Active</mat-slide-toggle>
                <span class="sf-hint">Inactive suppliers are hidden from new resource creation.</span>
              </div>
            }
          </section>

          @if (errorMessage()) {
            <div class="sf-error">
              <i-tabler name="alert-circle" class="icon-sm"></i-tabler>
              {{ errorMessage() }}
            </div>
          }

          <!-- ── Actions ─────────────────────────────── -->
          <div class="sf-actions">
            <button mat-stroked-button type="button" (click)="cancel()">Cancel</button>
            <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving()">
              @if (saving()) {
                <mat-spinner diameter="14" class="sf-spinner-btn"></mat-spinner>
              } @else {
                <i-tabler [name]="isEdit() ? 'check' : 'plus'" class="icon-sm sf-btn-icon"></i-tabler>
              }
              {{ isEdit() ? 'Save Changes' : 'Create Supplier' }}
            </button>
          </div>

        </form>
      }
    </div>
  `,
  styles: [`
    /* ── Design tokens ──────────────────────────── */
    :host {
      --sf-bg:       #ffffff;
      --sf-border:   #f1f5f9;
      --sf-shadow:   rgba(15, 23, 42, .07);
      --sf-text-hi:  #0f172a;
      --sf-text-lo:  #64748b;
      --sf-text-dim: #94a3b8;
      --sf-err-bg:   #fef2f2;
      --sf-err-text: #b91c1c;
      --sf-err-bdr:  #fecaca;
    }
    :host-context(.dark-theme) {
      --sf-bg:       #1a2537;
      --sf-border:   #2e3f50;
      --sf-shadow:   rgba(0, 0, 0, .22);
      --sf-text-hi:  rgba(255, 255, 255, .90);
      --sf-text-lo:  rgba(255, 255, 255, .50);
      --sf-text-dim: rgba(255, 255, 255, .35);
      --sf-err-bg:   rgba(185, 28, 28, .15);
      --sf-err-text: #fca5a5;
      --sf-err-bdr:  rgba(239, 68, 68, .30);
    }

    /* ── Outer wrapper ──────────────────────────── */
    .sf-wrap { display: block; }
    .sf-page {
      background: var(--sf-bg); border-radius: 12px; padding: 24px;
      box-shadow: 0 2px 16px var(--sf-shadow); max-width: 860px;
    }
    .sf-page-header { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 20px; }
    .sf-page-title  { margin: 0; font-size: 20px; font-weight: 700; color: var(--sf-text-hi); }
    .sf-page-sub    { margin: 2px 0 0; font-size: 13px; color: var(--sf-text-lo); }

    /* ── Loading ────────────────────────────────── */
    .sf-spinner { display: flex; justify-content: center; padding: 40px; }

    /* ── Form skeleton ──────────────────────────── */
    .sf { display: flex; flex-direction: column; }
    .sf-section { padding: 14px 0; }
    .sf-sep { height: 1px; background: var(--sf-border); }

    /* ── Section label ──────────────────────────── */
    .sf-label {
      margin: 0 0 10px;
      font-size: 10.5px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.8px;
      color: var(--sf-text-dim);
    }

    /* ── CSS grids ──────────────────────────────── */
    .sf-grid      { display: grid; gap: 8px; }
    .sf-grid.g1   { grid-template-columns: 1fr; }
    .sf-grid.g2   { grid-template-columns: repeat(2, 1fr); }
    .sf-grid.g3   { grid-template-columns: repeat(3, 1fr); }
    .sf-grid.g2-1 { grid-template-columns: 2fr 1fr; }
    .sf-grid .span2 { grid-column: span 2; }
    .sf-mt { margin-top: 8px; }
    .sf mat-form-field { width: 100%; }

    /* ── Toggle / hint ──────────────────────────── */
    .sf-toggle-row { display: flex; align-items: center; gap: 12px; }
    .sf-hint { color: var(--sf-text-lo); font-size: 12px; }

    /* ── Error banner ───────────────────────────── */
    .sf-error {
      display: flex; align-items: center; gap: 8px;
      background: var(--sf-err-bg); color: var(--sf-err-text);
      border: 1px solid var(--sf-err-bdr); border-radius: 8px;
      padding: 10px 14px; margin-bottom: 4px; font-size: 13px;
    }

    /* ── Actions ────────────────────────────────── */
    .sf-actions {
      display: flex; justify-content: flex-end; align-items: center; gap: 8px;
      padding-top: 12px; border-top: 1px solid var(--sf-border); margin-top: 4px;
    }
    .sf-btn-icon    { margin-right: 4px; }
    .sf-spinner-btn { display: inline-block; margin-right: 6px; }

    @media (max-width: 600px) {
      .sf-grid.g3 { grid-template-columns: 1fr; }
      .sf-grid.g2, .sf-grid.g2-1 { grid-template-columns: 1fr; }
      .sf-grid .span2 { grid-column: span 1; }
    }
  `],
})
export class SupplierFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(SuppliersService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private readonly panelRef = inject<SidePanelRef<'saved' | 'cancelled'> | null>(
    SidePanelRef, { optional: true });
  private readonly panelData = inject<{ id?: string } | null>(
    SIDE_PANEL_DATA, { optional: true });
  readonly isPanelMode = !!this.panelRef;

  loading = signal(true);
  saving = signal(false);
  errorMessage = signal<string | null>(null);
  supplierId = signal<string | null>(null);
  isEdit = signal(false);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    supplierType: ['Hotel' as SupplierType, Validators.required],
    contactName: [null as string | null],
    contactEmail: [null as string | null],
    contactPhone: [null as string | null],
    address: [null as string | null],
    contractValidFrom: [null as Date | null],
    contractValidTo: [null as Date | null],
    isActive: [true],
  });

  ngOnInit(): void {
    if (this.panelRef) {
      this.form.valueChanges.subscribe(() => {
        this.panelRef!.setDirty(this.form.dirty);
      });
    }

    const id = this.panelData?.id ?? this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.supplierId.set(id);
      this.isEdit.set(true);
      this.api.get(id).subscribe({
        next: (s) => {
          this.form.patchValue({
            name: s.name,
            supplierType: s.supplierType,
            contactName: s.contactName ?? null,
            contactEmail: s.contactEmail ?? null,
            contactPhone: s.contactPhone ?? null,
            address: s.address ?? null,
            contractValidFrom: s.contractValidFrom ? this.fromIsoDate(s.contractValidFrom) : null,
            contractValidTo: s.contractValidTo ? this.fromIsoDate(s.contractValidTo) : null,
            isActive: s.isActive,
          });
          this.loading.set(false);
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.error ?? 'Failed to load supplier');
          this.loading.set(false);
        },
      });
    } else {
      this.loading.set(false);
    }
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.errorMessage.set(null);

    const v = this.form.getRawValue();
    const baseBody: SupplierWriteBody = {
      name: v.name,
      supplierType: v.supplierType,
      contactName: v.contactName,
      contactEmail: v.contactEmail,
      contactPhone: v.contactPhone,
      address: v.address,
      contractValidFrom: v.contractValidFrom ? this.toIsoDate(v.contractValidFrom) : null,
      contractValidTo: v.contractValidTo ? this.toIsoDate(v.contractValidTo) : null,
    };

    const op$ = this.isEdit()
      ? this.api.update(this.supplierId()!, { ...baseBody, isActive: v.isActive } as SupplierUpdateBody)
      : this.api.create(baseBody);

    op$.subscribe({
      next: () => {
        this.form.markAsPristine();
        this.panelRef?.setDirty(false);
        if (this.isPanelMode) this.panelRef!.close('saved');
        else this.router.navigate(['/inventory/suppliers']);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.error ?? 'Save failed');
        this.saving.set(false);
      },
    });
  }

  cancel(): void {
    if (this.isPanelMode) this.panelRef!.close();
    else this.router.navigate(['/inventory/suppliers']);
  }

  /** Convert a Date to ISO yyyy-MM-dd (DateOnly serialisation expected by the backend). */
  private toIsoDate(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /**
   * Parse a yyyy-MM-dd string into a local-time Date.
   *
   * `new Date("2026-05-01")` parses as UTC midnight, which renders as the
   * previous day in any timezone behind UTC (Americas). Splitting and using
   * the (year, monthIndex, day) constructor anchors at local midnight instead.
   */
  private fromIsoDate(iso: string): Date {
    const [y, m, d] = iso.substring(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
  }
}
