import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  input,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastrService } from 'ngx-toastr';
import { BrandApiService } from 'src/app/core/services/brand-api.service';
import { BrandContextService } from 'src/app/core/services/brand-context.service';
import {
  BrandAssetKind,
  BrandSettings,
} from 'src/app/core/models/brand-settings.model';
import { API_BASE_URL } from 'src/app/core/tokens/api-base-url.token';

type BrandScope = 'tenant' | 'platform';

/**
 * Brand Settings form used for both scopes. The scope comes from the route data
 * (`{ data: { scope: 'tenant' } }`) or from the `scope` input when used inline.
 * Renders three asset uploaders (light / dark logo, favicon) plus the non-asset
 * text fields (display name, primary colour, support email + URL).
 */
@Component({
  selector: 'app-brand-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="page-header m-b-24">
      <h2 class="f-s-24 f-w-700 m-0">Brand Settings</h2>
      <p class="text-muted m-0 m-t-4">
        @if (scope() === 'platform') {
          Application-wide defaults shown to every tenant that hasn't overridden them.
        } @else {
          Customise your organisation's logos, favicon and support contacts.
        }
      </p>
    </div>

    @if (loading()) {
      <div class="loading-wrap"><mat-spinner diameter="32"></mat-spinner></div>
    } @else {

    <div class="form-layout">

      <!-- ────────────────── Application Logos ────────────────── -->
      <mat-card>
        <mat-card-header>
          <div class="card-title-row">
            <mat-icon class="text-primary">image</mat-icon>
            <mat-card-title>Application Logos</mat-card-title>
          </div>
          <p class="card-sub">Upload logos for light and dark display contexts.</p>
        </mat-card-header>
        <mat-card-content class="p-t-16">

          <!-- Logo Light -->
          <div class="asset-row">
            <div class="asset-meta">
              <h4 class="asset-title">Logo (Light Mode)</h4>
              <p class="asset-hint">Main navigation logo on light backgrounds. PNG/SVG, 200×60px.</p>
            </div>
            <div class="asset-preview light">
              @if (currentUrls().logoLightUrl; as url) {
                <img [src]="url" alt="logo light" />
              } @else {
                <div class="placeholder">
                  <mat-icon>image_not_supported</mat-icon>
                  <span>No logo</span>
                </div>
              }
            </div>
            <div class="asset-upload">
              <input
                #logoLightInput
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                (change)="onFileSelected('LogoLight', logoLightInput)"
                hidden />
              <button
                mat-stroked-button
                color="primary"
                type="button"
                [disabled]="uploading() === 'LogoLight'"
                (click)="logoLightInput.click()">
                @if (uploading() === 'LogoLight') {
                  <mat-spinner diameter="16"></mat-spinner>
                } @else {
                  <mat-icon>cloud_upload</mat-icon>
                }
                <span>Upload</span>
              </button>
            </div>
          </div>

          <mat-divider></mat-divider>

          <!-- Logo Dark -->
          <div class="asset-row">
            <div class="asset-meta">
              <h4 class="asset-title">Logo (Dark Mode)</h4>
              <p class="asset-hint">Shown on dark / sidebar backgrounds. Usually a white version.</p>
            </div>
            <div class="asset-preview dark">
              @if (currentUrls().logoDarkUrl; as url) {
                <img [src]="url" alt="logo dark" />
              } @else {
                <div class="placeholder">
                  <mat-icon>image_not_supported</mat-icon>
                  <span>No logo</span>
                </div>
              }
            </div>
            <div class="asset-upload">
              <input
                #logoDarkInput
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                (change)="onFileSelected('LogoDark', logoDarkInput)"
                hidden />
              <button
                mat-stroked-button
                color="primary"
                type="button"
                [disabled]="uploading() === 'LogoDark'"
                (click)="logoDarkInput.click()">
                @if (uploading() === 'LogoDark') {
                  <mat-spinner diameter="16"></mat-spinner>
                } @else {
                  <mat-icon>cloud_upload</mat-icon>
                }
                <span>Upload</span>
              </button>
            </div>
          </div>

          <mat-divider></mat-divider>

          <!-- Favicon -->
          <div class="asset-row">
            <div class="asset-meta">
              <h4 class="asset-title">Favicon</h4>
              <p class="asset-hint">Browser tab icon. PNG or ICO, 32×32px.</p>
            </div>
            <div class="asset-preview light small">
              @if (currentUrls().faviconUrl; as url) {
                <img [src]="url" alt="favicon" />
              } @else {
                <div class="placeholder">
                  <mat-icon>public</mat-icon>
                </div>
              }
            </div>
            <div class="asset-upload">
              <input
                #faviconInput
                type="file"
                accept="image/png,image/x-icon,image/vnd.microsoft.icon"
                (change)="onFileSelected('Favicon', faviconInput)"
                hidden />
              <button
                mat-stroked-button
                color="primary"
                type="button"
                [disabled]="uploading() === 'Favicon'"
                (click)="faviconInput.click()">
                @if (uploading() === 'Favicon') {
                  <mat-spinner diameter="16"></mat-spinner>
                } @else {
                  <mat-icon>cloud_upload</mat-icon>
                }
                <span>Upload</span>
              </button>
            </div>
          </div>

        </mat-card-content>
      </mat-card>

      <!-- ────────────────── Identity & Contacts ────────────────── -->
      <mat-card>
        <mat-card-header>
          <div class="card-title-row">
            <mat-icon class="text-primary">palette</mat-icon>
            <mat-card-title>Identity & Contacts</mat-card-title>
          </div>
          <p class="card-sub">Display name, brand colour and support details.</p>
        </mat-card-header>
        <mat-card-content class="p-t-16">
          <form [formGroup]="form" (ngSubmit)="save()">

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Display Name</mat-label>
              <input matInput formControlName="displayName" maxlength="200" placeholder="TravelCRM" />
              <mat-icon matPrefix>badge</mat-icon>
            </mat-form-field>

            <div class="field-row">
              <mat-form-field appearance="outline">
                <mat-label>Primary Colour</mat-label>
                <input matInput formControlName="primaryColorHex" placeholder="#5D87FF" maxlength="7" />
                @if (form.get('primaryColorHex')?.invalid && form.get('primaryColorHex')?.touched) {
                  <mat-error>Hex value like #5D87FF required.</mat-error>
                }
              </mat-form-field>
              <div class="colour-swatch" [style.background]="form.value.primaryColorHex || '#EEE'"></div>
            </div>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Support Email</mat-label>
              <input matInput formControlName="supportEmail" type="email" maxlength="256"
                     placeholder="support@yourcompany.com" />
              <mat-icon matPrefix>email</mat-icon>
              @if (form.get('supportEmail')?.invalid && form.get('supportEmail')?.touched) {
                <mat-error>Must be a valid email.</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Support URL</mat-label>
              <input matInput formControlName="supportUrl" maxlength="500"
                     placeholder="https://help.yourcompany.com" />
              <mat-icon matPrefix>link</mat-icon>
            </mat-form-field>

            <div class="form-actions">
              <button mat-stroked-button type="button" (click)="resetForm()">Reset</button>
              <button
                mat-raised-button
                color="primary"
                type="submit"
                [disabled]="form.pristine || form.invalid || saving()">
                @if (saving()) {
                  <mat-spinner diameter="16"></mat-spinner>
                } @else {
                  <mat-icon>save</mat-icon>
                }
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

    </div>

    }
  `,
  styles: [`
    .page-header { margin-bottom: 24px; }
    .loading-wrap { display: flex; justify-content: center; padding: 40px; }
    .form-layout { display: flex; flex-direction: column; gap: 20px; max-width: 860px; }
    .card-title-row { display: flex; align-items: center; gap: 10px; margin-bottom: 2px; }
    .card-title-row mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .card-sub { color: #8695ad; font-size: 12px; margin: 0 0 0 30px; }
    mat-card-content { padding: 16px !important; }
    mat-divider { margin: 4px 0; }

    .asset-row {
      display: grid;
      grid-template-columns: 1fr 240px auto;
      gap: 16px;
      align-items: center;
      padding: 12px 0;
    }
    .asset-meta .asset-title { margin: 0 0 2px 0; font-size: 14px; font-weight: 600; }
    .asset-meta .asset-hint  { margin: 0; font-size: 12px; color: #8695ad; }
    .asset-preview {
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px dashed rgba(0,0,0,.12);
      border-radius: 8px;
      min-height: 64px;
      padding: 8px;
    }
    .asset-preview.dark { background: #1a223c; border-color: rgba(255,255,255,.1); }
    .asset-preview.light { background: #f4f6fa; }
    .asset-preview.small { min-height: 48px; }
    .asset-preview img { max-height: 60px; max-width: 100%; object-fit: contain; }
    .placeholder {
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      color: #8695ad; font-size: 11px;
    }
    .asset-preview.dark .placeholder { color: #5a6682; }
    .placeholder mat-icon { font-size: 20px; width: 20px; height: 20px; }

    .full-width { width: 100%; }
    .field-row { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center; }
    .colour-swatch {
      width: 48px; height: 48px; border-radius: 8px;
      border: 1px solid rgba(0,0,0,.08);
    }
    mat-form-field { width: 100%; }

    .form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 12px; }
    .form-actions button { display: inline-flex; align-items: center; gap: 6px; }

    @media (max-width: 720px) {
      .asset-row { grid-template-columns: 1fr; gap: 8px; }
    }
  `],
})
export class BrandSettingsComponent implements OnInit {
  // Allow setting the scope via route data or as a bound input.
  readonly scope = input<BrandScope>('tenant');

  private readonly fb        = inject(FormBuilder);
  private readonly api       = inject(BrandApiService);
  private readonly brandCtx  = inject(BrandContextService);
  private readonly toastr    = inject(ToastrService);
  private readonly base      = inject(API_BASE_URL);

  readonly loading  = signal(true);
  readonly saving   = signal(false);
  /** Name of the asset currently being uploaded, or null. */
  readonly uploading = signal<BrandAssetKind | null>(null);

  private readonly record = signal<BrandSettings | null>(null);

  /** URLs absolutised for the preview panels (API_BASE_URL + relative path). */
  readonly currentUrls = computed(() => {
    const r = this.record();
    return {
      logoLightUrl: this.absolutise(r?.logoLightUrl ?? null),
      logoDarkUrl:  this.absolutise(r?.logoDarkUrl  ?? null),
      faviconUrl:   this.absolutise(r?.faviconUrl   ?? null),
    };
  });

  readonly form = this.fb.group({
    displayName:     this.fb.control<string>('', { nonNullable: true }),
    primaryColorHex: this.fb.control<string>('', {
      nonNullable: true,
      validators: [Validators.pattern(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$|^$/)],
    }),
    supportEmail:    this.fb.control<string>('', {
      nonNullable: true,
      validators: [Validators.email],
    }),
    supportUrl:      this.fb.control<string>('', { nonNullable: true }),
  });

  ngOnInit(): void {
    // Must be ngOnInit — not the constructor — because Angular binds route data
    // to the `scope` input AFTER construction. Reading `scope()` in the constructor
    // would return the default 'tenant' even on the platform-admin route.
    this.loadRecord();
  }

  private loadRecord(): void {
    this.loading.set(true);
    const obs$ = this.scope() === 'platform'
      ? this.api.getPlatformBrand()
      : this.api.getTenantBrand();

    obs$.subscribe({
      next: (rec) => {
        this.record.set(rec);
        this.form.patchValue({
          displayName:     rec.displayName     ?? '',
          primaryColorHex: rec.primaryColorHex ?? '',
          supportEmail:    rec.supportEmail    ?? '',
          supportUrl:      rec.supportUrl      ?? '',
        });
        this.form.markAsPristine();
        this.loading.set(false);
      },
      error: (err) => {
        this.toastr.error(err?.error?.error || 'Failed to load brand settings.');
        this.loading.set(false);
      },
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    const body = {
      displayName:     this.form.value.displayName     || null,
      primaryColorHex: this.form.value.primaryColorHex || null,
      supportEmail:    this.form.value.supportEmail    || null,
      supportUrl:      this.form.value.supportUrl      || null,
    };
    const save$ = this.scope() === 'platform'
      ? this.api.updatePlatformBrand(body)
      : this.api.updateTenantBrand(body);

    save$.subscribe({
      next: (rec) => {
        this.record.set(rec);
        this.form.markAsPristine();
        this.saving.set(false);
        this.toastr.success('Brand settings saved.');
        // Re-fetch resolved brand so the sidebar picks up the changes immediately.
        this.brandCtx.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.toastr.error(err?.error?.error || 'Failed to save brand settings.');
      },
    });
  }

  onFileSelected(kind: BrandAssetKind, inputEl: HTMLInputElement): void {
    const file = inputEl.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      this.toastr.error('File exceeds 5 MB limit.');
      return;
    }

    this.uploading.set(kind);
    const obs$ = this.scope() === 'platform'
      ? this.api.uploadPlatformAsset(kind, file)
      : this.api.uploadTenantAsset(kind, file);

    obs$.subscribe({
      next: (res) => {
        // Patch the local record so the preview updates instantly
        const current = this.record();
        if (current) {
          const updated: BrandSettings = { ...current };
          if (kind === 'LogoLight') updated.logoLightUrl = res.url;
          if (kind === 'LogoDark')  updated.logoDarkUrl  = res.url;
          if (kind === 'Favicon')   updated.faviconUrl   = res.url;
          this.record.set(updated);
        }
        this.uploading.set(null);
        inputEl.value = '';
        this.toastr.success(`${this.prettyKind(kind)} uploaded.`);
        this.brandCtx.load();
      },
      error: (err) => {
        this.uploading.set(null);
        inputEl.value = '';
        this.toastr.error(err?.error?.error || 'Upload failed.');
      },
    });
  }

  resetForm(): void {
    const r = this.record();
    this.form.patchValue({
      displayName:     r?.displayName     ?? '',
      primaryColorHex: r?.primaryColorHex ?? '',
      supportEmail:    r?.supportEmail    ?? '',
      supportUrl:      r?.supportUrl      ?? '',
    });
    this.form.markAsPristine();
  }

  private absolutise(url: string | null): string | null {
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith('/')) return `${this.base}${url}`;
    return url;
  }

  private prettyKind(kind: BrandAssetKind): string {
    switch (kind) {
      case 'LogoLight': return 'Logo (light)';
      case 'LogoDark':  return 'Logo (dark)';
      case 'Favicon':   return 'Favicon';
    }
  }
}
