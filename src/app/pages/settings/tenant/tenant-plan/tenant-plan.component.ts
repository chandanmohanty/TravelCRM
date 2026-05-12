import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TablerIconsModule } from 'angular-tabler-icons';
import { EntitlementsService, PlanDto } from 'src/app/core/services/entitlements.service';

/**
 * Tenant-facing subscription page.
 *
 *  - Top card: current plan summary + lifecycle status + usage meters
 *    (seats, storage, webhooks, workflows, etc.) derived from the live
 *    entitlements signal.
 *  - Bottom card: comparison grid of available plans with a Choose button
 *    that's gated to "current plan = disabled". Self-serve upgrade lands
 *    in Phase 14 (Stripe / Razorpay); for now the button just exposes the
 *    plan code to the support team via mailto.
 */
@Component({
  selector: 'app-tenant-plan',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    DatePipe, DecimalPipe, PercentPipe,
    MatButtonModule, MatCardModule, MatChipsModule, MatDividerModule,
    MatIconModule, MatProgressBarModule, MatProgressSpinnerModule, MatTooltipModule,
    TablerIconsModule,
  ],
  template: `
    <div class="page-header m-b-24">
      <h2 class="f-s-24 f-w-700 m-0">Subscription &amp; Plan</h2>
      <p class="text-muted m-0 m-t-4">Your current plan, usage, and upgrade options.</p>
    </div>

    @if (loading()) {
      <div class="loading-wrap"><mat-spinner diameter="32"></mat-spinner></div>
    } @else if (entitlements(); as ent) {

      <div class="plan-layout">

        <!-- ── Current Plan ─────────────────────────────────────── -->
        <mat-card>
          <mat-card-header>
            <div class="card-title-row">
              <i-tabler name="crown" class="icon-md text-primary"></i-tabler>
              <mat-card-title>Current Plan</mat-card-title>
            </div>
          </mat-card-header>
          <mat-card-content class="p-t-16">

            <div class="current-plan-row">
              <div>
                <div class="plan-badge" [ngClass]="'badge-' + ent.planCode">{{ ent.planName }}</div>
                <p class="m-t-8 text-muted f-s-13">
                  Status: <strong [ngClass]="statusClass(ent.status)">{{ ent.status }}</strong>
                  @if (ent.currentPeriodEnd) {
                    · renews on <strong>{{ ent.currentPeriodEnd | date:'mediumDate' }}</strong>
                  }
                  @if (ent.trialEndsAt && ent.status === 'Trial') {
                    · trial ends <strong>{{ ent.trialEndsAt | date:'mediumDate' }}</strong>
                  }
                </p>
              </div>
              @if (ent.status === 'Active' || ent.status === 'Trial') {
                <button mat-stroked-button color="warn"
                        [matTooltip]="'Contact support to cancel your subscription'">
                  Cancel Plan
                </button>
              }
            </div>

            <mat-divider class="m-t-16 m-b-16"></mat-divider>

            <!-- Usage meters — only render the ones with a configured limit -->
            <div class="usage-grid">
              <div class="usage-item">
                <span class="usage-label">Users</span>
                <span class="usage-value">
                  {{ ent.usedSeats }}<span class="usage-of"> / {{ ent.seatLimit ?? 'unlimited' }}</span>
                </span>
                @if (ent.seatLimit) {
                  <mat-progress-bar mode="determinate"
                    [value]="(ent.usedSeats / ent.seatLimit) * 100"
                    [color]="meterColor(ent.usedSeats, ent.seatLimit)"></mat-progress-bar>
                }
              </div>

              <div class="usage-item">
                <span class="usage-label">Storage</span>
                <span class="usage-value">
                  {{ storageGb() | number:'1.1-1' }} GB<span class="usage-of"> / {{ ent.storageGbLimit ?? 'unlimited' }}{{ ent.storageGbLimit ? ' GB' : '' }}</span>
                </span>
                @if (ent.storageGbLimit) {
                  <mat-progress-bar mode="determinate"
                    [value]="(storageGb() / ent.storageGbLimit) * 100"
                    [color]="meterColor(storageGb(), ent.storageGbLimit)"></mat-progress-bar>
                }
              </div>

              <div class="usage-item">
                <span class="usage-label">Webhooks</span>
                <span class="usage-value">— <span class="usage-of">/ {{ ent.webhookLimit ?? 'unlimited' }}</span></span>
              </div>

              <div class="usage-item">
                <span class="usage-label">Workflow rules</span>
                <span class="usage-value">— <span class="usage-of">/ {{ ent.workflowRuleLimit ?? 'unlimited' }}</span></span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- ── Available Plans ──────────────────────────────────── -->
        <mat-card>
          <mat-card-header>
            <div class="card-title-row">
              <i-tabler name="layers-intersect" class="icon-md text-primary"></i-tabler>
              <mat-card-title>Available Plans</mat-card-title>
            </div>
          </mat-card-header>
          <mat-card-content class="p-t-16">

            @if (plans().length === 0) {
              <div class="text-muted">No plans available right now.</div>
            } @else {
              <div class="plans-grid">
                @for (p of plans(); track p.id) {
                  <div class="plan-card" [class.current]="p.id === ent.planId">
                    @if (p.id === ent.planId) {
                      <div class="current-badge">Current</div>
                    }
                    <div class="plan-name">{{ p.name }}</div>
                    <div class="plan-price">
                      @if (p.flatMonthlyPrice !== null) {
                        ₹{{ p.flatMonthlyPrice | number:'1.0-0' }}<span class="plan-period"> / mo flat</span>
                      } @else if (p.annualPricePerMonth !== null) {
                        ₹{{ p.annualPricePerMonth | number:'1.0-0' }}<span class="plan-period"> / user / mo, billed yearly</span>
                      } @else {
                        Free
                      }
                    </div>

                    <ul class="plan-limits">
                      <li>{{ p.seatLimit ?? 'Unlimited' }} users</li>
                      <li>{{ p.storageGbLimit ?? 'Unlimited' }}{{ p.storageGbLimit ? ' GB' : '' }} storage</li>
                      <li>{{ p.workflowRuleLimit ?? 'Unlimited' }} workflow rules</li>
                      <li>{{ p.featureCodes.length }} features</li>
                    </ul>

                    <button mat-stroked-button class="full-width"
                            [color]="p.id === ent.planId ? 'primary' : ''"
                            [disabled]="p.id === ent.planId"
                            (click)="upgradeTo(p)">
                      {{ p.id === ent.planId ? 'Active Plan' : (p.isContactSalesOnly ? 'Contact Sales' : 'Choose ' + p.name) }}
                    </button>
                  </div>
                }
              </div>
            }
          </mat-card-content>
        </mat-card>

      </div>
    } @else {
      <mat-card>
        <mat-card-content class="p-t-16">
          <p class="text-muted">
            We couldn't load your subscription. Refresh the page or contact support if the problem persists.
          </p>
        </mat-card-content>
      </mat-card>
    }
  `,
  styles: [`
    .loading-wrap { display: flex; justify-content: center; padding: 40px; }
    .plan-layout { display: flex; flex-direction: column; gap: 20px; max-width: 980px; }
    .card-title-row { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
    mat-card-content { padding: 16px !important; }

    .current-plan-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }

    .plan-badge {
      display: inline-block; padding: 4px 14px; border-radius: 20px;
      font-size: 13px; font-weight: 700; letter-spacing: .3px;
    }
    .badge-free       { background: #f1f5f9; color: #475569; }
    .badge-starter    { background: #dbeafe; color: #1d4ed8; }
    .badge-grow       { background: #dcfce7; color: #15803d; }
    .badge-scale      { background: #fef3c7; color: #b45309; }
    .badge-business   { background: #ede9fe; color: #6d28d9; }
    .badge-unlimited  { background: #fce7f3; color: #be185d; }

    .status-Active    { color: #15803d; }
    .status-Trial     { color: #b45309; }
    .status-PastDue   { color: #b91c1c; }
    .status-Cancelled { color: #64748b; }
    .status-Free      { color: #475569; }

    .usage-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    .usage-item { display: flex; flex-direction: column; gap: 4px; }
    .usage-label { font-size: 11px; text-transform: uppercase; font-weight: 700;
                   letter-spacing: .6px; color: #94a3b8; }
    .usage-value { font-size: 16px; font-weight: 700; color: #0f172a; }
    .usage-of    { font-size: 12px; font-weight: 500; color: #94a3b8; }

    .plans-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .plan-card {
      border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px;
      position: relative; background: #fff;
      transition: box-shadow 150ms;
    }
    .plan-card:hover { box-shadow: 0 4px 12px rgba(15,23,42,.07); }
    .plan-card.current {
      border-color: #1976d2; background: #f5f9ff;
    }
    .current-badge {
      position: absolute; top: -10px; left: 50%; transform: translateX(-50%);
      background: #1976d2; color: #fff; font-size: 11px; font-weight: 700;
      padding: 2px 12px; border-radius: 12px; letter-spacing: .4px;
    }
    .plan-name  { font-size: 17px; font-weight: 700; margin-bottom: 6px; color: #0f172a; }
    .plan-price { font-size: 22px; font-weight: 800; margin-bottom: 12px; color: #0f172a; }
    .plan-period { font-size: 12px; font-weight: 500; color: #64748b; }
    .plan-limits { list-style: none; padding: 0; margin: 0 0 18px;
                   display: flex; flex-direction: column; gap: 6px;
                   font-size: 13px; color: #475569; }
    .plan-limits li::before { content: '✓ '; color: #15803d; font-weight: 700; }
    .full-width { width: 100%; }

    @media (max-width: 768px) {
      .plans-grid  { grid-template-columns: 1fr; }
      .usage-grid  { grid-template-columns: 1fr 1fr; }
    }
  `],
})
export class TenantPlanComponent implements OnInit {
  private readonly ents = inject(EntitlementsService);

