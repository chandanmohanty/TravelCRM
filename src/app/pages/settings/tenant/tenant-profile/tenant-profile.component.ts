import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { TablerIconsModule } from 'angular-tabler-icons';

@Component({
  selector: 'app-tenant-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatSelectModule, MatIconModule,
    MatDividerModule, MatChipsModule, TablerIconsModule,
  ],
  template: `
    <div class="page-header m-b-24">
      <h2 class="f-s-24 f-w-700 m-0">Tenant Profile</h2>
      <p class="text-muted m-0 m-t-4">Manage your organisation's core information.</p>
    </div>

    <div class="form-layout">

      <!-- Identity Card -->
      <mat-card>
        <mat-card-header>
          <div class="card-title-row">
            <span class="iconify f-s-20 text-primary" data-icon="solar:buildings-3-line-duotone"></span>
            <mat-card-title>Organisation Identity</mat-card-title>
          </div>
        </mat-card-header>
        <mat-card-content class="p-t-16">
          <form [formGroup]="profileForm" (ngSubmit)="save()">
            <div class="field-row">
              <mat-form-field appearance="outline">
                <mat-label>Organisation Name</mat-label>
                <input matInput formControlName="name" placeholder="TravelCRM Demo">
                <mat-icon matPrefix>business</mat-icon>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Slug (URL identifier)</mat-label>
                <input matInput formControlName="slug" placeholder="demo">
                <span matPrefix class="slug-prefix">app.travelcrm.io /</span>
                @if (profileForm.get('slug')?.invalid && profileForm.get('slug')?.touched) {
                  <mat-error>Slug is required (lowercase, no spaces)</mat-error>
                }
              </mat-form-field>
            </div>

            <div class="field-row">
              <mat-form-field appearance="outline">
                <mat-label>Industry</mat-label>
                <mat-select formControlName="industry">
                  <mat-option value="travel">Travel & Tourism</mat-option>
                  <mat-option value="hospitality">Hospitality</mat-option>
                  <mat-option value="aviation">Aviation</mat-option>
                  <mat-option value="cruise">Cruise</mat-option>
                  <mat-option value="corporate">Corporate Travel</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Company Size</mat-label>
                <mat-select formControlName="size">
                  <mat-option value="1-10">1 – 10 employees</mat-option>
                  <mat-option value="11-50">11 – 50 employees</mat-option>
                  <mat-option value="51-200">51 – 200 employees</mat-option>
                  <mat-option value="201-500">201 – 500 employees</mat-option>
                  <mat-option value="500+">500+ employees</mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Website</mat-label>
              <input matInput formControlName="website" placeholder="https://yourcompany.com">
              <mat-icon matPrefix>language</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Support Email</mat-label>
              <input matInput formControlName="supportEmail" type="email">
              <mat-icon matPrefix>email</mat-icon>
            </mat-form-field>

            <div class="form-actions">
              <button mat-stroked-button type="button">Cancel</button>
              <button mat-raised-button color="primary" type="submit"
                      [disabled]="profileForm.pristine || profileForm.invalid">
                <mat-icon>save</mat-icon> Save Changes
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <!-- Current Plan Card -->
      <mat-card class="plan-card">
        <mat-card-header>
          <div class="card-title-row">
            <span class="iconify f-s-20 text-primary" data-icon="solar:crown-line-duotone"></span>
            <mat-card-title>Current Plan</mat-card-title>
          </div>
        </mat-card-header>
        <mat-card-content>
          <div class="plan-info">
            <div class="plan-badge enterprise">Enterprise</div>
            <div class="plan-meta">
              <div class="plan-meta-item">
                <span class="meta-label">Tenant ID</span>
                <code class="meta-value">00000000-0000-0000-0001</code>
              </div>
              <div class="plan-meta-item">
                <span class="meta-label">Status</span>
                <span class="status-active">Active</span>
              </div>
              <div class="plan-meta-item">
                <span class="meta-label">Users</span>
                <span>Unlimited</span>
              </div>
              <div class="plan-meta-item">
                <span class="meta-label">Data Region</span>
                <span>US East</span>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

    </div>
  `,
  styles: [`
    .page-header { margin-bottom: 24px; }
    .form-layout { display: flex; flex-direction: column; gap: 20px; max-width: 760px; }
    .card-title-row { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
    mat-card-content { padding: 16px !important; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .full-width { width: 100%; }
    mat-form-field { width: 100%; }
    .slug-prefix { font-size: 12px; color: #999; margin-right: 4px; }
    .form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px; }
    .plan-info { padding: 8px 0; }
    .plan-badge {
      display: inline-block; padding: 4px 14px; border-radius: 20px;
      font-size: 13px; font-weight: 700; margin-bottom: 16px;
    }
    .plan-badge.enterprise { background: #e8f5e9; color: #2e7d32; }
    .plan-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .plan-meta-item { display: flex; flex-direction: column; gap: 4px; }
    .meta-label { font-size: 11px; text-transform: uppercase; font-weight: 600; color: #999; }
    .meta-value { font-size: 11px; background: #f5f5f5; padding: 2px 6px; border-radius: 4px; }
    .status-active { color: #2e7d32; font-weight: 600; font-size: 13px; }
    @media (max-width: 600px) { .field-row, .plan-meta { grid-template-columns: 1fr; } }
  `],
})
export class TenantProfileComponent {
  private fb = new FormBuilder();

  profileForm = this.fb.group({
    name:         ['TravelCRM Demo', Validators.required],
    slug:         ['demo', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
    industry:     ['travel'],
    size:         ['11-50'],
    website:      ['https://travelcrm.io'],
    supportEmail: ['support@travelcrm.io', Validators.email],
  });

  save(): void {
    if (this.profileForm.invalid) return;
    // Will call PATCH /api/tenants/:id when backend endpoint is ready
    alert('Tenant profile saved (demo mode).');
    this.profileForm.markAsPristine();
  }
}
