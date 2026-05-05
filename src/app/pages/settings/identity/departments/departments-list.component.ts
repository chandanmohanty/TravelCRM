import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { ToastrService } from 'ngx-toastr';
import { IdentityApiService } from 'src/app/core/services/identity-api.service';
import { DepartmentDto } from 'src/app/core/models/identity.model';
import { HasPermissionDirective } from 'src/app/core/directives/has-permission.directive';

@Component({
  selector: 'app-departments-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterModule,
    MatCardModule, MatButtonModule, MatIconModule, MatTableModule,
    MatProgressSpinnerModule, MatMenuModule, HasPermissionDirective,
  ],
  template: `
    <div class="page-header m-b-24">
      <div class="header-row">
        <div>
          <h2 class="f-s-24 f-w-700 m-0">Departments</h2>
          <p class="text-muted m-0 m-t-4">Organise users into business units.</p>
        </div>
        <a mat-raised-button color="primary" [routerLink]="['new']"
           *hasPermission="'admin.departments.create'">
          <mat-icon>add</mat-icon> Add Department
        </a>
      </div>
    </div>

    <mat-card>
      <mat-card-content class="no-pad">
        @if (loading()) {
          <div class="loading-wrap"><mat-spinner diameter="32"></mat-spinner></div>
        } @else if (depts().length === 0) {
          <div class="empty-state">
            <mat-icon class="empty-icon">domain_disabled</mat-icon>
            <p>No departments yet.</p>
            <a mat-stroked-button color="primary" [routerLink]="['new']"
               *hasPermission="'admin.departments.create'">Create the first one</a>
          </div>
        } @else {
          <table mat-table [dataSource]="depts()" class="table">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Department</th>
              <td mat-cell *matCellDef="let d">
                <div class="f-w-600">{{ d.name }}</div>
                <div class="text-muted f-s-12">{{ d.description || '—' }}</div>
              </td>
            </ng-container>
            <ng-container matColumnDef="manager">
              <th mat-header-cell *matHeaderCellDef>Manager</th>
              <td mat-cell *matCellDef="let d">{{ d.managerName || '—' }}</td>
            </ng-container>
            <ng-container matColumnDef="users">
              <th mat-header-cell *matHeaderCellDef>Users</th>
              <td mat-cell *matCellDef="let d">{{ d.userCount }}</td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let d">
                <button mat-icon-button [matMenuTriggerFor]="menu">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #menu="matMenu">
                  <a mat-menu-item [routerLink]="[d.id]"><mat-icon>edit</mat-icon> Edit</a>
                  <button mat-menu-item *hasPermission="'admin.departments.delete'"
                          (click)="deleteDept(d)">
                    <mat-icon color="warn">delete</mat-icon> Delete
                  </button>
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
    .empty-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 40px; color: #8695ad; }
    .empty-icon { font-size: 40px; width: 40px; height: 40px; }
    .no-pad { padding: 0 !important; }
    .table { width: 100%; }
  `],
})
export class DepartmentsListComponent implements OnInit {
  private readonly api = inject(IdentityApiService);
  private readonly toastr = inject(ToastrService);

  readonly columns = ['name', 'manager', 'users', 'actions'];
  readonly loading = signal(true);
  readonly depts   = signal<DepartmentDto[]>([]);

  ngOnInit(): void { this.load(); }

  private load(): void {
    this.loading.set(true);
    this.api.listDepartments().subscribe({
      next: ds => { this.depts.set(ds); this.loading.set(false); },
      error: err => { this.toastr.error(err?.error?.error || 'Failed to load.'); this.loading.set(false); },
    });
  }

  deleteDept(d: DepartmentDto): void {
    if (!confirm(`Delete department "${d.name}"? Users will be un-assigned.`)) return;
    this.api.deleteDepartment(d.id).subscribe({
      next: () => { this.toastr.success('Department deleted.'); this.load(); },
      error: err => this.toastr.error(err?.error?.error || 'Failed.'),
    });
  }
}
