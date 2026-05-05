import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { TenantSettingsService } from '../../../core/services/tenant-settings.service';

@Component({
  selector: 'app-system-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatSnackBarModule, MatDividerModule,
  ],
  template: `
    <div class="page-header m-b-24">
      <h2 class="f-s-24 f-w-700 m-0">System Settings</h2>
      <p class="text-muted m-0 m-t-4">Tenant-wide defaults for date/time formats, locale, and fiscal year.</p>
    </div>

    <mat-card class="cardWithShadow">
      <mat-card-content class="p-24">
        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="row">
            <div class="col-md-6 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Date format</mat-label>
                <mat-select formControlName="dateFormat">
                  <mat-option value="dd/MM/yyyy">dd/MM/yyyy (23/04/2026)</mat-option>
                  <mat-option value="MM/dd/yyyy">MM/dd/yyyy (04/23/2026)</mat-option>
                  <mat-option value="yyyy-MM-dd">yyyy-MM-dd (2026-04-23)</mat-option>
                  <mat-option value="dd-MMM-yyyy">dd-MMM-yyyy (23-Apr-2026)</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
            <div class="col-md-6 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Time format</mat-label>
                <mat-select formControlName="timeFormat">
                  <mat-option value="HH:mm">24-hour (14:30)</mat-option>
                  <mat-option value="hh:mm a">12-hour (02:30 PM)</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
            <div class="col-md-6 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Default timezone</mat-label>
                <input matInput formControlName="defaultTimeZone" placeholder="Asia/Kolkata" />
              </mat-form-field>
            </div>
            <div class="col-md-6 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Default currency (ISO 4217)</mat-label>
                <input matInput formControlName="defaultCurrencyCode" maxlength="3" placeholder="INR" />
              </mat-form-field>
            </div>
            <div class="col-md-6 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Fiscal year start — month</mat-label>
                <mat-select formControlName="fiscalYearStartMonth">
                  @for (m of months; track m.value) {
                    <mat-option [value]="m.value">{{ m.label }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>
            <div class="col-md-6 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Fiscal year start — day</mat-label>
                <input matInput type="number" formControlName="fiscalYearStartDay" min="1" max="28" />
              </mat-form-field>
            </div>
          </div>

          <mat-divider class="m-y-16"></mat-divider>
          <div class="d-flex justify-content-end gap-8">
            <button mat-stroked-button type="button" (click)="load()" [disabled]="saving()">
              <mat-icon>refresh</mat-icon> Reload
            </button>
            <button mat-flat-button color="primary" type="submit"
                    [disabled]="form.invalid || saving()">
              <mat-icon>save</mat-icon> {{ saving() ? 'Saving…' : 'Save Changes' }}
            </button>
          </div>
        </form>
      </mat-card-content>
    </mat-card>
  `,
})
export class SystemSettingsComponent implements OnInit {
  private readonly fb      = inject(FormBuilder);
  private readonly api     = inject(TenantSettingsService);
  private readonly snack   = inject(MatSnackBar);

  readonly saving = signal(false);

  readonly months = [
    { value: 1,  label: 'January' }, { value: 2,  label: 'February' },
    { value: 3,  label: 'March'   }, { value: 4,  label: 'April (India FY)' },
    { value: 5,  label: 'May'     }, { value: 6,  label: 'June'     },
    { value: 7,  label: 'July'    }, { value: 8,  label: 'August'   },
    { value: 9,  label: 'September'}, { value: 10, label: 'October' },
    { value: 11, label: 'November'}, { value: 12, label: 'December'},
  ];

  form = this.fb.group({
    dateFormat:           ['dd/MM/yyyy', Validators.required],
    timeFormat:           ['HH:mm',      Validators.required],
    defaultTimeZone:      ['UTC',        [Validators.required, Validators.maxLength(50)]],
    defaultCurrencyCode:  ['USD',        [Validators.required, Validators.minLength(3), Validators.maxLength(3)]],
    fiscalYearStartMonth: [1,            [Validators.required, Validators.min(1), Validators.max(12)]],
    fiscalYearStartDay:   [1,            [Validators.required, Validators.min(1), Validators.max(28)]],
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.api.getSystem().subscribe({
      next: s => this.form.patchValue(s),
      error: () => this.snack.open('Failed to load system settings.', 'Close', { duration: 3000 }),
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.api.saveSystem(this.form.getRawValue() as any).subscribe({
      next: () => {
        this.saving.set(false);
        this.snack.open('System settings saved.', 'Close', { duration: 2500 });
      },
      error: err => {
        this.saving.set(false);
        this.snack.open(err?.error?.error ?? 'Save failed.', 'Close', { duration: 3500 });
      },
    });
  }
}
