import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TablerIconsModule } from 'angular-tabler-icons';

interface Coupon {
  code: string;
  discount: string;
  type: 'percent' | 'fixed';
  appliesTo: string;
  usageCount: number;
  usageLimit: number | null;
  expiresAt: string | null;
  isActive: boolean;
}

@Component({
  selector: 'app-coupons',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatTableModule, MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatSelectModule,
    MatDividerModule, MatTooltipModule, TablerIconsModule,
  ],
  template: `
    <div class="page-header m-b-24">
      <div class="header-row">
        <div>
          <h2 class="f-s-24 f-w-700 m-0">Coupons & Discounts</h2>
          <p class="text-muted m-0 m-t-4">Create promotional codes and discount vouchers for subscribers.</p>
        </div>
        <button mat-raised-button color="primary" (click)="showForm.set(!showForm())">
          <mat-icon>{{ showForm() ? 'close' : 'add' }}</mat-icon>
          {{ showForm() ? 'Cancel' : 'Create Coupon' }}
        </button>
      </div>
    </div>

    <!-- Create Form -->
    @if (showForm()) {
      <mat-card class="m-b-24">
        <mat-card-header>
          <div class="card-title-row">
            <span class="iconify f-s-20 text-primary" data-icon="solar:tag-line-duotone"></span>
            <mat-card-title>New Coupon</mat-card-title>
          </div>
        </mat-card-header>
        <mat-card-content class="p-t-16">
          <form [formGroup]="couponForm" (ngSubmit)="saveCoupon()">
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>Coupon Code</mat-label>
                <input matInput formControlName="code" placeholder="SUMMER25" style="text-transform:uppercase">
                <mat-hint>Alphanumeric, no spaces</mat-hint>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Discount Type</mat-label>
                <mat-select formControlName="type">
                  <mat-option value="percent">Percentage (%)</mat-option>
                  <mat-option value="fixed">Fixed Amount ($)</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>{{ couponForm.value.type === 'percent' ? 'Discount %' : 'Discount $' }}</mat-label>
                <input matInput formControlName="discount" type="number" min="1">
                <span matSuffix>{{ couponForm.value.type === 'percent' ? '%' : '$' }}</span>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Applies To</mat-label>
                <mat-select formControlName="appliesTo">
                  <mat-option value="All Plans">All Plans</mat-option>
                  <mat-option value="Starter">Starter Only</mat-option>
                  <mat-option value="Professional">Professional Only</mat-option>
                  <mat-option value="Enterprise">Enterprise Only</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Usage Limit (optional)</mat-label>
                <input matInput formControlName="usageLimit" type="number" placeholder="Leave blank for unlimited">
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Expires At (optional)</mat-label>
                <input matInput formControlName="expiresAt" type="date">
              </mat-form-field>
            </div>
            <div class="form-actions m-t-8">
              <button mat-stroked-button type="button" (click)="showForm.set(false)">Cancel</button>
              <button mat-raised-button color="primary" type="submit" [disabled]="couponForm.invalid">
                Create Coupon
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>
    }

    <!-- Table -->
    <mat-card>
      <mat-card-header>
        <div class="card-title-row">
          <span class="iconify f-s-20 text-primary" data-icon="solar:tag-price-line-duotone"></span>
          <mat-card-title>All Coupons</mat-card-title>
        </div>
      </mat-card-header>
      <mat-card-content>
        <table mat-table [dataSource]="coupons()" class="coupon-table">

          <ng-container matColumnDef="code">
            <th mat-header-cell *matHeaderCellDef>Code</th>
            <td mat-cell *matCellDef="let c">
              <code class="coupon-code">{{ c.code }}</code>
            </td>
          </ng-container>

          <ng-container matColumnDef="discount">
            <th mat-header-cell *matHeaderCellDef>Discount</th>
            <td mat-cell *matCellDef="let c">
              <span class="discount-badge">
                {{ c.type === 'percent' ? c.discount + '% off' : '$' + c.discount + ' off' }}
              </span>
            </td>
          </ng-container>

          <ng-container matColumnDef="appliesTo">
            <th mat-header-cell *matHeaderCellDef>Applies To</th>
            <td mat-cell *matCellDef="let c">{{ c.appliesTo }}</td>
          </ng-container>

          <ng-container matColumnDef="usage">
            <th mat-header-cell *matHeaderCellDef>Usage</th>
            <td mat-cell *matCellDef="let c">
              {{ c.usageCount }} / {{ c.usageLimit ?? '∞' }}
            </td>
          </ng-container>

          <ng-container matColumnDef="expires">
            <th mat-header-cell *matHeaderCellDef>Expires</th>
            <td mat-cell *matCellDef="let c">{{ c.expiresAt ?? 'Never' }}</td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let c">
              <span [class]="c.isActive ? 'status-active' : 'status-inactive'">
                {{ c.isActive ? 'Active' : 'Expired' }}
              </span>
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let c">
              <button mat-icon-button matTooltip="Deactivate" color="warn"
                      (click)="deactivate(c)" [disabled]="!c.isActive">
                <mat-icon>block</mat-icon>
              </button>
              <button mat-icon-button matTooltip="Delete" color="warn">
                <mat-icon>delete_outline</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns;"></tr>
        </table>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; }
    .card-title-row { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
    mat-card-content { padding: 16px !important; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
    .form-actions { display: flex; justify-content: flex-end; gap: 12px; }
    .coupon-code { background: #f0f0f0; padding: 3px 10px; border-radius: 6px; font-size: 13px; font-weight: 700; letter-spacing: 1px; }
    .discount-badge { background: #e8f5e9; color: #2e7d32; padding: 3px 10px; border-radius: 12px; font-size: 13px; font-weight: 700; }
    .status-active   { color: #2e7d32; font-weight: 600; font-size: 13px; }
    .status-inactive { color: #c62828; font-weight: 600; font-size: 13px; }
    .coupon-table { width: 100%; }
    @media (max-width: 768px) { .form-grid { grid-template-columns: 1fr; } }
  `],
})
export class CouponsComponent {
  private fb = inject(FormBuilder);

