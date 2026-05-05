import {
  Component, ChangeDetectionStrategy, inject, signal, input, OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastrService } from 'ngx-toastr';
import { EmailApiService } from 'src/app/core/services/email-api.service';
import {
  EmailConfigDto,
  EmailProvider,
  PROVIDER_LABELS,
  isSmtpProvider,
} from 'src/app/core/models/email-config.model';

type Scope = 'tenant' | 'platform';

@Component({
  selector: 'app-email-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatChipsModule, MatProgressSpinnerModule, MatTooltipModule,
  ],
  template: `
    <div class="page-header m-b-24">
      <div class="header-row">
        <div>
          <h2 class="f-s-24 f-w-700 m-0">Email Configuration</h2>
          <p class="text-muted m-0 m-t-4">
            @if (scope() === 'platform') {
              Platform-wide email settings. Tenants inherit unless they override.
            } @else {
              Configure outbound email for your organisation.
            }
          </p>
        </div>
        <a mat-raised-button color="primary" [routerLink]="['new']">
          <mat-icon>add</mat-icon> Add Configuration
        </a>
      </div>
    </div>

    @if (loading()) {
      <div class="loading-wrap"><mat-spinner diameter="32"></mat-spinner></div>
    } @else if (configs().length === 0) {
      <mat-card class="empty-card">
        <mat-card-content>
          <div class="empty-state">
            <mat-icon class="empty-icon">mail_outline</mat-icon>
            <p>No email configurations yet.</p>
            <a mat-stroked-button color="primary" [routerLink]="['new']">
              <mat-icon>add</mat-icon> Add your first configuration
            </a>
          </div>
        </mat-card-content>
      </mat-card>
    } @else {
      <div class="config-grid">
        @for (cfg of configs(); track cfg.id) {
          <mat-card class="config-card" [class.active-card]="cfg.isActive">
            <mat-card-header>
              <div class="card-header-row">
                <div class="card-title-group">
                  <mat-icon class="driver-icon">{{ providerIcon(cfg.provider) }}</mat-icon>
                  <div>
                    <mat-card-title class="f-s-16">{{ cfg.name }}</mat-card-title>
                    <mat-card-subtitle>{{ providerLabel(cfg.provider) }}</mat-card-subtitle>
                  </div>
                </div>
                @if (cfg.isActive) {
                  <span class="active-badge">Active</span>
                }
              </div>
            </mat-card-header>

            <mat-card-content class="p-t-12">
              <div class="config-details">
                <span class="detail">From: {{ cfg.senderName }} &lt;{{ cfg.senderEmail }}&gt;</span>
                @if (isSmtp(cfg.provider) && cfg.smtpHost) {
                  <span class="detail">{{ cfg.smtpHost }}:{{ cfg.smtpPort }}</span>
                }
                @if (cfg.enableSsl) {
                  <span class="detail ssl">SSL/TLS</span>
                }
              </div>
            </mat-card-content>

            <mat-card-actions align="end">
              @if (!cfg.isActive) {
                <button mat-stroked-button (click)="activate(cfg)"
                        [disabled]="activating() === cfg.id">
                  @if (activating() === cfg.id) { <mat-spinner diameter="14"></mat-spinner> }
                  @else { <mat-icon>check_circle</mat-icon> }
                  Activate
                </button>
              }
              <a mat-stroked-button [routerLink]="[cfg.id]">
                <mat-icon>edit</mat-icon> Edit
              </a>
              @if (!cfg.isActive) {
                <button mat-stroked-button color="warn" (click)="deleteConfig(cfg)"
                        [disabled]="deleting() === cfg.id">
                  @if (deleting() === cfg.id) { <mat-spinner diameter="14"></mat-spinner> }
                  @else { <mat-icon>delete</mat-icon> }
                </button>
              }
            </mat-card-actions>
          </mat-card>
        }
      </div>
    }
  `,
  styles: [`
    .page-header { margin-bottom: 24px; }
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
    .loading-wrap { display: flex; justify-content: center; padding: 40px; }
    .empty-card { max-width: 500px; }
    .empty-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 24px; text-align: center; }
    .empty-icon { font-size: 48px; width: 48px; height: 48px; color: #bbb; }
    .config-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }
    .config-card { border-left: 4px solid transparent; }
    .config-card.active-card { border-left-color: #5D87FF; }
    .card-header-row { display: flex; justify-content: space-between; align-items: flex-start; width: 100%; }
    .card-title-group { display: flex; align-items: center; gap: 10px; }
    .driver-icon { color: #5D87FF; font-size: 28px; width: 28px; height: 28px; }
    .active-badge {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      background: #e8f5e9; color: #2e7d32; padding: 2px 10px; border-radius: 12px;
    }
    .config-details { display: flex; flex-wrap: wrap; gap: 8px; }
    .detail { font-size: 12px; color: #666; background: #f5f5f5; padding: 2px 8px; border-radius: 4px; }
    .detail.ssl { background: #e8f5e9; color: #2e7d32; }
    mat-card-actions button, mat-card-actions a {
      display: inline-flex; align-items: center; gap: 4px; font-size: 12px;
    }
  `],
})
export class EmailListComponent implements OnInit {
  readonly scope = input<Scope>('tenant');

