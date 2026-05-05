import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastrService } from 'ngx-toastr';
import { IdentityApiService } from 'src/app/core/services/identity-api.service';

@Component({
  selector: 'app-change-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="page-header m-b-24">
      <h2 class="f-s-24 f-w-700 m-0">Change password</h2>
      <p class="text-muted m-0 m-t-4">Use a strong password with a mix of letters and digits.</p>
    </div>

    <div class="form-layout">
      <mat-card>
        <mat-card-content class="p-t-16">
          <form [formGroup]="form">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Current password</mat-label>
              <input matInput type="password" formControlName="currentPassword" autocomplete="current-password" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>New password</mat-label>
              <input matInput type="password" formControlName="newPassword" autocomplete="new-password" />
              <mat-hint>Minimum 8 characters with uppercase, lowercase and a digit.</mat-hint>
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Confirm new password</mat-label>
              <input matInput type="password" formControlName="confirmPassword" autocomplete="new-password" />
              @if (form.errors?.['mismatch'] && form.get('confirmPassword')?.touched) {
                <mat-error>Passwords do not match.</mat-error>
              }
            </mat-form-field>

            <div class="form-actions m-t-8">
              <button mat-raised-button color="primary" (click)="save()"
                      [disabled]="form.invalid || saving()">
                @if (saving()) { <mat-spinner diameter="16"></mat-spinner> }
                @else { <mat-icon>save</mat-icon> }
                <span>Change password</span>
              </button>
              <button mat-stroked-button type="button" (click)="goBack()">Cancel</button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-header { margin-bottom: 24px; }
    .form-layout { max-width: 500px; }
    .full-width { width: 100%; }
    mat-form-field { width: 100%; }
    mat-card-content { padding: 16px !important; }
    .form-actions { display: flex; gap: 12px; }
    .form-actions button { display: inline-flex; align-items: center; gap: 6px; }
    .m-t-8 { margin-top: 8px; }
  `],
})
export class ChangePasswordComponent {
  private readonly fb     = inject(FormBuilder);
  private readonly api    = inject(IdentityApiService);
  private readonly toastr = inject(ToastrService);
  private readonly loc    = inject(Location);

  readonly saving = signal(false);

  readonly form = this.fb.group({
    currentPassword: ['', Validators.required],
    newPassword:     ['', [Validators.required, Validators.minLength(8),
                            Validators.pattern(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)]],
    confirmPassword: ['', Validators.required],
  }, { validators: (g) => {
    const n = g.get('newPassword')?.value;
    const c = g.get('confirmPassword')?.value;
    return n && c && n !== c ? { mismatch: true } : null;
  }});

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    this.api.changeMyPassword({
      currentPassword: v.currentPassword!,
      newPassword:     v.newPassword!,
    }).subscribe({
      next: () => {
        this.toastr.success('Password changed successfully.');
        this.saving.set(false);
        this.goBack();
      },
      error: err => {
        this.toastr.error(err?.error?.error || 'Failed to change password.');
        this.saving.set(false);
      },
    });
  }

  goBack(): void { this.loc.back(); }
}
