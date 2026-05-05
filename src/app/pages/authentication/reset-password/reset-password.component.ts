import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { IdentityApiService } from 'src/app/core/services/identity-api.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterModule, ReactiveFormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <mat-card class="auth-card">
      <mat-card-content>
        @if (!completed() && !linkInvalid()) {
          <h1 class="f-s-24 f-w-700 m-0">Set a new password</h1>
          <p class="text-muted m-t-4 m-b-24">Choose a strong password you haven't used before.</p>

          <form [formGroup]="form" (ngSubmit)="submit()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>New password</mat-label>
              <input matInput type="password" formControlName="newPassword" autocomplete="new-password" />
              <mat-hint>Min 8 chars with uppercase, lowercase, and a digit.</mat-hint>
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Confirm new password</mat-label>
              <input matInput type="password" formControlName="confirmPassword" autocomplete="new-password" />
              @if (form.errors?.['mismatch'] && form.get('confirmPassword')?.touched) {
                <mat-error>Passwords do not match.</mat-error>
              }
            </mat-form-field>

            @if (error()) {
              <div class="error-message">
                <mat-icon class="error-icon">error</mat-icon>
                <span>{{ error() }}</span>
              </div>
            }

            <button mat-raised-button color="primary" type="submit"
                    class="full-width m-t-8"
                    [disabled]="form.invalid || submitting()">
              @if (submitting()) { <mat-spinner diameter="18"></mat-spinner> }
              @else { <mat-icon>lock_reset</mat-icon> }
              <span>Set password</span>
            </button>
          </form>
        } @else if (completed()) {
          <h1 class="f-s-24 f-w-700 m-0">Password changed</h1>
          <p class="text-muted m-t-8">
            Your password has been updated. You can now sign in with your new password.
          </p>
          <a mat-raised-button color="primary" routerLink="/authentication/login"
             class="full-width m-t-16">
            <mat-icon>login</mat-icon> Go to sign in
          </a>
        } @else {
          <h1 class="f-s-24 f-w-700 m-0">Invalid link</h1>
          <p class="text-muted m-t-8">
            This reset link is missing required information. Please request a new one.
          </p>
          <a mat-raised-button color="primary" routerLink="/authentication/forgot-password"
             class="full-width m-t-16">
            <mat-icon>send</mat-icon> Request new link
          </a>
        }

        <div class="form-footer m-t-16">
          <a routerLink="/authentication/login" class="text-primary f-s-14">
            <mat-icon class="f-s-16">arrow_back</mat-icon> Back to sign in
          </a>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .auth-card { max-width: 440px; margin: 40px auto; padding: 8px; }
    mat-card-content { padding: 24px !important; }
    .full-width { width: 100%; }
    mat-form-field { width: 100%; }
    .m-t-4 { margin-top: 4px; } .m-t-8 { margin-top: 8px; }
    .m-t-16 { margin-top: 16px; } .m-b-24 { margin-bottom: 24px; }
    button, a[mat-raised-button] { display: inline-flex !important; align-items: center; gap: 6px; }
    .form-footer { display: flex; justify-content: center; }
    .form-footer a { display: inline-flex; align-items: center; gap: 4px; text-decoration: none; }
    .error-message { display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: #fff0f0; border-radius: 6px; color: #b71c1c; font-size: 13px; margin: 8px 0; }
    .error-icon { font-size: 18px; width: 18px; height: 18px; }
  `],
})
export class ResetPasswordComponent implements OnInit {
  private readonly fb    = inject(FormBuilder);
  private readonly api   = inject(IdentityApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly submitting  = signal(false);
  readonly completed   = signal(false);
  readonly linkInvalid = signal(false);
  readonly error       = signal<string | null>(null);

  private uid   = '';
  private token = '';

  readonly form = this.fb.group({
    newPassword:     ['', [Validators.required, Validators.minLength(8),
                            Validators.pattern(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)]],
    confirmPassword: ['', Validators.required],
  }, { validators: (g) => {
    const n = g.get('newPassword')?.value;
    const c = g.get('confirmPassword')?.value;
    return n && c && n !== c ? { mismatch: true } : null;
  }});

  ngOnInit(): void {
    this.uid   = this.route.snapshot.queryParamMap.get('uid')   ?? '';
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.uid || !this.token) this.linkInvalid.set(true);
  }

  submit(): void {
    if (this.form.invalid || !this.uid || !this.token) return;
    this.submitting.set(true);
    this.error.set(null);

    this.api.resetPassword({
      uid:         this.uid,
      token:       this.token,
      newPassword: this.form.value.newPassword!,
    }).subscribe({
      next: () => { this.submitting.set(false); this.completed.set(true); },
      error: err => {
        this.submitting.set(false);
        this.error.set(err?.error?.error || 'The link may have expired or already been used.');
      },
    });
  }
}