  private readonly api    = inject(EmailApiService);
  private readonly toastr = inject(ToastrService);

  readonly loading    = signal(true);
  readonly configs    = signal<EmailConfigDto[]>([]);
  readonly activating = signal<string | null>(null);
  readonly deleting   = signal<string | null>(null);

  providerLabel(p: EmailProvider): string { return PROVIDER_LABELS[p] ?? 'Unknown'; }
  isSmtp(p: EmailProvider): boolean { return isSmtpProvider(p); }

  providerIcon(p: EmailProvider): string {
    switch (p) {
      case EmailProvider.Gmail:       return 'mail';
      case EmailProvider.Office365:
      case EmailProvider.Outlook:
      case EmailProvider.Exchange:    return 'business';
      case EmailProvider.SendGridApi: return 'send';
      case EmailProvider.MailgunApi:  return 'local_post_office';
      case EmailProvider.AmazonSes:  return 'cloud';
      default:                        return 'email';
    }
  }

  ngOnInit(): void { this.loadConfigs(); }

  private loadConfigs(): void {
    this.loading.set(true);
    const obs$ = this.scope() === 'platform'
      ? this.api.getPlatformConfigs()
      : this.api.getTenantConfigs();
    obs$.subscribe({
      next: (list) => { this.configs.set(list); this.loading.set(false); },
      error: (err) => { this.toastr.error(err?.error?.error || 'Failed to load.'); this.loading.set(false); },
    });
  }

  activate(cfg: EmailConfigDto): void {
    this.activating.set(cfg.id);
    const obs$ = this.scope() === 'platform'
      ? this.api.activatePlatformConfig(cfg.id)
      : this.api.activateTenantConfig(cfg.id);
    obs$.subscribe({
      next: () => { this.activating.set(null); this.toastr.success(`'${cfg.name}' activated.`); this.loadConfigs(); },
      error: (err) => { this.activating.set(null); this.toastr.error(err?.error?.error || 'Failed.'); },
    });
  }

  deleteConfig(cfg: EmailConfigDto): void {
    if (!confirm(`Delete "${cfg.name}"?`)) return;
    this.deleting.set(cfg.id);
    const obs$ = this.scope() === 'platform'
      ? this.api.deletePlatformConfig(cfg.id)
      : this.api.deleteTenantConfig(cfg.id);
    obs$.subscribe({
      next: () => { this.deleting.set(null); this.toastr.success(`'${cfg.name}' deleted.`); this.loadConfigs(); },
      error: (err) => { this.deleting.set(null); this.toastr.error(err?.error?.error || 'Failed.'); },
    });
  }
}
