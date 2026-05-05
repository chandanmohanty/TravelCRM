import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import {
  WhatsAppConfigWriteBody,
  WhatsAppProviderKind,
  WhatsAppSettingsService,
} from '../../../core/services/whatsapp-settings.service';

@Component({
  selector: 'app-whatsapp-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatCheckboxModule, MatSnackBarModule, MatDividerModule,
  ],
  template: `
    <div class="page-header m-b-24 d-flex align-items-center gap-8">
      <a mat-icon-button routerLink="/settings/whatsapp"><mat-icon>arrow_back</mat-icon></a>
      <h2 class="f-s-24 f-w-700 m-0">{{ isNew() ? 'New WhatsApp Provider' : 'Edit WhatsApp Provider' }}</h2>
    </div>

    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-card class="cardWithShadow m-b-24">
        <mat-card-content class="p-24">
          <mat-card-title class="m-b-16">Provider</mat-card-title>
          <div class="row">
            <div class="col-md-6 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Name</mat-label>
                <input matInput formControlName="name" placeholder="Gupshup — Production" />
              </mat-form-field>
            </div>
            <div class="col-md-6 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Provider</mat-label>
                <mat-select formControlName="provider">
                  <mat-option value="Gupshup">Gupshup</mat-option>
                  <mat-option value="Wati">WATI</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
            <div class="col-md-6 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Sender Phone (E.164)</mat-label>
                <input matInput formControlName="phoneNumber" placeholder="+919876543210" />
                <mat-hint>Your registered WhatsApp sender number.</mat-hint>
              </mat-form-field>
            </div>
            @if (form.value.provider === 'Gupshup') {
              <div class="col-md-6 m-b-16">
                <mat-form-field appearance="outline" class="w-100">
                  <mat-label>Gupshup App Name</mat-label>
                  <input matInput formControlName="appName" placeholder="MyApp" />
                  <mat-hint>The app/source name registered in Gupshup portal.</mat-hint>
                </mat-form-field>
              </div>
            }
            <div class="col-md-12 m-b-16">
              <mat-checkbox formControlName="isActive">
                Set as active (deactivates other configs in this tenant)
              </mat-checkbox>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="cardWithShadow m-b-24">
        <mat-card-content class="p-24">
          <mat-card-title class="m-b-16">Credentials</mat-card-title>
          <mat-form-field appearance="outline" class="w-100">
            <mat-label>{{ isNew() ? 'API Key / Access Token' : 'API Key (leave blank to keep existing)' }}</mat-label>
            <input matInput formControlName="apiKey" type="password" autocomplete="new-password" />
            <mat-hint>
              Stored encrypted at rest (ASP.NET Data Protection).
              @if (!isNew() && existingHasKey()) { An existing key is on file. }
            </mat-hint>
          </mat-form-field>
          @if (form.value.provider === 'Wati') {
            <mat-form-field appearance="outline" class="w-100 m-t-16">
              <mat-label>WATI Base URL</mat-label>
              <input matInput formControlName="baseUrl" placeholder="https://live-server.wati.io" />
              <mat-hint>Your WATI tenant URL. Find it in your WATI dashboard.</mat-hint>
            </mat-form-field>
          }
        </mat-card-content>
      </mat-card>

      <mat-card class="cardWithShadow">
        <mat-card-content class="p-24">
          <mat-divider class="m-b-16"></mat-divider>
          <div class="d-flex justify-content-end gap-8">
            <a mat-stroked-button routerLink="/settings/whatsapp">Cancel</a>
            <button mat-flat-button color="primary" type="submit"
                    [disabled]="form.invalid || saving()">
              <mat-icon>save</mat-icon> {{ saving() ? 'Saving…' : (isNew() ? 'Create' : 'Save Changes') }}
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    </form>
  `,
})
export class WhatsAppFormComponent implements OnInit {
  private readonly fb     = inject(FormBuilder);
  private readonly api    = inject(WhatsAppSettingsService);
  private readonly snack  = inject(MatSnackBar);
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly saving         = signal(false);
  readonly existingHasKey = signal(false);
  readonly isNew          = signal(true);

  form = this.fb.group({
    name:        ['', [Validators.required, Validators.maxLength(200)]],
    provider:    ['Gupshup' as WhatsAppProviderKind, Validators.required],
    phoneNumber: ['', [Validators.required, Validators.pattern(/^\+?\d{7,20}$/)]],
    appName:     [''],
    apiKey:      [''],
    baseUrl:     [''],
    isActive:    [true],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isNew.set(false);
      this.api.get(id).subscribe({
        next: c => {
          this.existingHasKey.set(c.hasApiKey);
          this.form.patchValue({
            name: c.name, provider: c.provider,
            phoneNumber: c.phoneNumber, appName: c.appName ?? '',
            apiKey: '', baseUrl: c.baseUrl ?? '', isActive: c.isActive,
          });
          this.form.controls.apiKey.clearValidators();
          this.form.controls.apiKey.updateValueAndValidity();
        },
        error: err => {
          this.snack.open(err?.error?.error ?? 'Failed to load config.', 'Close', { duration: 3500 });
          this.router.navigate(['/settings/whatsapp']);
        },
      });
    } else {
      this.form.controls.apiKey.addValidators(Validators.required);
      this.form.controls.apiKey.updateValueAndValidity();
    }
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    const body: WhatsAppConfigWriteBody = {
      name: v.name!, provider: v.provider!, phoneNumber: v.phoneNumber!,
      apiKey: v.apiKey || null, appName: v.appName || null,
      baseUrl: v.baseUrl || null, isActive: !!v.isActive,
    };

    const id = this.route.snapshot.paramMap.get('id');
    const call$ = (id && id !== 'new')
      ? this.api.update(id, body)
      : this.api.create(body);

    call$.subscribe({
      next: () => {
        this.saving.set(false);
        this.snack.open('WhatsApp config saved.', 'Close', { duration: 2500 });
        this.router.navigate(['/settings/whatsapp']);
      },
      error: err => {
        this.saving.set(false);
        this.snack.open(err?.error?.error ?? 'Save failed.', 'Close', { duration: 3500 });
      },
    });
  }
}
