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
  AiConfigWriteBody,
  AiProviderKind,
  AiSettingsService,
} from '../../../core/services/ai-settings.service';

interface ModelPreset { label: string; value: string; }

@Component({
  selector: 'app-ai-form',
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
      <a mat-icon-button routerLink="/settings/ai"><mat-icon>arrow_back</mat-icon></a>
      <h2 class="f-s-24 f-w-700 m-0">{{ isNew() ? 'New AI Provider' : 'Edit AI Provider' }}</h2>
    </div>

    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-card class="cardWithShadow m-b-24">
        <mat-card-content class="p-24">
          <mat-card-title class="m-b-16">Provider</mat-card-title>
          <div class="row">
            <div class="col-md-6 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Name</mat-label>
                <input matInput formControlName="name" placeholder="Claude Sonnet — Production" />
              </mat-form-field>
            </div>
            <div class="col-md-6 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Provider</mat-label>
                <mat-select formControlName="provider" (selectionChange)="onProviderChange($event.value)">
                  <mat-option value="Anthropic">Anthropic (Claude)</mat-option>
                  <mat-option value="OpenAI">OpenAI</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
            <div class="col-md-12 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Model</mat-label>
                <input matInput formControlName="model"
                       placeholder="claude-3-5-sonnet-20241022" />
                <mat-hint>
                  Suggestions:
                  @for (p of presets(); track p.value; let last = $last) {
                    <button type="button" class="preset-chip" (click)="applyPreset(p.value)">{{ p.label }}</button>
                    @if (!last) { <span>·</span> }
                  }
                </mat-hint>
              </mat-form-field>
            </div>
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
            <mat-label>{{ isNew() ? 'API key' : 'API key (leave blank to keep existing)' }}</mat-label>
            <input matInput formControlName="apiKey" type="password" autocomplete="new-password" />
            <mat-hint>
              Stored encrypted at rest (ASP.NET Data Protection).
              @if (!isNew() && existingHasKey()) { An existing key is on file. }
            </mat-hint>
          </mat-form-field>
          <mat-form-field appearance="outline" class="w-100 m-t-16">
            <mat-label>Base URL (optional)</mat-label>
            <input matInput formControlName="baseUrl" placeholder="https://api.anthropic.com" />
            <mat-hint>For Azure OpenAI or a proxy. Leave empty to use the provider's default.</mat-hint>
          </mat-form-field>
        </mat-card-content>
      </mat-card>

      <mat-card class="cardWithShadow">
        <mat-card-content class="p-24">
          <mat-card-title class="m-b-16">Parameters</mat-card-title>
          <div class="row">
            <div class="col-md-6 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Temperature (0.0 – 2.0)</mat-label>
                <input matInput type="number" step="0.1" min="0" max="2" formControlName="temperature" />
                <mat-hint>Leave blank to use provider default.</mat-hint>
              </mat-form-field>
            </div>
            <div class="col-md-6 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Max tokens</mat-label>
                <input matInput type="number" min="1" max="100000" formControlName="maxTokens" />
                <mat-hint>Leave blank to use provider default.</mat-hint>
              </mat-form-field>
            </div>
          </div>

          <mat-divider class="m-y-16"></mat-divider>
          <div class="d-flex justify-content-end gap-8">
            <a mat-stroked-button routerLink="/settings/ai">Cancel</a>
            <button mat-flat-button color="primary" type="submit"
                    [disabled]="form.invalid || saving()">
              <mat-icon>save</mat-icon> {{ saving() ? 'Saving…' : (isNew() ? 'Create' : 'Save Changes') }}
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    </form>
  `,
  styles: [`
    .preset-chip {
      border: 1px solid var(--mdc-outlined-button-outline-color, #ccc);
      background: transparent; padding: 2px 8px; border-radius: 10px;
      font-size: 11px; cursor: pointer; margin: 0 2px;
    }
    .preset-chip:hover { background: rgba(0,0,0,0.04); }
  `],
})
export class AiFormComponent implements OnInit {
  private readonly fb     = inject(FormBuilder);
  private readonly api    = inject(AiSettingsService);
  private readonly snack  = inject(MatSnackBar);
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly saving          = signal(false);
  readonly existingHasKey  = signal(false);
  readonly isNew           = signal(true);
  readonly presets         = signal<ModelPreset[]>(this.presetsFor('Anthropic'));

  form = this.fb.group({
    name:        ['', [Validators.required, Validators.maxLength(200)]],
    provider:    ['Anthropic' as AiProviderKind, Validators.required],
    model:       ['claude-3-5-sonnet-20241022', [Validators.required, Validators.maxLength(200)]],
    apiKey:      [''],
    baseUrl:     [''],
    temperature: [null as number | null],
    maxTokens:   [null as number | null],
    isActive:    [true],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isNew.set(false);
      this.api.get(id).subscribe({
        next: c => {
          this.existingHasKey.set(c.hasApiKey);
          this.presets.set(this.presetsFor(c.provider));
          this.form.patchValue({
            name: c.name, provider: c.provider, model: c.model,
            apiKey: '', baseUrl: c.baseUrl ?? '',
            temperature: c.temperature, maxTokens: c.maxTokens,
            isActive: c.isActive,
          });
          // On edit, API key is optional
          this.form.controls.apiKey.clearValidators();
          this.form.controls.apiKey.updateValueAndValidity();
        },
        error: err => {
          this.snack.open(err?.error?.error ?? 'Failed to load config.', 'Close', { duration: 3500 });
          this.router.navigate(['/settings/ai']);
        },
      });
    } else {
      // On new, API key is required
      this.form.controls.apiKey.addValidators(Validators.required);
      this.form.controls.apiKey.updateValueAndValidity();
    }
  }

  onProviderChange(p: AiProviderKind): void {
    this.presets.set(this.presetsFor(p));
    // Only overwrite model on new to avoid clobbering a user's saved choice
    if (this.isNew()) this.form.patchValue({ model: this.presets()[0]?.value ?? '' });
  }

  applyPreset(value: string): void { this.form.patchValue({ model: value }); }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    const body: AiConfigWriteBody = {
      name: v.name!, provider: v.provider!, model: v.model!,
      apiKey: v.apiKey || null, baseUrl: v.baseUrl || null,
      temperature: v.temperature, maxTokens: v.maxTokens,
      isActive: !!v.isActive,
    };

    const id = this.route.snapshot.paramMap.get('id');
    const call$ = (id && id !== 'new')
      ? this.api.update(id, body)
      : this.api.create(body);

    call$.subscribe({
      next: () => {
        this.saving.set(false);
        this.snack.open('AI config saved.', 'Close', { duration: 2500 });
        this.router.navigate(['/settings/ai']);
      },
      error: err => {
        this.saving.set(false);
        this.snack.open(err?.error?.error ?? 'Save failed.', 'Close', { duration: 3500 });
      },
    });
  }

  private presetsFor(p: AiProviderKind): ModelPreset[] {
    if (p === 'Anthropic') return [
      { label: 'Sonnet 3.5',  value: 'claude-3-5-sonnet-20241022' },
      { label: 'Haiku 3.5',   value: 'claude-3-5-haiku-20241022' },
      { label: 'Opus 3',      value: 'claude-3-opus-20240229' },
    ];
    return [
      { label: 'GPT-4o',      value: 'gpt-4o' },
      { label: 'GPT-4o mini', value: 'gpt-4o-mini' },
      { label: 'GPT-3.5',     value: 'gpt-3.5-turbo' },
    ];
  }
}
