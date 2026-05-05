import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { DataResetResult, DataResetService } from '../../../core/services/data-reset.service';

@Component({
  selector: 'app-data-reset',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule,
    MatSnackBarModule, MatDividerModule, MatListModule,
  ],
  template: `
    <div class="page-header m-b-24">
      <h2 class="f-s-24 f-w-700 m-0 text-error">
        <mat-icon class="v-align-middle">warning</mat-icon> Data Reset
      </h2>
      <p class="text-muted m-0 m-t-4">Dangerous: wipe tenant data. Kept: admin user, tenant row, and config tables.</p>
    </div>

    <mat-card class="cardWithShadow m-b-24">
      <mat-card-content class="p-24">
        <mat-card-title class="m-b-16">What will happen</mat-card-title>
        <div class="row">
          <div class="col-md-6">
            <h4 class="f-s-14 f-w-600 text-error m-t-0">🗑 Deleted</h4>
            <ul class="m-0 p-l-20">
              <li>All users except <strong>you</strong></li>
              <li>Audit logs + activity feed (tenant-scoped)</li>
              <li>Notifications</li>
              <li>Refresh &amp; password-reset tokens</li>
              <li>Per-tenant sequences (Employee IDs)</li>
              <li><em>Business data once features land (leads, invoices, …)</em></li>
            </ul>
          </div>
          <div class="col-md-6">
            <h4 class="f-s-14 f-w-600 text-success m-t-0">✅ Preserved</h4>
            <ul class="m-0 p-l-20">
              <li>Tenant record itself</li>
              <li>Your admin user</li>
              <li>Roles &amp; role-permission mappings</li>
              <li>Departments</li>
              <li>Brand / Storage / Email / System / Invoice settings</li>
            </ul>
          </div>
        </div>
      </mat-card-content>
    </mat-card>

    @if (!result()) {
      <mat-card class="cardWithShadow">
        <mat-card-content class="p-24">
          <mat-card-title class="m-b-8">Confirm</mat-card-title>
          <mat-card-subtitle class="m-b-24">
            Type <code>RESET</code> (uppercase, exact) into the field below, then press the red button.
            This cannot be undone.
          </mat-card-subtitle>
          <form [formGroup]="form" (ngSubmit)="execute()">
            <mat-form-field appearance="outline" class="w-100">
              <mat-label>Confirmation</mat-label>
              <input matInput formControlName="confirmation" autocomplete="off" placeholder="RESET" />
            </mat-form-field>
            <mat-divider class="m-y-16"></mat-divider>
            <div class="d-flex justify-content-end">
              <button mat-flat-button color="warn" type="submit"
                      [disabled]="form.invalid || executing()">
                <mat-icon>dangerous</mat-icon>
                {{ executing() ? 'Resetting…' : 'Reset Tenant Data' }}
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>
    } @else {
      <mat-card class="cardWithShadow">
        <mat-card-content class="p-24">
          <mat-card-title class="m-b-16 text-success">
            <mat-icon class="v-align-middle">check_circle</mat-icon> Reset complete
          </mat-card-title>
          <mat-list>
            <mat-list-item>Users deleted: <strong class="m-l-8">{{ result()!.usersDeleted }}</strong></mat-list-item>
            <mat-list-item>Audit logs deleted: <strong class="m-l-8">{{ result()!.auditLogsDeleted }}</strong></mat-list-item>
            <mat-list-item>Activity entries deleted: <strong class="m-l-8">{{ result()!.identityActivitiesDeleted }}</strong></mat-list-item>
            <mat-list-item>Notifications deleted: <strong class="m-l-8">{{ result()!.notificationsDeleted }}</strong></mat-list-item>
            <mat-list-item>Refresh tokens deleted: <strong class="m-l-8">{{ result()!.refreshTokensDeleted }}</strong></mat-list-item>
            <mat-list-item>Password-reset tokens deleted: <strong class="m-l-8">{{ result()!.passwordResetTokensDeleted }}</strong></mat-list-item>
            <mat-list-item>Employee sequences deleted: <strong class="m-l-8">{{ result()!.employeeSequencesDeleted }}</strong></mat-list-item>
          </mat-list>
          <div class="d-flex justify-content-end m-t-16">
            <button mat-stroked-button (click)="reloadForm()">
              <mat-icon>arrow_back</mat-icon> Back
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    }
  `,
  styles: [`
    .text-error   { color: #d32f2f; }
    .text-success { color: #2e7d32; }
    .v-align-middle { vertical-align: middle; }
  `],
})
export class DataResetComponent {
  private readonly fb    = inject(FormBuilder);
  private readonly api   = inject(DataResetService);
  private readonly snack = inject(MatSnackBar);

  readonly executing = signal(false);
  readonly result    = signal<DataResetResult | null>(null);

  form = this.fb.group({
    confirmation: ['', [Validators.required, Validators.pattern(/^RESET$/)]],
  });

  execute(): void {
    if (this.form.invalid) return;
    this.executing.set(true);
    this.api.reset(this.form.value.confirmation!).subscribe({
      next: r => {
        this.executing.set(false);
        this.result.set(r);
        this.snack.open('Tenant data reset successfully.', 'Close', { duration: 3000 });
      },
      error: err => {
        this.executing.set(false);
        this.snack.open(err?.error?.error ?? 'Reset failed.', 'Close', { duration: 4000 });
      },
    });
  }

  reloadForm(): void {
    this.result.set(null);
    this.form.reset({ confirmation: '' });
  }
}
