import { Component, signal, inject } from '@angular/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { FormsModule } from '@angular/forms';
import { AuthService } from 'src/app/core/services/auth.service';

@Component({
  selector: 'app-side-login',
  standalone: true,
  imports: [CommonModule, RouterModule, MaterialModule, FormsModule, ReactiveFormsModule],
  templateUrl: './side-login.component.html',
})
export class AppSideLoginComponent {
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);

  loading      = signal(false);
  error        = signal('');
  hidePassword = signal(true);

  form = new FormGroup({
    uname:    new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required]),
  });

  get f() { return this.form.controls; }

  submit(): void {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set('');

    const { uname, password } = this.form.value;

    this.auth.login(uname!, password!).subscribe({
      next: (res) => {
        this.loading.set(false);
        // Platform admin → admin dashboard; tenant users → CRM
        this.router.navigate(
          res.isPlatformAdmin ? ['/platform-admin/dashboard'] : ['/crm/leads']
        );
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          err?.error?.errors?.[0] ??
          err?.error?.message ??
          err?.error?.error ??
          'Invalid email or password. Please try again.'
        );
      },
    });
  }
}
