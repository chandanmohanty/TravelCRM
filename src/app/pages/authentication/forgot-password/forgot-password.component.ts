import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { IdentityApiService } from 'src/app/core/services/identity-api.service';

@Component({
  selector: 'app-forgot-password',
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
        @if (!submitted()) {
          <h1 class="f-s-24 f-w-700 m-0">Forgot your password?</h1>
          <p class="text-muted m-t-4 m-b-24">
            Enter your email and we'll send you a link to reset it.
          </p>

          <form [formGroup]="form" (ngSubmit)="submit()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Email</mat-label>
              <input matInput type="email" formControlName="email" autocomplete="email" />
              <mat-icon matPrefix>email</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Tenant (workspace) slug</mat-label>
              <input matInput formControlName="tenantSlug" placeholder="demo" />
              <mat-hint>Leave empty if you're a platform admin.</mat-hint>
            </mat-form-field>

            <button mat-raised-button color="primary" type="submit"
                    class="full-width m-t-8"
                    [disabled]="form.invalid || submitting()">
              @if (submitting()) { <mat-spinner diameter="18"></mat-spinner> }
              @else { <mat-icon>send</mat-icon> }
              <span>Send reset link</span>
            </button>
          </form>
        } @else {
          <h1 class="f-s-24 f-w-700 m-0">Check your inbox</h1>
          <p class="text-muted m-t-8">
            If an account exists for <strong>{{ form.value.email }}</strong>, a
            password reset link has been sent. The link will expire in 60 minutes.
          </p>
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
    button { display: inline-flex !important; align-items: center; gap: 6px; }
    .form-footer { display: flex; justify-content: center; }
    .form-footer a { display: inline-flex; align-items: center; gap: 4px; text-decoration: none; }
  `],
})
export class ForgotPasswordComponent {
  private readonly fb  = inject(FormBuilder);
  private readonly api = inject(IdentityApiService);

  readonly submitting = signal(false);
  readonly submitted  = signal(false);

  readonly form = this.fb.group({
    email:      ['', [Validators.required, Validators.email]],
    tenantSlug: ['demo'],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.submitting.set(true);
    const v = this.form.getRawValue();
    this.api.forgotPassword({
      email: v.email!,
      tenantSlug: v.tenantSlug || null,
    }).subscribe({
      next: () => { this.submitting.set(false); this.submitted.set(true); },
      // Even on network error, show success (enumeration-safe UX)
      error: () => { this.submitting.set(false); this.submitted.set(true); },
    });
  }
}
