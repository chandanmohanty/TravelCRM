import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastrService } from 'ngx-toastr';
import { IdentityApiService } from 'src/app/core/services/identity-api.service';
import { RoleDto } from 'src/app/core/models/identity.model';
import { HasPermissionDirective } from 'src/app/core/directives/has-permission.directive';

@Component({
  selector: 'app-roles-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterModule,
    MatCardModule, MatButtonModule, MatIconModule, MatTableModule,
    MatMenuModule, MatChipsModule, MatProgressSpinnerModule,
    HasPermissionDirective,
  ],
  template: `
    <div class="page-header m-b-24">
      <div class="header-row">
        <div>
          <h2 class="f-s-24 f-w-700 m-0">Roles & Permissions</h2>
          <p class="text-muted m-0 m-t-4">Manage custom roles and their permission matrix.</p>
        </div>
        <a mat-raised-button color="primary" [routerLink]="['new']"
           *hasPermission="'admin.roles.create'">
          <mat-icon>add</mat-icon> Add Role
        </a>
      </div>
    </div>

    <mat-card>
      <mat-card-content class="no-pad">
        @if (loading()) {
          <div class="loading-wrap"><mat-spinner diameter="32"></mat-spinner></div>
        } @else {
          <table mat-table [dataSource]="roles()" class="roles-table">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Role</th>
              <td mat-cell *matCellDef="let r">
                <div class="f-w-600">{{ r.name }}</div>
                <div class="text-muted f-s-12">{{ r.description || '—' }}</div>
              </td>
            </ng-container>
            <ng-container matColumnDef="slug">
              <th mat-header-cell *matHeaderCellDef>Slug</th>
              <td mat-cell *matCellDef="let r"><code class="code-chip">{{ r.slug || '—' }}</code></td>
            </ng-container>
            <ng-container matColumnDef="permissions">
              <th mat-header-cell *matHeaderCellDef>Permissions</th>
              <td mat-cell *matCellDef="let r">{{ r.permissionCount }}</td>
            </ng-container>
            <ng-container matColumnDef="users">
              <th mat-header-cell *matHeaderCellDef>Users</th>
              <td mat-cell *matCellDef="let r">{{ r.userCount }}</td>
            </ng-container>
            <ng-container matColumnDef="system">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let r">
                @if (r.isSystemRole) {
                  <mat-chip-set><mat-chip>System</mat-chip></mat-chip-set>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let r">
                <button mat-icon-button [matMenuTriggerFor]="menu">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #menu="matMenu">
                  <a mat-menu-item [routerLink]="[r.id]"><mat-icon>edit</mat-icon> Edit / Permissions</a>
                  @if (!r.isSystemRole) {
                    <button mat-menu-item *hasPermission="'admin.roles.delete'"
                            (click)="deleteRole(r)" [disabled]="r.userCount > 0">
                      <mat-icon color="warn">delete</mat-icon> Delete
                    </button>
                  }
                </mat-menu>
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .page-header { margin-bottom: 24px; }
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
    .loading-wrap { display: flex; justify-content: center; padding: 40px; }
    .no-pad { padding: 0 !important; }
    .roles-table { width: 100%; }
    .code-chip { font-family: ui-monospace, monospace; font-size: 11px; background: #f4f6fa; padding: 2px 8px; border-radius: 4px; }
  `],
})
export class RolesListComponent implements OnInit {
  private readonly api = inject(IdentityApiService);
  private readonly toastr = inject(ToastrService);

  readonly columns = ['name', 'slug', 'permissions', 'users', 'system', 'actions'];

  readonly loading = signal(true);
  readonly roles   = signal<RoleDto[]>([]);

  ngOnInit(): void { this.load(); }

  private load(): void {
    this.loading.set(true);
    this.api.listRoles().subscribe({
      next: r => { this.roles.set(r); this.loading.set(false); },
      error: err => { this.toastr.error(err?.error?.error || 'Failed to load.'); this.loading.set(false); },
    });
  }

  deleteRole(r: RoleDto): void {
    if (!confirm(`Delete role "${r.name}"?`)) return;
    this.api.deleteRole(r.id).subscribe({
      next: () => { this.toastr.success('Role deleted.'); this.load(); },
      error: err => this.toastr.error(err?.error?.error || 'Failed.'),
    });
  }
}
