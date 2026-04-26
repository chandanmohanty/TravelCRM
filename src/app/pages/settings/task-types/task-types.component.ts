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
  ],
  template: `
    <div class="p-24">
      <h2>Task Types</h2>
      <p class="text-muted">Define custom categories for tasks (e.g. Bug, Feature, Research).</p>

      <mat-card class="m-b-16">
        <mat-card-content>
          <h4>Add new type</h4>
          <form [formGroup]="form" (ngSubmit)="save()" class="d-flex gap-16 align-items-end">
            <mat-form-field appearance="outline" class="flex-grow-1">
              <mat-label>Name</mat-label>
              <input matInput formControlName="name" maxlength="100" />
            </mat-form-field>
            <mat-form-field appearance="outline" style="width: 140px;">
              <mat-label>Color (hex)</mat-label>
              <input matInput formControlName="color" placeholder="#3B82F6" />
            </mat-form-field>
            <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving()">Add</button>
          </form>
          @if (errorMessage()) { <div class="text-danger m-t-8">{{ errorMessage() }}</div> }
        </mat-card-content>
      </mat-card>

      <mat-card>
        <mat-card-content>
          @if (types().length === 0) {
            <div class="text-muted">No task types yet.</div>
          } @else {
            <table mat-table [dataSource]="types()" class="w-100">
              <ng-container matColumnDef="color">
                <th mat-header-cell *matHeaderCellDef>Color</th>
                <td mat-cell *matCellDef="let t">
                  <span class="swatch" [style.background]="t.color"></span>
                </td>
              </ng-container>
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Name</th>
                <td mat-cell *matCellDef="let t">{{ t.name }}</td>
              </ng-container>
              <ng-container matColumnDef="active">
                <th mat-header-cell *matHeaderCellDef>Active</th>
                <td mat-cell *matCellDef="let t">
                  <mat-slide-toggle [checked]="t.isActive" (change)="toggleActive(t, $event.checked)"></mat-slide-toggle>
                </td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let t">
                  <button mat-icon-button (click)="remove(t)"><mat-icon>delete</mat-icon></button>
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
    .swatch { display: inline-block; width: 20px; height: 20px; border-radius: 4px; }
    .text-danger { color: #ef4444; }
  `],
})
export class TaskTypesComponent implements OnInit {
  private api = inject(TaskTypesService);
  private fb = inject(FormBuilder);

  types = signal<TaskTypeDto[]>([]);
  saving = signal(false);
  errorMessage = signal<string | null>(null);
  displayedColumns = ['color', 'name', 'active', 'actions'];

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
