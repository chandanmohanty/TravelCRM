import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { RouterModule } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { PlatformAdminService, PlatformStatsDto } from '../../../core/services/platform-admin.service';

@Component({
  selector: 'app-platform-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterModule,
    MatCardModule, MatIconModule, MatButtonModule, MatDividerModule,
    TablerIconsModule,
  ],
  template: `
    <div class="page-header m-b-24">
      <div class="header-row">
        <div>
          <h2 class="f-s-24 f-w-700 m-0">Platform Overview</h2>
          <p class="text-muted m-0 m-t-4">SaaS Administration — full cross-tenant visibility.</p>
        </div>
        <span class="platform-badge">
          <span class="iconify f-s-14" data-icon="solar:shield-keyhole-bold-duotone"></span>
          Platform Admin
        </span>
      </div>
    </div>

    <div class="stats-grid m-b-24">

      <mat-card class="stat-card">
        <mat-card-content>
          <div class="stat-row">
            <div>
              <div class="stat-label">Total Tenants</div>
              <div class="stat-value">{{ stats()?.totalTenants ?? '—' }}</div>
              <div class="stat-sub text-success">{{ stats()?.activeTenants ?? 0 }} active</div>
            </div>
            <div class="stat-icon bg-primary-light">
              <span class="iconify f-s-26 text-primary" data-icon="solar:buildings-3-bold-duotone"></span>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="stat-card">
        <mat-card-content>
          <div class="stat-row">
            <div>
              <div class="stat-label">Total Users</div>
              <div class="stat-value">{{ stats()?.totalUsers ?? '—' }}</div>
              <div class="stat-sub text-success">{{ stats()?.activeUsers ?? 0 }} active</div>
            </div>
            <div class="stat-icon bg-success-light">
              <span class="iconify f-s-26 text-success" data-icon="solar:users-group-rounded-bold-duotone"></span>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="stat-card">
        <mat-card-content>
          <div class="stat-row">
            <div>
              <div class="stat-label">Platform Admins</div>
              <div class="stat-value">{{ stats()?.platformAdmins ?? '—' }}</div>
              <div class="stat-sub text-muted">Cross-tenant access</div>
            </div>
            <div class="stat-icon bg-warning-light">
              <span class="iconify f-s-26 text-warning" data-icon="solar:shield-star-bold-duotone"></span>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="stat-card">
        <mat-card-content>
          <div class="stat-row">
            <div>
              <div class="stat-label">Inactive Tenants</div>
              <div class="stat-value">{{ inactiveTenants() }}</div>
              <div class="stat-sub text-muted">Suspended orgs</div>
            </div>
            <div class="stat-icon bg-error-light">
              <span class="iconify f-s-26 text-error" data-icon="solar:lock-keyhole-bold-duotone"></span>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

    </div>

    <!-- Plan breakdown -->
    <mat-card class="m-b-20">
      <mat-card-header>
        <div class="card-title-row">
          <span class="iconify f-s-20 text-primary" data-icon="solar:pie-chart-2-bold-duotone"></span>
          <mat-card-title>Tenants by Plan</mat-card-title>
        </div>
      </mat-card-header>
      <mat-card-content class="p-t-16">
        @if (stats()) {
          <div class="plan-breakdown">
            @for (entry of planEntries(); track entry.plan) {
              <div class="plan-row">
                <span class="plan-name">{{ entry.plan }}</span>
                <div class="plan-bar-wrap">
                  <div class="plan-bar" [style.width.%]="entry.pct"></div>
                </div>
                <span class="plan-count">{{ entry.count }}</span>
              </div>
            }
          </div>
        } @else {
          <p class="text-muted">Loading...</p>
        }
      </mat-card-content>
    </mat-card>

    <!-- Quick actions -->
    <mat-card>
      <mat-card-header>
        <div class="card-title-row">
          <span class="iconify f-s-20 text-primary" data-icon="solar:bolt-bold-duotone"></span>
          <mat-card-title>Quick Actions</mat-card-title>
        </div>
      </mat-card-header>
      <mat-card-content class="p-t-16">
        <div class="actions-row">
          <button mat-raised-button color="primary" routerLink="/platform-admin/tenants">
            <span class="iconify" data-icon="solar:buildings-3-line-duotone"></span>
            Manage Tenants
          </button>
          <button mat-stroked-button routerLink="/platform-admin/tenants">
            <mat-icon>add</mat-icon> Create Tenant
          </button>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; }
    .platform-badge {
      display: flex; align-items: center; gap: 6px;
      background: linear-gradient(135deg, #1976d2, #42a5f5);
      color: white; padding: 6px 16px; border-radius: 20px;
      font-size: 13px; font-weight: 700;
    }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    .stat-card mat-card-content { padding: 16px !important; }
    .stat-row { display: flex; justify-content: space-between; align-items: center; }
    .stat-label { font-size: 12px; font-weight: 600; text-transform: uppercase; color: #888; margin-bottom: 4px; }
    .stat-value { font-size: 32px; font-weight: 800; line-height: 1; }
    .stat-sub { font-size: 12px; margin-top: 4px; }
    .stat-icon { width: 56px; height: 56px; border-radius: 14px; display: flex; align-items: center; justify-content: center; }
    .bg-primary-light { background: rgba(25,118,210,0.12); }
    .bg-success-light { background: rgba(46,125,50,0.12); }
    .bg-warning-light { background: rgba(245,127,23,0.12); }
    .bg-error-light   { background: rgba(198,40,40,0.12); }
    .text-success { color: #2e7d32; }
    .text-warning { color: #f57f17; }
    .text-error   { color: #c62828; }
    .card-title-row { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
    mat-card-content { padding: 16px !important; }
    .plan-breakdown { display: flex; flex-direction: column; gap: 12px; }
    .plan-row { display: flex; align-items: center; gap: 12px; }
    .plan-name { min-width: 100px; font-size: 13px; font-weight: 600; }
    .plan-bar-wrap { flex: 1; background: #f0f0f0; border-radius: 6px; height: 10px; overflow: hidden; }
    .plan-bar { height: 100%; background: linear-gradient(90deg, #1976d2, #42a5f5); border-radius: 6px; min-width: 4px; transition: width 0.5s; }
    .plan-count { min-width: 32px; text-align: right; font-weight: 700; }
    .actions-row { display: flex; gap: 12px; }
    @media (max-width: 900px) { .stats-grid { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 600px) { .stats-grid { grid-template-columns: 1fr; } }
  `],
})
export class PlatformDashboardComponent implements OnInit {
  private svc = inject(PlatformAdminService);

  stats = signal<PlatformStatsDto | null>(null);

  inactiveTenants = () => {
    const s = this.stats();
    return s ? s.totalTenants - s.activeTenants : '—';
  };

  planEntries = () => {
    const s = this.stats();
    if (!s) return [];
    const max = Math.max(...Object.values(s.usersByPlan), 1);
    return Object.entries(s.usersByPlan).map(([plan, count]) => ({
      plan, count, pct: Math.round((count / max) * 100)
    }));
  };

  ngOnInit(): void {
    this.svc.getStats().subscribe({
      next: (data: PlatformStatsDto) => this.stats.set(data),
      error: () => this.stats.set({
        totalTenants: 1, activeTenants: 1, totalUsers: 1,
        activeUsers: 1, platformAdmins: 1,
        usersByPlan: { Enterprise: 1 }
      }),
    });
  }
}
