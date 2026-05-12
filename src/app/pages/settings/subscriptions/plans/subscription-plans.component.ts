import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TablerIconsModule } from 'angular-tabler-icons';
import { Inject } from '@angular/core';
import { EntitlementsService, PlanDto } from 'src/app/core/services/entitlements.service';

// ── Edit dialog ─────────────────────────────────────────────────────────────

interface PlanEditData {
  plan: PlanDto;
  knownFeatureCodes: string[];
}

@Component({
  selector: 'app-plan-edit-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatButtonModule, MatCheckboxModule, MatDialogModule, MatDividerModule,
    MatFormFieldModule, MatInputModule, MatTooltipModule,
  ],
  template: `
    <h2 mat-dialog-title>Edit plan — {{ data.plan.name }}</h2>

    <mat-dialog-content class="dialog-content">
      <form [formGroup]="form" class="plan-form">

        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-2">
            <mat-label>Plan name</mat-label>
            <input matInput formControlName="name" maxlength="100">
          </mat-form-field>
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Sort order</mat-label>
            <input matInput type="number" formControlName="sortOrder" min="0">
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full">
          <mat-label>Description</mat-label>
          <textarea matInput formControlName="description" rows="2" maxlength="500"></textarea>
        </mat-form-field>

        <!-- ── Pricing ─────────────────────────────────────────── -->
        <h4 class="section-h">Pricing ({{ data.plan.currency }})</h4>
        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Monthly per-user</mat-label>
            <input matInput type="number" formControlName="monthlyPrice" min="0">
          </mat-form-field>
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Annual per-user (per month)</mat-label>
            <input matInput type="number" formControlName="annualPricePerMonth" min="0">
          </mat-form-field>
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Flat monthly (overrides per-user)</mat-label>
            <input matInput type="number" formControlName="flatMonthlyPrice" min="0">
          </mat-form-field>
        </div>

        <!-- ── Limits ──────────────────────────────────────────── -->
        <h4 class="section-h">Hard limits <small class="text-muted">(blank = unlimited)</small></h4>
        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Seats</mat-label>
            <input matInput type="number" formControlName="seatLimit" min="1">
          </mat-form-field>
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Storage (GB)</mat-label>
            <input matInput type="number" formControlName="storageGbLimit" min="1">
          </mat-form-field>
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Webhooks</mat-label>
            <input matInput type="number" formControlName="webhookLimit" min="0">
          </mat-form-field>
        </div>
        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Workflow rules</mat-label>
            <input matInput type="number" formControlName="workflowRuleLimit" min="0">
          </mat-form-field>
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Marketing rules</mat-label>
            <input matInput type="number" formControlName="marketingRuleLimit" min="0">
          </mat-form-field>
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Chat licences</mat-label>
            <input matInput type="number" formControlName="chatLicenseLimit" min="0">
          </mat-form-field>
        </div>
        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Departments</mat-label>
            <input matInput type="number" formControlName="departmentLimit" min="1">
          </mat-form-field>
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Custom roles</mat-label>
            <input matInput type="number" formControlName="roleLimit" min="1">
          </mat-form-field>
        </div>

        <mat-divider class="m-t-16 m-b-16"></mat-divider>

        <div class="toggles">
          <mat-checkbox formControlName="isActive" color="primary">Active</mat-checkbox>
          <mat-checkbox formControlName="isContactSalesOnly" color="primary">Contact sales only</mat-checkbox>
        </div>

        <mat-divider class="m-t-16 m-b-16"></mat-divider>

        <!-- ── Features ────────────────────────────────────────── -->
        <h4 class="section-h">
          Features <small class="text-muted">({{ selectedCount() }} of {{ data.knownFeatureCodes.length }} enabled)</small>
        </h4>
        <div class="features-grid">
          @for (code of data.knownFeatureCodes; track code) {
            <mat-checkbox
              [checked]="selected().has(code)"
              (change)="toggleFeature(code, $event.checked)"
              color="primary"
              class="feature-checkbox">
              <span [matTooltip]="code">{{ humanise(code) }}</span>
            </mat-checkbox>
          }
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-stroked-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="form.invalid || saving()">
        {{ saving() ? 'Saving…' : 'Save changes' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-content { max-width: 720px; min-width: 560px; }
    .plan-form { display: flex; flex-direction: column; gap: 4px; }
    .form-row { display: flex; gap: 12px; }
    .flex-1 { flex: 1; }
    .flex-2 { flex: 2; }
    .full   { width: 100%; }
    .section-h {
      margin: 14px 0 8px; font-size: 11px; text-transform: uppercase;
      letter-spacing: .7px; color: #94a3b8; font-weight: 700;
    }
    .toggles { display: flex; gap: 24px; }
    .features-grid {
      display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 16px;
      max-height: 260px; overflow-y: auto; padding: 8px;
      border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;
    }
    .feature-checkbox { font-size: 12.5px; }
    .text-muted { color: #94a3b8; font-weight: 500; }
  `],
})
export class PlanEditDialogComponent {
  private readonly fb       = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<PlanEditDialogComponent>);
  private readonly snack    = inject(MatSnackBar);
  private readonly api      = inject(EntitlementsService);

  readonly saving   = signal(false);
  readonly selected = signal<Set<string>>(new Set());
  readonly selectedCount = computed(() => this.selected().size);

  readonly form = this.fb.group({
    name:                [this.data.plan.name, [Validators.required, Validators.maxLength(100)]],
    description:         [this.data.plan.description ?? ''],
    monthlyPrice:        [this.data.plan.monthlyPrice],
    annualPricePerMonth: [this.data.plan.annualPricePerMonth],
    flatMonthlyPrice:    [this.data.plan.flatMonthlyPrice],
    seatLimit:           [this.data.plan.seatLimit],
    storageGbLimit:      [this.data.plan.storageGbLimit],
    webhookLimit:        [this.data.plan.webhookLimit],
    workflowRuleLimit:   [this.data.plan.workflowRuleLimit],
    marketingRuleLimit:  [this.data.plan.marketingRuleLimit],
    chatLicenseLimit:    [this.data.plan.chatLicenseLimit],
    departmentLimit:     [this.data.plan.departmentLimit],
    roleLimit:           [this.data.plan.roleLimit],
    isActive:            [this.data.plan.isActive],
    isContactSalesOnly:  [this.data.plan.isContactSalesOnly],
    sortOrder:           [this.data.plan.sortOrder, [Validators.required, Validators.min(0)]],
  });

  constructor(@Inject(MAT_DIALOG_DATA) public readonly data: PlanEditData) {
    this.selected.set(new Set(data.plan.featureCodes));
  }

  toggleFeature(code: string, checked: boolean): void {
    const next = new Set(this.selected());
    checked ? next.add(code) : next.delete(code);
    this.selected.set(next);
  }

  humanise(code: string): string {
    // "whatsapp_bulk_campaign" → "WhatsApp bulk campaign"
    return code
      .split('_')
      .map((w, i) => i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)
      .join(' ');
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    this.api.updatePlan(this.data.plan.id, {
      ...this.data.plan,
      name:                v.name!,
      description:         v.description ?? null,
      monthlyPrice:        v.monthlyPrice ?? null,
      annualPricePerMonth: v.annualPricePerMonth ?? null,
      flatMonthlyPrice:    v.flatMonthlyPrice ?? null,
      currency:            this.data.plan.currency,
      seatLimit:           v.seatLimit ?? null,
      storageGbLimit:      v.storageGbLimit ?? null,
      webhookLimit:        v.webhookLimit ?? null,
      workflowRuleLimit:   v.workflowRuleLimit ?? null,
      marketingRuleLimit:  v.marketingRuleLimit ?? null,
      chatLicenseLimit:    v.chatLicenseLimit ?? null,
      departmentLimit:     v.departmentLimit ?? null,
      roleLimit:           v.roleLimit ?? null,
      isActive:            v.isActive ?? true,
      isContactSalesOnly:  v.isContactSalesOnly ?? false,
      sortOrder:           v.sortOrder!,
      featureCodes:        [...this.selected()],
    }).subscribe({
      next: (updated) => {
        this.snack.open('Plan updated.', 'Close', { duration: 2500 });
        this.dialogRef.close(updated);
      },
      error: (err) => {
        this.saving.set(false);
        this.snack.open(err?.error?.error ?? 'Save failed.', 'Close', { duration: 3500 });
      },
    });
  }
}

