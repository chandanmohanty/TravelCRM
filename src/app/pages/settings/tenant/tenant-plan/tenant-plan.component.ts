import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { TablerIconsModule } from 'angular-tabler-icons';

@Component({
  selector: 'app-tenant-plan',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatCardModule, MatButtonModule, MatDividerModule,
    MatChipsModule, MatIconModule, TablerIconsModule,
  ],
  template: `
    <div class="page-header m-b-24">
      <h2 class="f-s-24 f-w-700 m-0">Subscription & Plan</h2>
      <p class="text-muted m-0 m-t-4">Manage your plan, usage limits, and upgrades.</p>
    </div>

    <div class="plan-layout">

      <!-- Current Plan -->
      <mat-card>
        <mat-card-header>
          <div class="card-title-row">
            <span class="iconify f-s-20 text-primary" data-icon="solar:crown-line-duotone"></span>
            <mat-card-title>Current Plan</mat-card-title>
          </div>
        </mat-card-header>
        <mat-card-content class="p-t-16">
          <div class="current-plan-row">
            <div>
              <div class="plan-badge enterprise">Enterprise</div>
              <p class="m-t-8 text-muted f-s-13">Your plan renews on <strong>1 January 2027</strong>.</p>
            </div>
            <button mat-stroked-button color="warn">Cancel Plan</button>
          </div>

          <mat-divider class="m-t-16 m-b-16"></mat-divider>

          <div class="usage-grid">
            <div class="usage-item">
              <span class="usage-label">Users</span>
              <span class="usage-value">Unlimited</span>
            </div>
            <div class="usage-item">
              <span class="usage-label">Storage</span>
              <span class="usage-value">500 GB</span>
            </div>
            <div class="usage-item">
              <span class="usage-label">API Calls / mo</span>
              <span class="usage-value">Unlimited</span>
            </div>
            <div class="usage-item">
              <span class="usage-label">Data Region</span>
              <span class="usage-value">US East</span>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Available Plans -->
      <mat-card>
        <mat-card-header>
          <div class="card-title-row">
            <span class="iconify f-s-20 text-primary" data-icon="solar:layers-line-duotone"></span>
            <mat-card-title>Available Plans</mat-card-title>
          </div>
        </mat-card-header>
        <mat-card-content class="p-t-16">
          <div class="plans-grid">

            <div class="plan-card">
              <div class="plan-name">Starter</div>
              <div class="plan-price">$29 <span class="plan-period">/ mo</span></div>
              <ul class="plan-features">
                <li><mat-icon class="check">check_circle</mat-icon> Up to 5 users</li>
                <li><mat-icon class="check">check_circle</mat-icon> 10 GB storage</li>
                <li><mat-icon class="check">check_circle</mat-icon> Basic CRM</li>
                <li><mat-icon class="muted">remove_circle_outline</mat-icon> API access</li>
              </ul>
              <button mat-stroked-button class="full-width">Choose Starter</button>
            </div>

            <div class="plan-card">
              <div class="plan-name">Professional</div>
              <div class="plan-price">$99 <span class="plan-period">/ mo</span></div>
              <ul class="plan-features">
                <li><mat-icon class="check">check_circle</mat-icon> Up to 25 users</li>
                <li><mat-icon class="check">check_circle</mat-icon> 100 GB storage</li>
                <li><mat-icon class="check">check_circle</mat-icon> Full CRM</li>
                <li><mat-icon class="check">check_circle</mat-icon> API access</li>
              </ul>
              <button mat-stroked-button class="full-width">Choose Pro</button>
            </div>

            <div class="plan-card current">
              <div class="current-badge">Current</div>
              <div class="plan-name">Enterprise</div>
              <div class="plan-price">Custom</div>
              <ul class="plan-features">
                <li><mat-icon class="check">check_circle</mat-icon> Unlimited users</li>
                <li><mat-icon class="check">check_circle</mat-icon> 500 GB storage</li>
                <li><mat-icon class="check">check_circle</mat-icon> Full CRM + AI</li>
                <li><mat-icon class="check">check_circle</mat-icon> Priority support</li>
              </ul>
              <button mat-raised-button color="primary" class="full-width" disabled>Active Plan</button>
            </div>

          </div>
        </mat-card-content>
      </mat-card>

    </div>
  `,
  styles: [`
    .plan-layout { display: flex; flex-direction: column; gap: 20px; max-width: 900px; }
    .card-title-row { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
    mat-card-content { padding: 16px !important; }
    .current-plan-row { display: flex; justify-content: space-between; align-items: flex-start; }
    .plan-badge { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 13px; font-weight: 700; }
    .plan-badge.enterprise { background: #e8f5e9; color: #2e7d32; }
    .usage-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    .usage-item { display: flex; flex-direction: column; gap: 4px; }
    .usage-label { font-size: 11px; text-transform: uppercase; font-weight: 600; color: #999; }
    .usage-value { font-size: 15px; font-weight: 600; }
    .plans-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .plan-card { border: 1px solid #e0e0e0; border-radius: 10px; padding: 20px; position: relative; }
    .plan-card.current { border-color: #1976d2; background: #f5f9ff; }
    .current-badge { position: absolute; top: -10px; left: 50%; transform: translateX(-50%);
      background: #1976d2; color: white; font-size: 11px; font-weight: 700; padding: 2px 12px; border-radius: 12px; }
    .plan-name { font-size: 17px; font-weight: 700; margin-bottom: 6px; }
    .plan-price { font-size: 26px; font-weight: 800; margin-bottom: 16px; }
    .plan-period { font-size: 13px; font-weight: 400; color: #888; }
    .plan-features { list-style: none; padding: 0; margin: 0 0 20px; display: flex; flex-direction: column; gap: 8px; }
    .plan-features li { display: flex; align-items: center; gap: 8px; font-size: 13px; }
    mat-icon.check { color: #2e7d32; font-size: 18px; width: 18px; height: 18px; }
    mat-icon.muted { color: #bbb; font-size: 18px; width: 18px; height: 18px; }
    .full-width { width: 100%; }
    @media (max-width: 768px) {
      .plans-grid { grid-template-columns: 1fr; }
      .usage-grid { grid-template-columns: 1fr 1fr; }
    }
  `],
})
export class TenantPlanComponent {}
