import {
  Component, ChangeDetectionStrategy, inject, signal, input, OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastrService } from 'ngx-toastr';
import { StorageApiService } from 'src/app/core/services/storage-api.service';
import {
  StorageConfigDto,
  StorageDriver,
  DRIVER_LABELS,
} from 'src/app/core/models/storage-config.model';

type Scope = 'tenant' | 'platform';

@Component({
  selector: 'app-storage-list',
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
          <h2 class="f-s-24 f-w-700 m-0">Storage Configuration</h2>
          <p class="text-muted m-0 m-t-4">
            @if (scope() === 'platform') {
              Platform-wide storage backends. Tenants inherit the active config unless they override.
            } @else {
              Override the platform storage for your organisation.
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
            <mat-icon class="empty-icon">cloud_off</mat-icon>
            <p>No storage configurations yet.</p>
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
                  <mat-icon class="driver-icon">{{ driverIcon(cfg.driver) }}</mat-icon>
                  <div>
                    <mat-card-title class="f-s-16">{{ cfg.name }}</mat-card-title>
                    <mat-card-subtitle>{{ driverLabel(cfg.driver) }}</mat-card-subtitle>
                  </div>
                </div>
                @if (cfg.isActive) {
                  <span class="active-badge">Active</span>
                }
              </div>
            </mat-card-header>

            <mat-card-content class="p-t-12">
              <div class="config-details">
                @switch (cfg.driver) {
                  @case (0) { <span class="detail">Path: {{ cfg.basePath }}</span> }
                  @case (1) {
                    <span class="detail">Bucket: {{ cfg.awsBucket }}</span>
                    <span class="detail">Region: {{ cfg.awsRegion }}</span>
                  }
                  @case (2) { <span class="detail">Container: {{ cfg.azureContainerName }}</span> }
                  @case (3) { <span class="detail">Bucket: {{ cfg.gcsBucket }}</span> }
                }
              </div>
            </mat-card-content>

            <mat-card-actions align="end">
              @if (!cfg.isActive) {
                <button mat-stroked-button
                        (click)="activate(cfg)"
                        [disabled]="activating() === cfg.id"
                        matTooltip="Set as active storage">
                  @if (activating() === cfg.id) { <mat-spinner diameter="14"></mat-spinner> }
                  @else { <mat-icon>check_circle</mat-icon> }
                  Activate
                </button>
              }
              <button mat-stroked-button
                      (click)="testConnection(cfg)"
                      [disabled]="testing() === cfg.id"
                      matTooltip="Test connection">
                @if (testing() === cfg.id) { <mat-spinner diameter="14"></mat-spinner> }
                @else { <mat-icon>wifi_tethering</mat-icon> }
                Test
              </button>
              <a mat-stroked-button [routerLink]="[cfg.id]" matTooltip="Edit">
                <mat-icon>edit</mat-icon> Edit
              </a>
              @if (!cfg.isActive) {
                <button mat-stroked-button color="warn"
                        (click)="deleteConfig(cfg)"
                        [disabled]="deleting() === cfg.id"
                        matTooltip="Delete">
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
      font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
      background: #e8f5e9; color: #2e7d32; padding: 2px 10px; border-radius: 12px;
    }
    .config-details { display: flex; flex-wrap: wrap; gap: 8px; }
    .detail {
      font-size: 12px; color: #666; background: #f5f5f5; padding: 2px 8px;
      border-radius: 4px; white-space: nowrap;
    }
    mat-card-actions button, mat-card-actions a {
      display: inline-flex; align-items: center; gap: 4px; font-size: 12px;
    }
  `],
})
export class StorageListComponent implements OnInit {
  readonly scope = input<Scope>('tenant');

  private readonly api    = inject(StorageApiService);
  private readonly toastr = inject(ToastrService);
  private readonly router = inject(Router);

  readonly loading    = signal(true);
  readonly configs    = signal<StorageConfigDto[]>([]);
  readonly activating = signal<string | null>(null);
  readonly testing    = signal<string | null>(null);
  readonly deleting   = signal<string | null>(null);

  driverLabel(d: StorageDriver): string { return DRIVER_LABELS[d] ?? 'Unknown'; }

  driverIcon(d: StorageDriver): string {
    switch (d) {
      case StorageDriver.LocalDisk:          return 'folder';
      case StorageDriver.AmazonS3:           return 'cloud';
      case StorageDriver.AzureBlob:          return 'cloud_queue';
      case StorageDriver.GoogleCloudStorage: return 'cloud_circle';
      default: return 'storage';
    }
  }

  ngOnInit(): void {
    this.loadConfigs();
  }

  private loadConfigs(): void {
    this.loading.set(true);
    const obs$ = this.scope() === 'platform'
      ? this.api.getPlatformConfigs()
      : this.api.getTenantConfigs();

    obs$.subscribe({
      next: (list) => { this.configs.set(list); this.loading.set(false); },
      error: (err) => {
        this.toastr.error(err?.error?.error || 'Failed to load storage configs.');
        this.loading.set(false);
      },
    });
  }

  activate(cfg: StorageConfigDto): void {
    this.activating.set(cfg.id);
    const obs$ = this.scope() === 'platform'
      ? this.api.activatePlatformConfig(cfg.id)
      : this.api.activateTenantConfig(cfg.id);

    obs$.subscribe({
      next: () => {
        this.activating.set(null);
        this.toastr.success(`'${cfg.name}' is now the active storage.`);
        this.loadConfigs();
      },
      error: (err) => {
        this.activating.set(null);
        this.toastr.error(err?.error?.error || 'Failed to activate.');
      },
    });
  }

  testConnection(cfg: StorageConfigDto): void {
    this.testing.set(cfg.id);
    const obs$ = this.scope() === 'platform'
      ? this.api.testPlatformConfig(cfg.id)
      : this.api.testTenantConfig(cfg.id);

    obs$.subscribe({
      next: (result) => {
        this.testing.set(null);
        if (result.success) {
          this.toastr.success(`${result.message} (${result.latencyMs}ms)`);
        } else {
          this.toastr.error(result.message);
        }
      },
      error: (err) => {
        this.testing.set(null);
        this.toastr.error(err?.error?.error || 'Test failed.');
      },
    });
  }

  deleteConfig(cfg: StorageConfigDto): void {
    if (!confirm(`Delete storage configuration "${cfg.name}"?`)) return;
    this.deleting.set(cfg.id);
    const obs$ = this.scope() === 'platform'
      ? this.api.deletePlatformConfig(cfg.id)
      : this.api.deleteTenantConfig(cfg.id);

    obs$.subscribe({
      next: () => {
        this.deleting.set(null);
        this.toastr.success(`'${cfg.name}' deleted.`);
        this.loadConfigs();
      },
      error: (err) => {
        this.deleting.set(null);
        this.toastr.error(err?.error?.error || 'Delete failed.');
      },
    });
  }
}
