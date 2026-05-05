import {
  Component, ChangeDetectionStrategy, inject, signal, computed, OnInit,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastrService } from 'ngx-toastr';
import { IdentityApiService } from 'src/app/core/services/identity-api.service';
import { RoleDto, UserDto } from 'src/app/core/models/identity.model';
import { HasPermissionDirective } from 'src/app/core/directives/has-permission.directive';

@Component({
  selector: 'app-users-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, RouterModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatTableModule, MatPaginatorModule, MatMenuModule,
    MatChipsModule, MatProgressSpinnerModule, MatTooltipModule,
    HasPermissionDirective, DatePipe,
  ],
  template: `
    <div class="page-header m-b-24">
      <div class="header-row">
        <div>
          <h2 class="f-s-24 f-w-700 m-0">User Management</h2>
          <p class="text-muted m-0 m-t-4">Manage tenant users, roles, and access.</p>
        </div>
        <a mat-raised-button color="primary" [routerLink]="['new']"
           *hasPermission="'admin.users.create'">
          <mat-icon>person_add</mat-icon> Invite / Add User
        </a>
      </div>
    </div>

    <mat-card class="m-b-16">
      <mat-card-content>
        <div class="filters">
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Search</mat-label>
            <input matInput [ngModel]="search()" (ngModelChange)="onSearchChange($event)"
                   placeholder="name, email or employee id" />
            <mat-icon matPrefix>search</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Role</mat-label>
            <mat-select [ngModel]="roleFilter()" (ngModelChange)="onRoleChange($event)">
              <mat-option [value]="null">All roles</mat-option>
              @for (r of roles(); track r.id) {
                <mat-option [value]="r.id">{{ r.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Status</mat-label>
            <mat-select [ngModel]="statusFilter()" (ngModelChange)="onStatusChange($event)">
              <mat-option [value]="null">Any</mat-option>
              <mat-option value="Active">Active</mat-option>
              <mat-option value="Inactive">Inactive</mat-option>
              <mat-option value="PendingInvitation">Pending invite</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
      </mat-card-content>
    </mat-card>

    <mat-card>
      <mat-card-content class="no-pad">
        @if (loading()) {
          <div class="loading-wrap"><mat-spinner diameter="32"></mat-spinner></div>
        } @else if (users().length === 0) {
          <div class="empty-state">
            <mat-icon class="empty-icon">person_outline</mat-icon>
            <p>No users match your filters.</p>
          </div>
        } @else {
          <table mat-table [dataSource]="users()" class="users-table">
            <ng-container matColumnDef="user">
              <th mat-header-cell *matHeaderCellDef>User</th>
              <td mat-cell *matCellDef="let u">
                <div class="user-cell">
                  @if (u.avatarUrl) {
                    <img [src]="u.avatarUrl" alt="" class="avatar" />
                  } @else {
                    <div class="avatar avatar-initials">{{ initials(u) }}</div>
                  }
                  <div>
                    <div class="f-w-600">{{ u.fullName }}</div>
                    <div class="text-muted f-s-12">{{ u.email }}</div>
                  </div>
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="employeeId">
              <th mat-header-cell *matHeaderCellDef>Employee ID</th>
              <td mat-cell *matCellDef="let u">
                <code class="code-chip">{{ u.employeeId || '—' }}</code>
              </td>
            </ng-container>

            <ng-container matColumnDef="department">
              <th mat-header-cell *matHeaderCellDef>Department</th>
              <td mat-cell *matCellDef="let u">{{ u.departmentName || '—' }}</td>
            </ng-container>

            <ng-container matColumnDef="roles">
              <th mat-header-cell *matHeaderCellDef>Roles</th>
              <td mat-cell *matCellDef="let u">
                @for (r of u.roles; track r.id) {
                  <mat-chip-set><mat-chip>{{ r.name }}</mat-chip></mat-chip-set>
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let u">
                <span class="status status-{{ u.status | lowercase }}">{{ u.status }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="lastLogin">
              <th mat-header-cell *matHeaderCellDef>Last login</th>
              <td mat-cell *matCellDef="let u">
                {{ u.lastLoginAt ? (u.lastLoginAt | date:'short') : '—' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let u">
                <button mat-icon-button [matMenuTriggerFor]="menu">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #menu="matMenu">
                  <a mat-menu-item [routerLink]="[u.id]"><mat-icon>edit</mat-icon> Edit</a>
                  <button mat-menu-item *hasPermission="'admin.users.reset_password'"
                          (click)="sendResetLink(u)">
                    <mat-icon>lock_reset</mat-icon> Send reset link
                  </button>
                  <button mat-menu-item *hasPermission="'admin.users.deactivate'"
                          (click)="toggleStatus(u)">
                    <mat-icon>{{ u.status === 'Active' ? 'block' : 'check_circle' }}</mat-icon>
                    {{ u.status === 'Active' ? 'Deactivate' : 'Activate' }}
                  </button>
                  <button mat-menu-item *hasPermission="'admin.users.delete'"
                          (click)="deleteUser(u)">
                    <mat-icon color="warn">delete</mat-icon> Delete
                  </button>
                </mat-menu>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>

          <mat-paginator
            [length]="total()"
            [pageSize]="pageSize()"
            [pageIndex]="page() - 1"
            [pageSizeOptions]="[10, 20, 50]"
            (page)="onPage($event)">
          </mat-paginator>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .page-header { margin-bottom: 24px; }
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
    .filters { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 12px; align-items: center; }
    .search-field { width: 100%; }
    .loading-wrap { display: flex; justify-content: center; padding: 40px; }
    .empty-state { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px; color: #8695ad; }
    .empty-icon { font-size: 40px; width: 40px; height: 40px; }
    .no-pad { padding: 0 !important; }
    .users-table { width: 100%; }
    .user-cell { display: flex; align-items: center; gap: 10px; }
    .avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
    .avatar-initials {
      background: #e3ecff; color: #3458c0;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 600;
    }
    .code-chip {
      font-family: ui-monospace, monospace; font-size: 11px;
      background: #f4f6fa; padding: 2px 8px; border-radius: 4px;
    }
    .status { font-size: 11px; font-weight: 700; text-transform: uppercase;
              padding: 2px 10px; border-radius: 12px; letter-spacing: 0.3px; }
    .status-active { background: #e8f5e9; color: #2e7d32; }
    .status-inactive { background: #ffeeee; color: #b71c1c; }
    .status-pendinginvitation { background: #fff8e1; color: #8d6e00; }
    .status-suspended { background: #f3e5f5; color: #6a1b9a; }
    @media (max-width: 720px) { .filters { grid-template-columns: 1fr; } }
  `],
})
export class UsersListComponent implements OnInit {
  private readonly api = inject(IdentityApiService);
  private readonly toastr = inject(ToastrService);

