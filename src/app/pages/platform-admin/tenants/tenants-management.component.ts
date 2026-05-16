import {
  Component, ChangeDetectionStrategy, OnInit, signal, computed, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TablerIconsModule } from 'angular-tabler-icons';
import {
  PlatformAdminService, TenantDto, CreateTenantRequest
} from '../../../core/services/platform-admin.service';

@Component({
  selector: 'app-tenants-management',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatTableModule, MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatSelectModule,
    MatDialogModule, MatTooltipModule, MatChipsModule,
    MatPaginatorModule, MatProgressSpinnerModule, TablerIconsModule,
  ],
  template: `
    <div class="page-header m-b-24">
      <div class="header-row">
        <div>
          <h2 class="f-s-24 f-w-700 m-0">Tenant Management</h2>
          <p class="text-muted m-0 m-t-4">Create, configure and manage all organisations on this platform.</p>
        </div>
        <button mat-raised-button color="primary" (click)="showForm.set(!showForm())">
          <mat-icon>{{ showForm() ? 'close' : 'add' }}</mat-icon>
          {{ showForm() ? 'Cancel' : 'New Tenant' }}
        </button>
      </div>
    </div>

    <!-- Create Tenant Form ──────────────────────────────────────────────── -->
    @if (showForm()) {
      <mat-card class="m-b-24">
        <mat-card-header>
          <div class="card-title-row">
            <span class="iconify f-s-20 text-primary" data-icon="solar:buildings-3-line-duotone"></span>
            <mat-card-title>New Organisation</mat-card-title>
          </div>
        </mat-card-header>
        <mat-card-content class="p-t-16">
          <form [formGroup]="createForm" (ngSubmit)="createTenant()">

            <p class="section-label">Organisation Details</p>
            <div class="field-row">
              <mat-form-field appearance="outline">
                <mat-label>Organisation Name</mat-label>
                <input matInput formControlName="name" placeholder="Acme Travel">
                <mat-icon matPrefix>business</mat-icon>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Slug (URL identifier)</mat-label>
                <input matInput formControlName="slug" placeholder="acme">
                <span matPrefix class="slug-prefix">app /</span>
                <mat-hint>Lowercase letters, digits, hyphens only</mat-hint>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Plan</mat-label>
                <mat-select formControlName="plan">
                  <mat-option value="Starter">Starter</mat-option>
                  <mat-option value="Professional">Professional</mat-option>
                  <mat-option value="Enterprise">Enterprise</mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <p class="section-label m-t-8">Tenant Admin Account</p>
            <div class="field-row">
              <mat-form-field appearance="outline">
                <mat-label>Admin Email</mat-label>
                <input matInput formControlName="adminEmail" type="email" placeholder="admin@acme.com">
                <mat-icon matPrefix>email</mat-icon>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>First Name</mat-label>
                <input matInput formControlName="adminFirstName">
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Last Name</mat-label>
                <input matInput formControlName="adminLastName">
              </mat-form-field>
            </div>
            <div class="field-row half">
              <mat-form-field appearance="outline">
                <mat-label>Admin Password</mat-label>
                <input matInput formControlName="adminPassword" type="password">
                <mat-icon matPrefix>lock</mat-icon>
                <mat-hint>Min 8 chars, upper + lower + digit</mat-hint>
              </mat-form-field>
            </div>

            <div class="form-actions m-t-8">
              <button mat-stroked-button type="button" (click)="showForm.set(false)">Cancel</button>
              <button mat-raised-button color="primary" type="submit"
                      [disabled]="createForm.invalid || creating()">
                @if (creating()) {
                  <mat-spinner diameter="18" style="display:inline-block;vertical-align:middle;margin-right:8px"></mat-spinner>
                }
                Create Organisation
              </button>
            </div>

            @if (createError()) {
              <div class="form-error m-t-8">{{ createError() }}</div>
            }
          </form>
        </mat-card-content>
      </mat-card>
    }

    <!-- Tenant Table ────────────────────────────────────────────────────── -->
    <mat-card>
      <mat-card-header>
        <div class="card-title-row" style="justify-content:space-between;width:100%">
          <div class="card-title-row">
            <span class="iconify f-s-20 text-primary" data-icon="solar:buildings-2-line-duotone"></span>
            <mat-card-title>All Organisations</mat-card-title>
          </div>
          <mat-form-field appearance="outline" class="search-field" subscriptSizing="dynamic">
            <mat-label>Search</mat-label>
            <input matInput [value]="search()" (input)="onSearch($event)" placeholder="Name or slug…">
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>
        </div>
      </mat-card-header>
      <mat-card-content>

        @if (loading()) {
          <div class="loading-row"><mat-spinner diameter="40"></mat-spinner></div>
        } @else {
          <table mat-table [dataSource]="tenants()" class="tenant-table">

            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Organisation</th>
              <td mat-cell *matCellDef="let t">
                <div class="org-cell">
                  <div class="org-avatar">{{ t.name.charAt(0) }}</div>
                  <div>
                    <div class="org-name">{{ t.name }}</div>
                    <div class="org-slug">{{ t.slug }}</div>
                  </div>
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="plan">
              <th mat-header-cell *matHeaderCellDef>Plan</th>
              <td mat-cell *matCellDef="let t">
                <span [class]="'plan-chip plan-' + t.plan.toLowerCase()">{{ t.plan }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="users">
              <th mat-header-cell *matHeaderCellDef>Users</th>
              <td mat-cell *matCellDef="let t">{{ t.userCount }}</td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let t">
                <span [class]="t.isActive ? 'status-active' : 'status-inactive'">
                  {{ t.isActive ? 'Active' : 'Suspended' }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="created">
              <th mat-header-cell *matHeaderCellDef>Created</th>
              <td mat-cell *matCellDef="let t">{{ t.createdAt | date:'mediumDate' }}</td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let t">
                <button mat-icon-button
                        [matTooltip]="t.isActive ? 'Suspend tenant' : 'Activate tenant'"
                        [color]="t.isActive ? 'warn' : 'primary'"
                        (click)="toggle(t)">
                  <mat-icon>{{ t.isActive ? 'block' : 'check_circle' }}</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns;" class="tenant-row"></tr>
          </table>

          <mat-paginator
            [length]="totalCount()"
            [pageSize]="pageSize"
            [pageSizeOptions]="[10, 20, 50]"
            (page)="onPage($event)"
            showFirstLastButtons>
          </mat-paginator>
        }

      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; }
    .card-title-row { display: flex; align-items: center; gap: 10px; }
    mat-card-content { padding: 0 !important; }
    .search-field { max-width: 240px; }
    .section-label { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #999; margin: 0 0 8px; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
    .field-row.half { grid-template-columns: 1fr 2fr; }
    .slug-prefix { font-size: 12px; color: #999; margin-right: 4px; }
    .form-actions { display: flex; justify-content: flex-end; gap: 12px; }
    .form-error { color: #c62828; font-size: 13px; }
    mat-card-header { padding: 16px 16px 0; }
    .loading-row { display: flex; justify-content: center; padding: 40px; }
    .tenant-table { width: 100%; }
    .tenant-row:hover { background: #fafafa; }
    .org-cell { display: flex; align-items: center; gap: 12px; }
    .org-avatar {
      width: 36px; height: 36px; border-radius: 10px;
      background: linear-gradient(135deg, #1976d2, #42a5f5);
      color: white; display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 15px; flex-shrink: 0;
    }
    .org-name { font-weight: 600; font-size: 14px; }
    .org-slug { font-size: 12px; color: #888; }
    .plan-chip { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .plan-starter      { background: #e3f2fd; color: #1565c0; }
    .plan-professional { background: #f3e5f5; color: #6a1b9a; }
    .plan-enterprise   { background: #e8f5e9; color: #2e7d32; }
    .status-active   { color: #2e7d32; font-weight: 600; font-size: 13px; }
    .status-inactive { color: #c62828; font-weight: 600; font-size: 13px; }
    @media (max-width: 768px) { .field-row { grid-template-columns: 1fr; } }
  `],
})
export class TenantsManagementComponent implements OnInit {
  private svc = inject(PlatformAdminService);
  private fb  = inject(FormBuilder);

