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

@Component({
  selector: 'app-supplier-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule, RouterModule,
    MatButtonModule, MatCardModule, MatDatepickerModule, MatNativeDateModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule,
    MatSelectModule, MatSlideToggleModule, TablerIconsModule,
  ],
  template: `
    <div class="crm-page">
      <div class="page-header">
        <div class="page-title">
          <h2>{{ isEdit() ? 'Edit Supplier' : 'New Supplier' }}</h2>
          <span class="subtitle">
            {{ isEdit() ? 'Update supplier details and contract dates' : 'Register a new vendor (hotel, transport, activity, guide)' }}
          </span>
        </div>
        <div class="page-actions">
          <button mat-stroked-button (click)="cancel()">
            <i-tabler name="arrow-left" class="icon-sm mr-1"></i-tabler> Back
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="spinner-wrap"><mat-spinner diameter="36"></mat-spinner></div>
      } @else {
        <mat-card class="form-card">
          <mat-card-content>
            <form [formGroup]="form" (ngSubmit)="save()" class="supplier-form">
              <div class="form-row">
                <mat-form-field appearance="outline" class="flex-2">
                  <mat-label>Name</mat-label>
                  <input matInput formControlName="name" maxlength="200" placeholder="e.g. Taj Hotels" />
                  @if (form.controls.name.touched && form.controls.name.invalid) {
                    <mat-error>Name is required</mat-error>
                  }
                </mat-form-field>
                <mat-form-field appearance="outline" class="flex-1">
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

              <h4 class="section-h">Contact</h4>
              <div class="form-row">
                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>Contact Name</mat-label>
                  <input matInput formControlName="contactName" maxlength="200" />
                </mat-form-field>
                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>Email</mat-label>
                  <input matInput type="email" formControlName="contactEmail" maxlength="200" />
                </mat-form-field>
                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>Phone</mat-label>
                  <input matInput formControlName="contactPhone" maxlength="50" />
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline" class="full">
                <mat-label>Address</mat-label>
                <textarea matInput formControlName="address" rows="3" maxlength="1000"></textarea>
              </mat-form-field>

              <h4 class="section-h">Contract</h4>
              <div class="form-row">
                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>Valid From</mat-label>
                  <input matInput [matDatepicker]="fromPicker" formControlName="contractValidFrom" />
                  <mat-datepicker-toggle matSuffix [for]="fromPicker"></mat-datepicker-toggle>
                  <mat-datepicker #fromPicker></mat-datepicker>
                </mat-form-field>
                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>Valid To</mat-label>
                  <input matInput [matDatepicker]="toPicker" formControlName="contractValidTo" />
                  <mat-datepicker-toggle matSuffix [for]="toPicker"></mat-datepicker-toggle>
                  <mat-datepicker #toPicker></mat-datepicker>
                </mat-form-field>
              </div>

              @if (isEdit()) {
                <div class="active-row">
                  <mat-slide-toggle formControlName="isActive">Active</mat-slide-toggle>
                  <span class="hint">Inactive suppliers are hidden from new resource creation but existing resources keep working.</span>
                </div>
              }

              @if (errorMessage()) {
                <div class="error-banner">
                  <i-tabler name="alert-circle" class="icon-sm"></i-tabler>
                  {{ errorMessage() }}
                </div>
              }

              <div class="form-actions">
                <button mat-button type="button" (click)="cancel()">Cancel</button>
                <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving()">
                  @if (saving()) {
                    <mat-spinner diameter="16" class="btn-spinner"></mat-spinner>
                  } @else {
                    <i-tabler [name]="isEdit() ? 'check' : 'plus'" class="icon-sm mr-1"></i-tabler>
                  }
                  {{ isEdit() ? 'Save Changes' : 'Create Supplier' }}
                </button>
              </div>
            </form>
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
    .mr-1 { margin-right: 4px; }
    .spinner-wrap { display: flex; justify-content: center; padding: 48px; }

    .form-card { max-width: 900px; }
    .form-card mat-card-content { padding: 24px; }
    .supplier-form { display: flex; flex-direction: column; gap: 0; }
    .supplier-form .full { width: 100%; }
    .form-row { display: flex; gap: 16px; }
    .form-row .flex-1 { flex: 1; }
    .form-row .flex-2 { flex: 2; }
    .section-h { margin: 16px 0 12px; font-size: 13px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.4px; }

    .active-row { display: flex; align-items: center; gap: 12px; margin: 8px 0 16px; }
    .active-row .hint { color: #64748b; font-size: 12px; }

    .error-banner {
      display: flex; align-items: center; gap: 8px;
      background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;
      padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 13px;
    }

    .form-actions {
      display: flex; justify-content: flex-end; gap: 8px;
      margin-top: 8px; padding-top: 16px; border-top: 1px solid #f1f5f9;
    }
    .btn-spinner { display: inline-block; margin-right: 8px; }

    @media (max-width: 600px) { .form-row { flex-direction: column; } }
  `],
})
export class SupplierFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(SuppliersService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

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
    const id = this.route.snapshot.paramMap.get('id');
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
            contractValidFrom: s.contractValidFrom ? new Date(s.contractValidFrom) : null,
            contractValidTo: s.contractValidTo ? new Date(s.contractValidTo) : null,
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
      next: () => this.router.navigate(['/inventory/suppliers']),
      error: (err) => {
        this.errorMessage.set(err?.error?.error ?? 'Save failed');
        this.saving.set(false);
      },
    });
  }

  cancel(): void { this.router.navigate(['/inventory/suppliers']); }

  /** Convert a Date to ISO yyyy-MM-dd (DateOnly serialisation expected by the backend). */
  private toIsoDate(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