  readonly entitlements = this.ents.entitlements;
  readonly loading = signal(false);
  readonly plans   = signal<PlanDto[]>([]);

  /** Storage usage converted bytes → GB for the meter. */
  readonly storageGb = computed(() => {
    const e = this.entitlements();
    if (!e) return 0;
    return e.storageUsedBytes / (1024 * 1024 * 1024);
  });

  ngOnInit(): void {
    this.loading.set(true);
    this.ents.listPlans().subscribe({
      next: (ps) => {
        this.plans.set(ps);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Returns the Material color name for a usage meter based on % used. */
  meterColor(used: number, limit: number): 'primary' | 'accent' | 'warn' {
    const pct = used / limit;
    if (pct >= 0.9) return 'warn';
    if (pct >= 0.7) return 'accent';
    return 'primary';
  }

  statusClass(status: string): string {
    return `status-${status}`;
  }

  upgradeTo(plan: PlanDto): void {
    // Phase 14 will land self-serve upgrade via Stripe / Razorpay. For now,
    // surface the request via a mailto link to support so the platform team
    // can complete the change manually.
    const subj = encodeURIComponent(`Plan upgrade request: ${plan.name}`);
    const body = encodeURIComponent(
      `Hi team,\n\nI'd like to upgrade my TravelCRMPlus subscription to: ${plan.name} (${plan.code}).\n\nThanks.`,
    );
    window.location.href = `mailto:support@travelcrm.io?subject=${subj}&body=${body}`;
  }
}