  columns    = ['name', 'plan', 'users', 'status', 'created', 'actions'];
  tenants    = signal<TenantDto[]>([]);
  totalCount = signal(0);
  loading    = signal(true);
  showForm   = signal(false);
  creating   = signal(false);
  createError = signal('');
  search     = signal('');
  page       = 1;
  pageSize   = 20;

  createForm = this.fb.group({
    name:           ['', Validators.required],
    slug:           ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
    plan:           ['Starter', Validators.required],
    adminEmail:     ['', [Validators.required, Validators.email]],
    adminFirstName: ['', Validators.required],
    adminLastName:  ['', Validators.required],
    adminPassword:  ['', [Validators.required, Validators.minLength(8)]],
  });

  private searchTimeout: any;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.svc.getTenants(this.page, this.pageSize, this.search()).subscribe({
      next: (res: import('../../../core/models/identity.model').PaginatedResponse<TenantDto>) => {
        this.tenants.set(res.items);
        this.totalCount.set(res.totalCount);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onSearch(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.search.set(val);
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => { this.page = 1; this.load(); }, 350);
  }

  onPage(e: PageEvent): void {
    this.page     = e.pageIndex + 1;
    this.pageSize = e.pageSize;
    this.load();
  }

  createTenant(): void {
    if (this.createForm.invalid) return;
    this.creating.set(true);
    this.createError.set('');
    const v = this.createForm.getRawValue();
    const req: CreateTenantRequest = {
      name:           v.name!,
      slug:           v.slug!,
      plan:           v.plan!,
      adminEmail:     v.adminEmail!,
      adminFirstName: v.adminFirstName!,
      adminLastName:  v.adminLastName!,
      adminPassword:  v.adminPassword!,
    };
    this.svc.createTenant(req).subscribe({
      next: (t: TenantDto) => {
        this.tenants.update(list => [t, ...list]);
        this.totalCount.update(n => n + 1);
        this.showForm.set(false);
        this.createForm.reset({ plan: 'Starter' });
        this.creating.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.createError.set(err?.error?.error ?? 'Failed to create tenant.');
        this.creating.set(false);
      },
    });
  }

  toggle(t: TenantDto): void {
    this.svc.toggleTenantStatus(t.id).subscribe({
      next: (res: { isActive: boolean }) => {
        this.tenants.update(list =>
          list.map(x => x.id === t.id ? { ...x, isActive: res.isActive } : x));
      },
    });
  }
}