// ── Plans list page ─────────────────────────────────────────────────────────

@Component({
  selector: 'app-subscription-plans',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, DecimalPipe,
    MatButtonModule, MatCardModule, MatDialogModule, MatDividerModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatTableModule,
    MatTooltipModule, TablerIconsModule,
  ],
  template: `
    <div class="page-header m-b-24">
      <h2 class="f-s-24 f-w-700 m-0">Subscription plans</h2>
      <p class="text-muted m-0 m-t-4">
        Pricing tiers, hard limits and feature mapping. Edits apply immediately to every tenant
        on the plan.
      </p>
    </div>

    @if (loading()) {
      <div class="loading-wrap"><mat-spinner diameter="32"></mat-spinner></div>
    } @else {
      <mat-card>
        <mat-card-content class="p-0">
          <table mat-table [dataSource]="plans()" class="plans-table">

            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Plan</th>
              <td mat-cell *matCellDef="let p">
                <div class="plan-cell">
                  <span class="plan-badge" [ngClass]="'badge-' + p.code">{{ p.name }}</span>
                  @if (!p.isActive) {
                    <span class="muted-pill" matTooltip="Hidden from public pricing">Inactive</span>
                  }
                  @if (p.isContactSalesOnly) {
                    <span class="muted-pill" matTooltip="Platform-admin assignment only">Sales</span>
                  }
                </div>
                @if (p.description) {
                  <div class="desc">{{ p.description }}</div>
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="pricing">
              <th mat-header-cell *matHeaderCellDef>Pricing</th>
              <td mat-cell *matCellDef="let p">
                @if (p.flatMonthlyPrice !== null) {
                  ₹{{ p.flatMonthlyPrice | number:'1.0-0' }} <span class="muted">/ mo flat</span>
                } @else if (p.annualPricePerMonth !== null) {
                  ₹{{ p.annualPricePerMonth | number:'1.0-0' }} <span class="muted">/ user / mo</span>
                } @else {
                  Free
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="seats">
              <th mat-header-cell *matHeaderCellDef>Seats</th>
              <td mat-cell *matCellDef="let p">{{ p.seatLimit ?? '∞' }}</td>
            </ng-container>

            <ng-container matColumnDef="storage">
              <th mat-header-cell *matHeaderCellDef>Storage</th>
              <td mat-cell *matCellDef="let p">{{ p.storageGbLimit ? p.storageGbLimit + ' GB' : '∞' }}</td>
            </ng-container>

            <ng-container matColumnDef="features">
              <th mat-header-cell *matHeaderCellDef>Features</th>
              <td mat-cell *matCellDef="let p">
                <span class="feature-count">{{ p.featureCodes.length }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let p" class="actions-cell">
                <button mat-stroked-button color="primary" (click)="editPlan(p)">
                  <i-tabler name="pencil" class="icon-xs mr-1"></i-tabler> Edit
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="cols"></tr>
            <tr mat-row *matRowDef="let row; columns: cols;" class="plan-row"></tr>
          </table>
        </mat-card-content>
      </mat-card>
    }
  `,
  styles: [`
    .loading-wrap { display: flex; justify-content: center; padding: 40px; }

    .plans-table { width: 100%; }
    .plans-table .mat-mdc-header-cell {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .5px; color: #94a3b8; background: #fafafa;
      padding: 12px 16px;
    }
    .plans-table .mat-mdc-cell { padding: 12px 16px; }
    .plan-cell { display: flex; align-items: center; gap: 8px; }
    .plan-badge {
      display: inline-block; padding: 3px 10px; border-radius: 14px;
      font-size: 12px; font-weight: 700;
    }
    .badge-free       { background: #f1f5f9; color: #475569; }
    .badge-starter    { background: #dbeafe; color: #1d4ed8; }
    .badge-grow       { background: #dcfce7; color: #15803d; }
    .badge-scale      { background: #fef3c7; color: #b45309; }
    .badge-business   { background: #ede9fe; color: #6d28d9; }
    .badge-unlimited  { background: #fce7f3; color: #be185d; }
    .muted-pill {
      display: inline-block; padding: 2px 8px; border-radius: 12px;
      font-size: 10.5px; font-weight: 600; background: #f1f5f9; color: #64748b;
    }
    .desc { font-size: 12px; color: #64748b; margin-top: 4px; }
    .muted { color: #94a3b8; font-size: 12px; }
    .feature-count {
      display: inline-block; min-width: 32px; padding: 3px 10px;
      border-radius: 12px; background: #e0e7ff; color: #4338ca;
      font-weight: 700; text-align: center;
    }
    .actions-cell { width: 110px; text-align: right; }
    .icon-xs { width: 14px; height: 14px; }
    .mr-1 { margin-right: 4px; }
    .plan-row:hover .mat-mdc-cell { background: #f8fafc; }
  `],
})
export class SubscriptionPlansComponent implements OnInit {
  private readonly ents   = inject(EntitlementsService);
  private readonly dialog = inject(MatDialog);
  private readonly snack  = inject(MatSnackBar);

  readonly cols     = ['name', 'pricing', 'seats', 'storage', 'features', 'actions'];
  readonly plans    = signal<PlanDto[]>([]);
  readonly loading  = signal(true);

  /** Union of every feature code declared on any plan — used as the
   *  checkbox list in the edit dialog. Falls back to the current plan's
   *  codes if the union is somehow empty. */
  readonly knownFeatureCodes = computed(() => {
    const all = new Set<string>();
    for (const p of this.plans()) for (const c of p.featureCodes) all.add(c);
    return [...all].sort();
  });

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.ents.listAllPlans().subscribe({
      next: (plans) => {
        this.plans.set(plans);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snack.open('Failed to load plans.', 'Close', { duration: 3500 });
      },
    });
  }

  editPlan(plan: PlanDto): void {
    const ref = this.dialog.open(PlanEditDialogComponent, {
      data: { plan, knownFeatureCodes: this.knownFeatureCodes() } satisfies PlanEditData,
      width: '760px',
      maxHeight: '90vh',
    });
    ref.afterClosed().subscribe((updated: PlanDto | undefined) => {
      if (updated) this.refresh();
    });
  }
}