  showForm = signal(false);
  columns  = ['code', 'discount', 'appliesTo', 'usage', 'expires', 'status', 'actions'];

  private _coupons: Coupon[] = [
    { code: 'LAUNCH50',    discount: '50', type: 'percent', appliesTo: 'All Plans',     usageCount: 23,  usageLimit: 100,  expiresAt: '30 Apr 2026', isActive: true  },
    { code: 'ENTERPRISE2K',discount: '200',type: 'fixed',   appliesTo: 'Enterprise',    usageCount: 5,   usageLimit: null, expiresAt: null,          isActive: true  },
    { code: 'SUMMER25',    discount: '25', type: 'percent', appliesTo: 'All Plans',     usageCount: 0,   usageLimit: 200,  expiresAt: '31 Aug 2026', isActive: true  },
    { code: 'EARLY2026',   discount: '30', type: 'percent', appliesTo: 'Professional',  usageCount: 48,  usageLimit: 50,   expiresAt: '1 Jan 2026',  isActive: false },
    { code: 'PARTNER10',   discount: '10', type: 'percent', appliesTo: 'All Plans',     usageCount: 112, usageLimit: null, expiresAt: null,          isActive: true  },
  ];

  coupons = signal<Coupon[]>(this._coupons);

  couponForm = this.fb.group({
    code:       ['', [Validators.required, Validators.pattern(/^[A-Z0-9]+$/i)]],
    type:       ['percent', Validators.required],
    discount:   [null, [Validators.required, Validators.min(1)]],
    appliesTo:  ['All Plans', Validators.required],
    usageLimit: [null],
    expiresAt:  [null],
  });

  saveCoupon(): void {
    if (this.couponForm.invalid) return;
    const v = this.couponForm.getRawValue();
    const newCoupon: Coupon = {
      code:       (v.code ?? '').toUpperCase(),
      discount:   String(v.discount ?? 0),
      type:       v.type as 'percent' | 'fixed',
      appliesTo:  v.appliesTo ?? 'All Plans',
      usageCount: 0,
      usageLimit: v.usageLimit ? Number(v.usageLimit) : null,
      expiresAt:  v.expiresAt ?? null,
      isActive:   true,
    };
    this.coupons.update(list => [newCoupon, ...list]);
    this.showForm.set(false);
    this.couponForm.reset({ type: 'percent', appliesTo: 'All Plans' });
  }

  deactivate(coupon: Coupon): void {
    this.coupons.update(list =>
      list.map(c => c.code === coupon.code ? { ...c, isActive: false } : c));
  }
}
