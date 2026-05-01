import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TablerIconsModule } from 'angular-tabler-icons';
import { InventoryTenantSettingsService } from 'src/app/core/services/inventory-tenant-settings.service';

@Component({
  selector: 'app-tenant-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatButtonModule, MatCardModule, MatFormFieldModule,
    MatIconModule, MatInputModule, MatProgressSpinnerModule,
    TablerIconsModule,
  ],
  template: `
    <div class="crm-page">
      <div class="page-header">
        <div class="page-title">
          <h2>Inventory Settings</h2>
          <span class="subtitle">Per-tenant defaults that govern hold lifecycle behavior.</span>
        </div>
      </div>

      @if (loading()) {
        <div class="spinner-wrap"><mat-spinner diameter="36"></mat-spinner></div>
      } @else {
        <mat-card class="form-card">
          <mat-card-content>
            <form [formGroup]="form" (ngSubmit)="save()" class="settings-form">
              <h4 class="section-h">Holds</h4>

              <mat-form-field appearance="outline" class="ttl-field">
                <mat-label>Hold TTL (hours)</mat-label>
                <input matInput type="number" formControlName="holdTtlHours" min="1" max="720" />
                <mat-hint>How long a hold is reserved before auto-expiring. Default 24h. Range 1–720h.</mat-hint>
                @if (form.controls.holdTtlHours.touched && form.controls.holdTtlHours.invalid) {
                  <mat-error>
                    @if (form.controls.holdTtlHours.errors?.['required']) {
                      A value is required
                    } @else {
                      Must be between 1 and 720
                    }
                  </mat-error>
                }
              </mat-form-field>

              @if (errorMessage()) {
                <div class="error-banner">
                  <i-tabler name="alert-circle" class="icon-sm"></i-tabler>
                  {{ errorMessage() }}
                </div>
              }
              @if (saved()) {
                <div class="success-banner">
                  <i-tabler name="check" class="icon-sm"></i-tabler>
                  Saved.
                </div>
              }

              <div class="form-actions">
                <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving()">
                  @if (saving()) {
                    <mat-spinner diameter="16" class="btn-spinner"></mat-spinner>
                  } @else {
                    <i-tabler name="check" class="icon-sm mr-1"></i-tabler>
                  }
                  Save Changes
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
    .mr-1 { margin-right: 4px; }
    .spinner-wrap { display: flex; justify-content: center; padding: 48px; }

    .form-card { max-width: 640px; }
    .form-card mat-card-content { padding: 24px; }
    .settings-form { display: flex; flex-direction: column; gap: 0; }
    .section-h { margin: 0 0 12px; font-size: 13px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.4px; }
    .ttl-field { width: 240px; }

    .error-banner {
      display: flex; align-items: center; gap: 8px;
      background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;
      padding: 10px 14px; border-radius: 8px; margin: 8px 0; font-size: 13px;
    }
    .success-banner {
      display: flex; align-items: center; gap: 8px;
      background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0;
      padding: 10px 14px; border-radius: 8px; margin: 8px 0; font-size: 13px;
    }

    .form-actions {
      display: flex; justify-content: flex-end;
      margin-top: 8px; padding-top: 16px; border-top: 1px solid #f1f5f9;
    }
    .btn-spinner { display: inline-block; margin-right: 8px; }
  `],
})
export class TenantSettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(InventoryTenantSettingsService);

  loading = signal(true);
  saving = signal(false);
  saved = signal(false);
  errorMessage = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    holdTtlHours: [24, [Validators.required, Validators.min(1), Validators.max(720)]],
  });

  ngOnInit(): void {
    this.api.get().subscribe({
      next: (s) => {
        this.form.patchValue({ holdTtlHours: s.holdTtlHours });
        this.loading.set(false);
      },
      error: (err) => {
        this.handleApiError(err, 'Failed to load settings');
        this.loading.set(false);
      },
    });
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.errorMessage.set(null);
    this.saved.set(false);

    const v = this.form.getRawValue();
    this.api.update({ holdTtlHours: v.holdTtlHours }).subscribe({
      next: (s) => {
        this.form.patchValue({ holdTtlHours: s.holdTtlHours });
        this.saving.set(false);
        this.saved.set(true);
        setTimeout(() => this.saved.set(false), 3000);
      },
      error: (err) => {
        this.handleApiError(err, 'Save failed');
        this.saving.set(false);
      },
    });
  }

  private handleApiError(err: any, fallback: string): void {
    const serverMsg = err?.error?.error as string | undefined;
    if (err?.status === 401) {
      this.errorMessage.set('Your session expired. Please log out and sign in again.');
    } else if (serverMsg?.toLowerCase().includes('tenant')) {
      this.errorMessage.set('Inventory settings are tenant-scoped. Platform Admin accounts cannot manage them.');
    } else if (err?.status === 403) {
      this.errorMessage.set('Only Admin users can edit inventory settings.');
    } else {
      this.errorMessage.set(serverMsg ?? fallback);
    }
  }
}
