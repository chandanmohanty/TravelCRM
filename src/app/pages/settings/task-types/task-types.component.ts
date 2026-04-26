import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TaskTypesService } from 'src/app/core/services/task-types.service';
import { TaskTypeDto } from 'src/app/models/task.model';

@Component({
  selector: 'app-task-types',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule,
    MatButtonModule, MatCardModule, MatFormFieldModule,
    MatIconModule, MatInputModule, MatSlideToggleModule, MatTableModule,
    MatTooltipModule, TablerIconsModule,
  ],
  template: `
    <div class="crm-page">
      <div class="page-header">
        <div class="page-title">
          <h2>Task Types</h2>
          <span class="subtitle">Define custom categories for tasks (e.g. Bug, Feature, Research)</span>
        </div>
      </div>

      <mat-card class="add-card">
        <mat-card-content>
          <h3 class="section-h">Add new type</h3>
          <form [formGroup]="form" (ngSubmit)="save()" class="add-form">
            <mat-form-field appearance="outline" class="name-field">
              <mat-label>Name</mat-label>
              <input matInput formControlName="name" maxlength="100" placeholder="e.g. Bug" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="color-field">
              <mat-label>Color (hex)</mat-label>
              <input matInput formControlName="color" placeholder="#3B82F6" />
              <span matSuffix class="color-preview" [style.background]="form.controls.color.value"></span>
            </mat-form-field>
            <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving()">
              <i-tabler name="plus" class="icon-sm mr-1"></i-tabler> Add
            </button>
          </form>
          @if (errorMessage()) {
            <div class="error-banner">
              <i-tabler name="alert-circle" class="icon-sm"></i-tabler>
              {{ errorMessage() }}
            </div>
          }
        </mat-card-content>
      </mat-card>

      <mat-card class="list-card">
        <mat-card-content>
          @if (types().length === 0) {
            <div class="empty">
              <i-tabler name="tag" class="icon-lg"></i-tabler>
              <p>No task types yet. Add one above to get started.</p>
            </div>
          } @else {
            <table mat-table [dataSource]="types()" class="types-table">
              <ng-container matColumnDef="color">
                <th mat-header-cell *matHeaderCellDef>Color</th>
                <td mat-cell *matCellDef="let t">
                  <span class="swatch" [style.background]="t.color"></span>
                </td>
              </ng-container>
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Name</th>
                <td mat-cell *matCellDef="let t"><strong>{{ t.name }}</strong></td>
              </ng-container>
              <ng-container matColumnDef="hex">
                <th mat-header-cell *matHeaderCellDef>Hex</th>
                <td mat-cell *matCellDef="let t"><code>{{ t.color }}</code></td>
              </ng-container>
              <ng-container matColumnDef="active">
                <th mat-header-cell *matHeaderCellDef>Active</th>
                <td mat-cell *matCellDef="let t">
                  <mat-slide-toggle [checked]="t.isActive" (change)="toggleActive(t, $event.checked)"></mat-slide-toggle>
                </td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="actions-col"></th>
                <td mat-cell *matCellDef="let t" class="actions-col">
                  <button mat-icon-button (click)="remove(t)" matTooltip="Delete">
                    <i-tabler name="trash" class="icon-sm"></i-tabler>
                  </button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
            </table>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .crm-page { padding: 24px; max-width: 1100px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .page-title h2 { margin: 0; font-size: 22px; font-weight: 600; }
    .page-title .subtitle { color: #6c757d; font-size: 14px; }
    .mr-1 { margin-right: 4px; }

    .add-card { margin-bottom: 16px; }
    .add-card mat-card-content { padding: 20px 24px; }
    .list-card mat-card-content { padding: 0; }
    .section-h { margin: 0 0 16px; font-size: 14px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.4px; }

    .add-form { display: flex; gap: 16px; align-items: flex-start; }
    .name-field { flex: 1; min-width: 240px; }
    .color-field { width: 200px; }
    .color-preview {
      display: inline-block; width: 18px; height: 18px; border-radius: 4px;
      border: 1px solid #e5e7eb; margin-right: 4px; vertical-align: middle;
    }

    .error-banner {
      display: flex; align-items: center; gap: 8px;
      background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;
      padding: 10px 14px; border-radius: 8px; margin-top: 12px; font-size: 13px;
    }

    .empty {
      text-align: center; padding: 48px 24px; color: #94a3b8;
    }
    .empty i-tabler { color: #cbd5e1; margin-bottom: 12px; }
    .empty p { margin: 0; }

    .types-table { width: 100%; }
    .types-table th { background: #f8fafc; font-weight: 600; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; }
    .types-table td { padding: 12px 16px; }
    .swatch { display: inline-block; width: 24px; height: 24px; border-radius: 6px; border: 1px solid rgba(0,0,0,0.05); }
    .types-table code { background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-size: 12px; color: #334155; }
    .actions-col { width: 60px; text-align: right; }
  `],
})
export class TaskTypesComponent implements OnInit {
  private api = inject(TaskTypesService);
  private fb = inject(FormBuilder);

  types = signal<TaskTypeDto[]>([]);
  saving = signal(false);
  errorMessage = signal<string | null>(null);
  displayedColumns = ['color', 'name', 'hex', 'active', 'actions'];

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    color: ['#3B82F6', [Validators.required, Validators.pattern(/^#[0-9A-Fa-f]{6}$/)]],
  });

  ngOnInit(): void { this.reload(); }

  reload(): void {
    this.api.list().subscribe(t => this.types.set(t));
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.errorMessage.set(null);
    const v = this.form.getRawValue();
    this.api.create({ name: v.name, color: v.color }).subscribe({
      next: () => { this.form.reset({ name: '', color: '#3B82F6' }); this.saving.set(false); this.reload(); },
      error: (err) => { this.errorMessage.set(err?.error?.error ?? 'Save failed'); this.saving.set(false); },
    });
  }

  toggleActive(t: TaskTypeDto, isActive: boolean): void {
    this.api.update(t.id, { name: t.name, color: t.color, isActive }).subscribe(() => this.reload());
  }

  remove(t: TaskTypeDto): void {
    if (!confirm(`Delete task type "${t.name}"?`)) return;
    this.api.delete(t.id).subscribe({
      next: () => this.reload(),
      error: (err) => alert(err?.error?.error ?? 'Delete failed'),
    });
  }
}
