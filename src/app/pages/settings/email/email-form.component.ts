import {
  Component, ChangeDetectionStrategy, inject, signal, input, OnInit, computed,
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastrService } from 'ngx-toastr';
import { EmailApiService } from 'src/app/core/services/email-api.service';
import {
  EmailConfigDto,
  EmailConfigRequest,
  EmailProvider,
  PROVIDER_LABELS,
  isSmtpProvider,
  isApiProvider,
} from 'src/app/core/models/email-config.model';

type Scope = 'tenant' | 'platform';

@Component({
  selector: 'app-email-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatCheckboxModule, MatSlideToggleModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="form-layout">

      <!-- ────────── Header Card ────────── -->
      <mat-card>
        <mat-card-header>
          <div class="card-title-row">
            <mat-icon class="text-primary">mail</mat-icon>
            <div>
              <mat-card-title>{{ isEdit() ? 'Edit' : 'Add' }} Email Configuration</mat-card-title>
              <p class="card-sub">Set up a new SMTP or API-based email provider</p>
            </div>
            <span class="spacer"></span>
            <button mat-stroked-button type="button" (click)="goBack()">
              <mat-icon>arrow_back</mat-icon> Back
            </button>
          </div>
        </mat-card-header>
        <mat-card-content class="p-t-16">
          <form [formGroup]="form">
            <div class="field-row">
              <mat-form-field appearance="outline">
                <mat-label>Configuration Name</mat-label>
                <input matInput formControlName="name" placeholder="e.g. SendGrid Production" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Email Provider</mat-label>
                <mat-select formControlName="provider">
                  @for (p of providers; track p.value) {
                    <mat-option [value]="p.value">{{ p.label }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <!-- ────────── SMTP / Server Settings (for SMTP providers) ────────── -->
      @if (showSmtp()) {
        <mat-card>
          <mat-card-header>
            <div class="card-title-row">
              <mat-icon class="text-primary">dns</mat-icon>
              <div>
                <mat-card-title>SMTP / Server Settings</mat-card-title>
                <p class="card-sub">Connection credentials for the mail server</p>
              </div>
            </div>
          </mat-card-header>
          <mat-card-content class="p-t-16">
            <form [formGroup]="form">
              <div class="field-row">
                <mat-form-field appearance="outline" class="grow">
                  <mat-label>SMTP Server</mat-label>
                  <input matInput formControlName="smtpHost"
                         [placeholder]="smtpHostPlaceholder()" />
                </mat-form-field>
                <mat-form-field appearance="outline" class="port-field">
                  <mat-label>SMTP Port</mat-label>
                  <input matInput type="number" formControlName="smtpPort" />
                </mat-form-field>
              </div>
              <div class="field-row">
                <mat-form-field appearance="outline">
                  <mat-label>Username</mat-label>
                  <input matInput formControlName="username"
                         placeholder="apikey or your&#64;email.com" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Password</mat-label>
                  <input matInput type="password" formControlName="password" />
                </mat-form-field>
              </div>
              @if (form.value.provider === ${EmailProvider.AmazonSes}) {
                <mat-form-field appearance="outline" class="half-width">
                  <mat-label>AWS Region</mat-label>
                  <input matInput formControlName="awsRegion" placeholder="us-east-1" />
                </mat-form-field>
              }
              <mat-checkbox formControlName="enableSsl" color="primary">
                Enable SSL / TLS
              </mat-checkbox>
            </form>
          </mat-card-content>
        </mat-card>
      }

      <!-- ────────── API Settings (for SendGrid / Mailgun) ────────── -->
      @if (showApi()) {
        <mat-card>
          <mat-card-header>
            <div class="card-title-row">
              <mat-icon class="text-primary">vpn_key</mat-icon>
              <div>
                <mat-card-title>API Settings</mat-card-title>
                <p class="card-sub">API key and provider-specific settings</p>
              </div>
            </div>
          </mat-card-header>
          <mat-card-content class="p-t-16">
            <form [formGroup]="form">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>API Key</mat-label>
                <input matInput type="password" formControlName="apiKey" />
              </mat-form-field>
              @if (form.value.provider === ${EmailProvider.MailgunApi}) {
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Sending Domain</mat-label>
                  <input matInput formControlName="apiDomain" placeholder="mg.yourcompany.com" />
                </mat-form-field>
              }
            </form>
          </mat-card-content>
        </mat-card>
      }

      <!-- ────────── Sender Identity ────────── -->
      <mat-card>
        <mat-card-header>
          <div class="card-title-row">
            <mat-icon class="text-primary">person</mat-icon>
            <div>
              <mat-card-title>Sender Identity</mat-card-title>
              <p class="card-sub">From address and display name</p>
            </div>
          </div>
        </mat-card-header>
        <mat-card-content class="p-t-16">
          <form [formGroup]="form">
            <div class="field-row">
              <mat-form-field appearance="outline">
                <mat-label>Sender Email Address</mat-label>
                <input matInput formControlName="senderEmail"
                       placeholder="noreply&#64;yourcompany.com" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Sender Name</mat-label>
                <input matInput formControlName="senderName" placeholder="TravelCRM" />
              </mat-form-field>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <!-- ────────── Active Toggle ────────── -->
      <mat-card>
        <mat-card-content>
          <div class="toggle-row">
            <mat-slide-toggle [formControl]="form.controls.isActive" color="primary">
              <strong>Set as Active Configuration</strong>
            </mat-slide-toggle>
            <p class="card-sub m-l-0">Activating will deactivate any currently active email configuration.</p>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- ────────── Actions ────────── -->
      <div class="form-actions">
        <button mat-raised-button color="primary" (click)="save()"
                [disabled]="form.invalid || saving()">
          @if (saving()) { <mat-spinner diameter="16"></mat-spinner> }
          @else { <mat-icon>save</mat-icon> }
          <span>Save Configuration</span>
        </button>
        @if (isEdit()) {
          <button mat-stroked-button color="primary" (click)="sendTestEmail()"
                  [disabled]="testing()">
            @if (testing()) { <mat-spinner diameter="16"></mat-spinner> }
            @else { <mat-icon>send</mat-icon> }
            <span>Send Test Email</span>
          </button>
        }
        <button mat-stroked-button (click)="goBack()">
          <mat-icon>arrow_back</mat-icon> Back
        </button>
      </div>

    </div>
  `,
  styles: [`
    .form-layout { display: flex; flex-direction: column; gap: 20px; max-width: 900px; }
    .card-title-row { display: flex; align-items: center; gap: 10px; width: 100%; }
    .card-title-row .spacer { flex: 1; }
    .card-sub { color: #8695ad; font-size: 12px; margin: 0; }
    .m-l-0 { margin-left: 0 !important; }
    mat-card-content { padding: 16px !important; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .grow { grid-column: 1; }
    .port-field { max-width: 140px; }
    .full-width { width: 100%; }
    .half-width { width: 50%; }
    mat-form-field { width: 100%; }
    .toggle-row { display: flex; flex-direction: column; gap: 4px; padding: 8px 0; }
    .form-actions { display: flex; gap: 12px; }
    .form-actions button { display: inline-flex; align-items: center; gap: 6px; }
    @media (max-width: 720px) { .field-row { grid-template-columns: 1fr; } }
  `],
})
export class EmailFormComponent implements OnInit {
  readonly scope = input<Scope>('tenant');

  private readonly fb     = inject(FormBuilder);
  private readonly api    = inject(EmailApiService);
  private readonly toastr = inject(ToastrService);
  private readonly route  = inject(ActivatedRoute);
  private readonly loc    = inject(Location);

  readonly isEdit  = signal(false);
  readonly loadingRecord = signal(false);
  readonly saving  = signal(false);
  readonly testing = signal(false);
  private editId: string | null = null;

  readonly providers = Object.entries(PROVIDER_LABELS).map(([k, v]) => ({
    value: +k as EmailProvider,
    label: v,
  }));

  readonly form = this.fb.group({
    name:            ['', Validators.required],
    provider:        [EmailProvider.Smtp as EmailProvider],
    isActive:        [false],
    smtpHost:        [''],
    smtpPort:        [587],
    username:        [''],
    password:        [''],
    enableSsl:       [true],
    senderEmail:     ['', [Validators.required, Validators.email]],
    senderName:      ['', Validators.required],
    apiKey:          [''],
    apiDomain:       [''],
    awsRegion:       ['us-east-1'],
  });

  readonly showSmtp = computed(() => isSmtpProvider(this.form.value.provider!));
  readonly showApi  = computed(() => isApiProvider(this.form.value.provider!));

  smtpHostPlaceholder(): string {
    switch (this.form.value.provider) {
      case EmailProvider.Office365: return 'smtp.office365.com';
      case EmailProvider.Outlook:   return 'smtp-mail.outlook.com';
      case EmailProvider.Gmail:     return 'smtp.gmail.com';
      case EmailProvider.AmazonSes: return 'email-smtp.us-east-1.amazonaws.com';
      default:                      return 'smtp.sendgrid.net';
    }
  }

  ngOnInit(): void {
    const paramId = this.route.snapshot.paramMap.get('id');
    if (paramId && paramId !== 'new') {
      this.isEdit.set(true);
      this.editId = paramId;
      this.loadRecord(paramId);
    }
  }

  private loadRecord(id: string): void {
    this.loadingRecord.set(true);
    const obs$ = this.scope() === 'platform'
      ? this.api.getPlatformConfigs()
      : this.api.getTenantConfigs();

    obs$.subscribe({
      next: (list) => {
        const cfg = list.find(c => c.id === id);
        if (cfg) this.patchForm(cfg);
        this.loadingRecord.set(false);
      },
      error: () => { this.toastr.error('Failed to load.'); this.loadingRecord.set(false); },
    });
  }

  private patchForm(cfg: EmailConfigDto): void {
    this.form.patchValue({
      name:        cfg.name,
      provider:    cfg.provider,
      isActive:    cfg.isActive,
      smtpHost:    cfg.smtpHost ?? '',
      smtpPort:    cfg.smtpPort,
      username:    cfg.username ?? '',
      password:    cfg.password ?? '',
      enableSsl:   cfg.enableSsl,
      senderEmail: cfg.senderEmail,
      senderName:  cfg.senderName,
      apiKey:      cfg.apiKey ?? '',
      apiDomain:   cfg.apiDomain ?? '',
      awsRegion:   cfg.awsRegion ?? '',
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);

    const v = this.form.value;
    const body: EmailConfigRequest = {
      name:        v.name!,
      provider:    v.provider!,
      isActive:    v.isActive!,
      smtpHost:    v.smtpHost || null,
      smtpPort:    v.smtpPort,
      username:    v.username || null,
      password:    v.password || null,
      enableSsl:   v.enableSsl,
      senderEmail: v.senderEmail!,
      senderName:  v.senderName!,
      apiKey:      v.apiKey || null,
      apiDomain:   v.apiDomain || null,
      awsRegion:   v.awsRegion || null,
    };

    const obs$ = this.isEdit()
      ? (this.scope() === 'platform'
          ? this.api.updatePlatformConfig(this.editId!, body)
          : this.api.updateTenantConfig(this.editId!, body))
      : (this.scope() === 'platform'
          ? this.api.createPlatformConfig(body)
          : this.api.createTenantConfig(body));

    obs$.subscribe({
      next: () => {
        this.saving.set(false);
        this.toastr.success(this.isEdit() ? 'Updated.' : 'Created.');
        this.goBack();
      },
      error: (err) => {
        this.saving.set(false);
        this.toastr.error(err?.error?.error || 'Save failed.');
      },
    });
  }

  sendTestEmail(): void {
    const to = prompt('Send test email to:', this.form.value.senderEmail || '');
    if (!to) return;
    this.testing.set(true);

    const obs$ = this.scope() === 'platform'
      ? this.api.testPlatformConfig(this.editId!, to)
      : this.api.testTenantConfig(this.editId!, to);

    obs$.subscribe({
      next: (result) => {
        this.testing.set(false);
        result.success
          ? this.toastr.success(result.message)
          : this.toastr.error(result.message);
      },
      error: (err) => {
        this.testing.set(false);
        this.toastr.error(err?.error?.error || 'Test failed.');
      },
    });
  }

  goBack(): void { this.loc.back(); }
}