  readonly columns = ['user', 'employeeId', 'department', 'roles', 'status', 'lastLogin', 'actions'];

  readonly loading  = signal(true);
  readonly users    = signal<UserDto[]>([]);
  readonly roles    = signal<RoleDto[]>([]);
  readonly total    = signal(0);
  readonly page     = signal(1);
  readonly pageSize = signal(20);
  readonly search       = signal<string>('');
  readonly statusFilter = signal<string | null>(null);
  readonly roleFilter   = signal<string | null>(null);

  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  initials(u: UserDto): string {
    const a = (u.firstName?.[0] ?? '').toUpperCase();
    const b = (u.lastName?.[0] ?? '').toUpperCase();
    return a + b || '?';
  }

  ngOnInit(): void {
    this.api.listRoles().subscribe({
      next: rs => this.roles.set(rs),
      error: () => {/* roles are optional for the list to show */},
    });
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.listUsers({
      page: this.page(), pageSize: this.pageSize(),
      search: this.search() || undefined,
      status: this.statusFilter() ?? undefined,
      roleId: this.roleFilter() ?? undefined,
    }).subscribe({
      next: r => {
        this.users.set(r.items);
        this.total.set(r.totalCount);
        this.loading.set(false);
      },
      error: err => {
        this.toastr.error(err?.error?.error || 'Failed to load users.');
        this.loading.set(false);
      },
    });
  }

  onSearchChange(v: string) {
    this.search.set(v);
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => {
      this.page.set(1);
      this.load();
    }, 300);
  }

  onRoleChange(v: string | null)   { this.roleFilter.set(v); this.page.set(1); this.load(); }
  onStatusChange(v: string | null) { this.statusFilter.set(v); this.page.set(1); this.load(); }

  onPage(e: PageEvent) {
    this.page.set(e.pageIndex + 1);
    this.pageSize.set(e.pageSize);
    this.load();
  }

  toggleStatus(u: UserDto) {
    const activate = u.status !== 'Active';
    this.api.toggleUserStatus(u.id, activate).subscribe({
      next: () => {
        this.toastr.success(`${u.fullName} is now ${activate ? 'Active' : 'Inactive'}.`);
        this.load();
      },
      error: err => this.toastr.error(err?.error?.error || 'Failed.'),
    });
  }

  sendResetLink(u: UserDto) {
    this.api.sendPasswordResetLink(u.id).subscribe({
      next: () => this.toastr.success(`Password reset link sent to ${u.email}.`),
      error: err => this.toastr.error(err?.error?.error || 'Failed.'),
    });
  }

  deleteUser(u: UserDto) {
    if (!confirm(`Delete user "${u.fullName}"? This can be undone by reactivating them — their history is preserved.`)) return;
    this.api.deleteUser(u.id).subscribe({
      next: () => { this.toastr.success('User deleted.'); this.load(); },
      error: err => this.toastr.error(err?.error?.error || 'Failed.'),
    });
  }
}
