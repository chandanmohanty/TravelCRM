import { Component, ChangeDetectionStrategy, signal, inject, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormArray, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialogModule, MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TablerIconsModule } from 'angular-tabler-icons';

interface Plan {
  id: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  features: string[];
  limits: { users: string; storage: string; apiCalls: string };
  isActive: boolean;
  isMostPopular: boolean;
}

// ── Plan Dialog Component ────────────────────────────────────────────────────

@Component({
  selector: 'app-plan-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatDialogModule, MatDividerModule,
    MatFormFieldModule, MatInputModule, MatCheckboxModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit Plan' : 'New Plan' }}</h2>

    <mat-dialog-content class="dialog-content">
      <form [formGroup]="form" class="plan-form">
        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Plan Name</mat-label>
            <input matInput formControlName="name" placeholder="e.g. Starter">
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Monthly Price ($)</mat-label>
            <input matInput type="number" formControlName="monthlyPrice" min="0">
          </mat-form-field>
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Annual Price ($)</mat-label>
            <input matInput type="number" formControlName="annualPrice" min="0">
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Users Limit</mat-label>
            <input matInput formControlName="users" placeholder="e.g. Up to 10">
          </mat-form-field>
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Storage</mat-label>
            <input matInput formControlName="storage" placeholder="e.g. 50 GB">
          </mat-form-field>
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>API Calls</mat-label>
            <input matInput formControlName="apiCalls" placeholder="e.g. 50K / mo">
          </mat-form-field>
        </div>

        <mat-checkbox formControlName="isMostPopular" color="primary">
          Mark as Most Popular
        </mat-checkbox>

        <mat-divider class="m-t-16 m-b-16"></mat-divider>

        <div class="features-section">
          <div class="features-header">
            <span class="f-w-600">Features</span>
            <button mat-icon-button color="primary" type="button" (click)="addFeature()">
              <mat-icon>add_circle</mat-icon>
            </button>
          </div>
          <div formArrayName="features">
            @for (ctrl of features.controls; track $index) {
              <div class="feature-row">
                <mat-form-field appearance="outline" class="flex-1">
                  <input matInput [formControlName]="$index" placeholder="Feature description">
                </mat-form-field>
                <button mat-icon-button color="warn" type="button" (click)="removeFeature($index)"
                        [disabled]="features.length <= 1">
                  <mat-icon>remove_circle</mat-icon>
                </button>
              </div>
            }
          </div>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="form.invalid" (click)="save()">
        {{ data ? 'Update' : 'Create' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-content { min-width: 500px; max-height: 70vh; }
    .plan-form { display: flex; flex-direction: column; gap: 4px; }
    .form-row { display: flex; gap: 12px; }
    .flex-1 { flex: 1; }
    .features-header { display: flex; align-items: center; justify-content: space-between; }
    .feature-row { display: flex; align-items: center; gap: 8px; }
    .feature-row mat-form-field { margin-bottom: -8px; }
  `],
})
export class PlanDialogComponent {
  private fb = inject(FormBuilder);

  form = this.fb.group({
    name:          [this.data?.name ?? '',           Validators.required],
    monthlyPrice:  [this.data?.monthlyPrice ?? 0,    [Validators.required, Validators.min(0)]],
    annualPrice:   [this.data?.annualPrice ?? 0,     [Validators.required, Validators.min(0)]],
    users:         [this.data?.limits?.users ?? '',   Validators.required],
    storage:       [this.data?.limits?.storage ?? '', Validators.required],
    apiCalls:      [this.data?.limits?.apiCalls ?? '', Validators.required],
    isMostPopular: [this.data?.isMostPopular ?? false],
    features:      this.fb.array(
      (this.data?.features?.length ? this.data.features : ['']).map((f: string) => this.fb.control(f, Validators.required))
    ),
  });

  get features(): FormArray { return this.form.get('features') as FormArray; }

  constructor(
    private dialogRef: MatDialogRef<PlanDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: Plan | null,
  ) {}

  addFeature(): void {
    this.features.push(this.fb.control('', Validators.required));
  }

  removeFeature(i: number): void {
    this.features.removeAt(i);
  }

  save(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const result: Plan = {
      id:            this.data?.id ?? crypto.randomUUID(),
      name:          v.name!,
      monthlyPrice:  v.monthlyPrice!,
      annualPrice:   v.annualPrice!,
      features:      v.features as string[],
      limits:        { users: v.users!, storage: v.storage!, apiCalls: v.apiCalls! },
      isActive:      this.data?.isActive ?? true,
      isMostPopular: v.isMostPopular!,
    };
    this.dialogRef.close(result);
  }
}

// ── Main Plans Component ─────────────────────────────────────────────────────

@Component({
  selector: 'app-subscription-plans',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatDividerModule, MatSlideToggleModule, MatDialogModule,
    MatSnackBarModule, TablerIconsModule,
  ],
  template: `
    <div class="page-header m-b-24">
      <div class="header-row">
        <div>
          <h2 class="f-s-24 f-w-700 m-0">Plans &amp; Pricing</h2>
          <p class="text-muted m-0 m-t-4">Define the subscription tiers available to your tenants.</p>
        </div>
        <div class="header-actions">
          <div class="billing-toggle">
            <span [class.active-label]="!annual()">Monthly</span>
            <mat-slide-toggle [checked]="annual()" (change)="annual.set($event.checked)" color="primary"></mat-slide-toggle>
            <span [class.active-label]="annual()">Annual <span class="save-badge">Save 20%</span></span>
          </div>
          <button mat-raised-button color="primary" (click)="openDialog()">
            <mat-icon>add</mat-icon> New Plan
          </button>
        </div>
      </div>
    </div>

    <div class="plans-grid">
      @for (plan of plans(); track plan.id) {
        <mat-card [class.popular-card]="plan.isMostPopular" [class.inactive-card]="!plan.isActive">

          @if (plan.isMostPopular) {
            <div class="popular-ribbon">Most Popular</div>
          }

          <mat-card-content class="plan-card-body">
            <!-- Header -->
            <div class="plan-header">
              <div class="plan-name-row">
                <span class="plan-name">{{ plan.name }}</span>
                <span [class]="plan.isActive ? 'status-active' : 'status-inactive'">
                  {{ plan.isActive ? 'Active' : 'Inactive' }}
                </span>
              </div>
              <div class="plan-price">
                <span class="currency">$</span>
                <span class="price-amount">{{ annual() ? plan.annualPrice : plan.monthlyPrice }}</span>
                <span class="price-period">/ {{ annual() ? 'yr' : 'mo' }}</span>
              </div>
              @if (annual()) {
                <div class="monthly-equiv">
                  <span class="currency-sm">$</span>{{ (plan.annualPrice / 12) | number:'1.0-0' }}/mo equivalent
                </div>
              }
            </div>

            <mat-divider class="m-t-16 m-b-16"></mat-divider>

            <!-- Limits -->
            <div class="limits-grid">
              <div class="limit-item">
                <span class="iconify limit-icon" data-icon="solar:users-group-rounded-line-duotone"></span>
                <div>
                  <div class="limit-label">Users</div>
                  <div class="limit-value">{{ plan.limits.users }}</div>
                </div>
              </div>
              <div class="limit-item">
                <span class="iconify limit-icon" data-icon="solar:database-line-duotone"></span>
                <div>
                  <div class="limit-label">Storage</div>
                  <div class="limit-value">{{ plan.limits.storage }}</div>
                </div>
              </div>
              <div class="limit-item">
                <span class="iconify limit-icon" data-icon="solar:programming-line-duotone"></span>
                <div>
                  <div class="limit-label">API Calls</div>
                  <div class="limit-value">{{ plan.limits.apiCalls }}</div>
                </div>
              </div>
            </div>

            <mat-divider class="m-t-16 m-b-16"></mat-divider>

            <!-- Features -->
            <ul class="feature-list">
              @for (f of plan.features; track f) {
                <li>
                  <mat-icon class="check-icon">check_circle</mat-icon>
                  {{ f }}
                </li>
              }
            </ul>

            <!-- Actions -->
            <div class="plan-actions">
              <button mat-stroked-button (click)="openDialog(plan)">
                <mat-icon>edit</mat-icon> Edit
              </button>
              <button mat-stroked-button [color]="plan.isActive ? 'warn' : 'primary'"
                      (click)="togglePlan(plan)">
                <mat-icon>{{ plan.isActive ? 'visibility_off' : 'visibility' }}</mat-icon>
                {{ plan.isActive ? 'Deactivate' : 'Activate' }}
              </button>
            </div>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; }
    .header-actions { display: flex; align-items: center; gap: 16px; }
    .billing-toggle { display: flex; align-items: center; gap: 8px; font-size: 14px; }
    .active-label { font-weight: 700; color: #1976d2; }
    .save-badge { background: #e8f5e9; color: #2e7d32; font-size: 10px; font-weight: 700;
      padding: 2px 6px; border-radius: 8px; margin-left: 4px; }
    .plans-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
    mat-card { position: relative; overflow: visible; border-radius: 16px !important; }
    .popular-card { border: 2px solid #1976d2 !important; }
    .inactive-card { opacity: 0.65; }
    .popular-ribbon {
      position: absolute; top: -13px; left: 50%; transform: translateX(-50%);
      background: #1976d2; color: white; font-size: 11px; font-weight: 700;
      padding: 3px 16px; border-radius: 14px; white-space: nowrap;
    }
    .plan-card-body { padding: 24px !important; }
    .plan-name-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .plan-name { font-size: 20px; font-weight: 800; }
    .status-active   { font-size: 11px; background: #e8f5e9; color: #2e7d32; padding: 2px 10px; border-radius: 10px; font-weight: 600; }
    .status-inactive { font-size: 11px; background: #fce4ec; color: #c62828; padding: 2px 10px; border-radius: 10px; font-weight: 600; }
    .plan-price { display: flex; align-items: baseline; gap: 4px; margin-bottom: 4px; }
    .currency { font-size: 22px; font-weight: 700; }
    .currency-sm { font-size: 12px; }
    .price-amount { font-size: 38px; font-weight: 900; line-height: 1; }
    .price-period { font-size: 14px; color: #888; }
    .monthly-equiv { font-size: 12px; color: #888; margin-bottom: 4px; }
    .limits-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .limit-item { display: flex; align-items: center; gap: 8px; }
    .limit-icon { font-size: 20px; color: #1976d2; }
    .limit-label { font-size: 10px; text-transform: uppercase; color: #999; font-weight: 600; }
    .limit-value { font-size: 13px; font-weight: 700; }
    .feature-list { list-style: none; padding: 0; margin: 0 0 20px; display: flex; flex-direction: column; gap: 10px; }
    .feature-list li { display: flex; align-items: center; gap: 8px; font-size: 13px; }
    mat-icon.check-icon { color: #2e7d32; font-size: 18px; width: 18px; height: 18px; }
    .plan-actions { display: flex; gap: 8px; }
    .plan-actions button { flex: 1; }
    @media (max-width: 1024px) { .plans-grid { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 640px)  { .plans-grid { grid-template-columns: 1fr; } }
  `],
})
export class SubscriptionPlansComponent {
  private dialog  = inject(MatDialog);
  private snack   = inject(MatSnackBar);

  annual = signal(false);

  plans = signal<Plan[]>([
    {
      id: 'starter',
      name: 'Starter',
      monthlyPrice: 29,
      annualPrice: 278,
      isActive: true,
      isMostPopular: false,
      limits: { users: 'Up to 5', storage: '10 GB', apiCalls: '10K / mo' },
      features: [
        'Core CRM module',
        'Lead & contact management',
        'Email integration',
        'Basic reports',
        'Community support',
      ],
    },
    {
      id: 'professional',
      name: 'Professional',
      monthlyPrice: 99,
      annualPrice: 950,
      isActive: true,
      isMostPopular: true,
      limits: { users: 'Up to 25', storage: '100 GB', apiCalls: '100K / mo' },
      features: [
        'Everything in Starter',
        'Pipeline & deal tracking',
        'Marketing campaigns',
        'REST API access',
        'Priority email support',
        'Custom fields & tags',
      ],
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      monthlyPrice: 299,
      annualPrice: 2870,
      isActive: true,
      isMostPopular: false,
      limits: { users: 'Unlimited', storage: '500 GB', apiCalls: 'Unlimited' },
      features: [
        'Everything in Professional',
        'AI-powered insights',
        'Custom integrations',
        'SSO / SAML 2.0',
        'Dedicated account manager',
        'SLA guarantee',
        'Audit logs & compliance',
      ],
    },
  ]);

  openDialog(plan?: Plan): void {
    const ref = this.dialog.open(PlanDialogComponent, {
      width: '620px',
      data: plan ?? null,
    });

    ref.afterClosed().subscribe((result: Plan | undefined) => {
      if (!result) return;

      this.plans.update(list => {
        const idx = list.findIndex(p => p.id === result.id);
        if (idx >= 0) {
          // Edit existing
          const updated = [...list];
          updated[idx] = result;
          this.snack.open(`"${result.name}" plan updated`, 'OK', { duration: 3000 });
          return updated;
        } else {
          // New plan
          this.snack.open(`"${result.name}" plan created`, 'OK', { duration: 3000 });
          return [...list, result];
        }
      });
    });
  }

  togglePlan(plan: Plan): void {
    this.plans.update(list =>
      list.map(p => p.id === plan.id ? { ...p, isActive: !p.isActive } : p)
    );
    const toggled = !plan.isActive;
    this.snack.open(
      `"${plan.name}" plan ${toggled ? 'activated' : 'deactivated'}`,
      'OK', { duration: 3000 },
    );
  }
}
