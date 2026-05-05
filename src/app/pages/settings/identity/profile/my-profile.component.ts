import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastrService } from 'ngx-toastr';
import { IdentityApiService } from 'src/app/core/services/identity-api.service';
import { MyProfileDto } from 'src/app/core/models/identity.model';

@Component({
  selector: 'app-my-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterModule, ReactiveFormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatChipsModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="page-header m-b-24">
      <h2 class="f-s-24 f-w-700 m-0">My Profile</h2>
      <p class="text-muted m-0 m-t-4">Update your personal details and preferences.</p>
    </div>

    @if (loading()) {
      <div class="loading-wrap"><mat-spinner diameter="32"></mat-spinner></div>
    } @else {
    <div class="form-layout">
      <mat-card>
        <mat-card-header>
          <div class="card-title-row">
            <mat-icon class="text-primary">person</mat-icon>
            <div>
              <mat-card-title>Personal details</mat-card-title>
              <p class="card-sub">{{ profile()?.email }}</p>
            </div>
            <span class="spacer"></span>
            <a mat-stroked-button color="primary" routerLink="../change-password">
              <mat-icon>lock</mat-icon> Change password
            </a>
          </div>
        </mat-card-header>
        <mat-card-content class="p-t-16">
          <form [formGroup]="form">
            <div class="field-row">
              <mat-form-field appearance="outline">
                <mat-label>First name</mat-label>
                <input matInput formControlName="firstName" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Last name</mat-label>
                <input matInput formControlName="lastName" />
              </mat-form-field>
            </div>
            <div class="field-row">
              <mat-form-field appearance="outline">
                <mat-label>Phone</mat-label>
                <input matInput formControlName="phone" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Job title</mat-label>
                <input matInput formControlName="jobTitle" />
              </mat-form-field>
            </div>

            <div class="field-row three-col">
              <mat-form-field appearance="outline">
                <mat-label>Preferred language</mat-label>
                <input matInput formControlName="preferredLanguage" placeholder="en" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Timezone</mat-label>
                <input matInput formControlName="timeZone" placeholder="UTC" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Currency</mat-label>
                <input matInput formControlName="currencyCode" maxlength="5" placeholder="USD" />
              </mat-form-field>
            </div>

            <div class="form-actions m-t-8">
              <button mat-raised-button color="primary" (click)="save()"
                      [disabled]="form.invalid || saving()">
                @if (saving()) { <mat-spinner diameter="16"></mat-spinner> }
                @else { <mat-icon>save</mat-icon> }
                <span>Save changes</span>
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <mat-card>
        <mat-card-header>
          <div class="card-title-row">
            <mat-icon class="text-primary">admin_panel_settings</mat-icon>
            <div>
              <mat-card-title>Roles & Permissions</mat-card-title>
              <p class="card-sub">What you can access</p>
            </div>
          </div>
        </mat-card-header>
        <mat-card-content class="p-t-16">
          <div class="muted-label">Roles</div>
          <mat-chip-set>
            @for (r of profile()?.roles; track r) { <mat-chip>{{ r }}</mat-chip> }
          </mat-chip-set>
          <div class="muted-label m-t-16">Permissions ({{ profile()?.permissions?.length || 0 }})</div>
          <div class="perm-list">
            @for (p of profile()?.permissions; track p) {
              <code class="perm-slug">{{ p }}</code>
            }
            @if (!profile()?.permissions?.length) {
              <div class="text-muted">No direct permissions. Contact your admin.</div>
            }
          </div>
        </mat-card-content>
      </mat-card>
    </div>
    }
  `,
  styles: [`
    .page-header { margin-bottom: 24px; }
    .loading-wrap { display: flex; justify-content: center; padding: 40px; }
    .form-layout { display: flex; flex-direction: column; gap: 20px; max-width: 860px; }
    .card-title-row { display: flex; align-items: center; gap: 10px; width: 100%; }
    .card-title-row .spacer { flex: 1; }
    .card-sub { color: #8695ad; font-size: 12px; margin: 0; }
    mat-card-content { padding: 16px !important; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .field-row.three-col { grid-template-columns: 1fr 1fr 1fr; }
    mat-form-field { width: 100%; }
    .form-actions { display: flex; gap: 12px; }
    .form-actions button { display: inline-flex; align-items: center; gap: 6px; }
    .m-t-8 { margin-top: 8px; } .m-t-16 { margin-top: 16px; }
    .muted-label { font-size: 11px; text-transform: uppercase; font-weight: 600; color: #8695ad; letter-spacing: 0.3px; margin-bottom: 8px; }
    .perm-list { display: flex; flex-wrap: wrap; gap: 6px; }
    .perm-slug { font-family: ui-monospace, monospace; font-size: 11px; color: #3b4252; background: #f4f6fa; padding: 2px 8px; border-radius: 4px; }
    @media (max-width: 720px) { .field-row, .field-row.three-col { grid-template-columns: 1fr; } }
  `],
})
export class MyProfileComponent implements OnInit {
  private readonly fb     = inject(FormBuilder);
  private readonly api    = inject(IdentityApiService);
  private readonly toastr = inject(ToastrService);

  readonly loading = signal(true);
  readonly saving  = signal(false);
  readonly profile = signal<MyProfileDto | null>(null);

  readonly form = this.fb.group({
    firstName:         ['', Validators.required],
    lastName:          ['', Validators.required],
    phone:             [''],
    jobTitle:          [''],
    preferredLanguage: ['en'],
    timeZone:          ['UTC'],
    currencyCode:      ['USD'],
  });

  ngOnInit(): void {
    this.api.getMyProfile().subscribe({
      next: p => {
        this.profile.set(p);
        this.form.patchValue({
          firstName:         p.firstName,
          lastName:          p.lastName,
          phone:             p.phone ?? '',
          jobTitle:          p.jobTitle ?? '',
          preferredLanguage: p.preferredLanguage,
          timeZone:          p.timeZone,
          currencyCode:      p.currencyCode,
        });
        this.loading.set(false);
      },
      error: err => {
        this.toastr.error(err?.error?.error || 'Failed to load profile.');
        this.loading.set(false);
      },
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    this.api.updateMyProfile({
      firstName:         v.firstName!,
      lastName:          v.lastName!,
      phone:             v.phone || null,
      jobTitle:          v.jobTitle || null,
      preferredLanguage: v.preferredLanguage || null,
      timeZone:          v.timeZone || null,
      currencyCode:      v.currencyCode || null,
    }).subscribe({
      next: () => { this.toastr.success('Profile updated.'); this.saving.set(false); },
      error: err => { this.toastr.error(err?.error?.error || 'Failed.'); this.saving.set(false); },
    });
  }
}
