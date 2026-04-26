import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TasksService } from 'src/app/core/services/tasks.service';
import { TaskTypesService } from 'src/app/core/services/task-types.service';
import { TaskTypeDto, TaskWriteBody } from 'src/app/models/task.model';

@Component({
  selector: 'app-task-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule, RouterModule,
    MatButtonModule, MatCardModule, MatDatepickerModule, MatNativeDateModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule,
    MatSelectModule, TablerIconsModule,
  ],
  template: `
    <div class="crm-page">
      <div class="page-header">
        <div class="page-title">
          <h2>{{ isEdit() ? 'Edit Task' : 'New Task' }}</h2>
          <span class="subtitle">
            {{ isEdit() ? 'Update task details, status, or priority' : 'Create a task and assign it to your team' }}
          </span>
        </div>
        <div class="page-actions">
          <button mat-stroked-button (click)="cancel()">
            <i-tabler name="arrow-left" class="icon-sm mr-1"></i-tabler> Back
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="spinner-wrap"><mat-spinner diameter="36"></mat-spinner></div>
      } @else {
        <mat-card class="form-card">
          <mat-card-content>
            <form [formGroup]="form" (ngSubmit)="save()" class="task-form">
              <mat-form-field appearance="outline" class="full">
                <mat-label>Title</mat-label>
                <input matInput formControlName="title" maxlength="200" placeholder="What needs doing?" />
                @if (form.controls.title.touched && form.controls.title.invalid) {
                  <mat-error>Title is required</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="full">
                <mat-label>Description</mat-label>
                <textarea matInput formControlName="description" rows="4" maxlength="4000"
                          placeholder="Add context, links, or acceptance criteria…"></textarea>
              </mat-form-field>

              <div class="form-row">
                <mat-form-field appearance="outline">
                  <mat-label>Status</mat-label>
                  <mat-select formControlName="status">
                    <mat-option value="ToDo">To Do</mat-option>
                    <mat-option value="InProgress">In Progress</mat-option>
                    <mat-option value="Done">Done</mat-option>
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Priority</mat-label>
                  <mat-select formControlName="priority">
                    <mat-option value="Low">Low</mat-option>
                    <mat-option value="Medium">Medium</mat-option>
                    <mat-option value="High">High</mat-option>
                    <mat-option value="Urgent">Urgent</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              <div class="form-row">
                <mat-form-field appearance="outline">
                  <mat-label>Type</mat-label>
                  <mat-select formControlName="taskTypeId">
                    <mat-option [value]="null">— None —</mat-option>
                    @for (t of taskTypes(); track t.id) {
                      <mat-option [value]="t.id">{{ t.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Due Date</mat-label>
                  <input matInput [matDatepicker]="picker" formControlName="dueDate" />
                  <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
                  <mat-datepicker #picker></mat-datepicker>
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline" class="estimate">
                <mat-label>Estimated Minutes</mat-label>
                <input matInput type="number" min="1" formControlName="estimatedMinutes"
                       placeholder="e.g. 60" />
                <span matSuffix class="suffix-hint">min</span>
              </mat-form-field>

              @if (errorMessage()) {
                <div class="error-banner">
                  <i-tabler name="alert-circle" class="icon-sm"></i-tabler>
                  {{ errorMessage() }}
                </div>
              }

              <div class="form-actions">
                <button mat-button type="button" (click)="cancel()">Cancel</button>
                <button mat-flat-button color="primary" type="submit"
                        [disabled]="form.invalid || saving()">
                  @if (saving()) {
                    <mat-spinner diameter="16" class="btn-spinner"></mat-spinner>
                  } @else {
                    <i-tabler [name]="isEdit() ? 'check' : 'plus'" class="icon-sm mr-1"></i-tabler>
                  }
                  {{ isEdit() ? 'Save Changes' : 'Create Task' }}
                </button>
              </div>
            </form>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .crm-page { padding: 24px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .page-title h2 { margin: 0; font-size: 22px; font-weight: 600; }
    .page-title .subtitle { color: #6c757d; font-size: 14px; }
    .page-actions { display: flex; gap: 8px; }
    .spinner-wrap { display: flex; justify-content: center; padding: 48px; }

    .form-card { max-width: 760px; }
    .form-card mat-card-content { padding: 24px; }

    .task-form {
      display: flex;
      flex-direction: column;
      gap: 0;
    }
    .task-form .full { width: 100%; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .estimate { max-width: 240px; }
    .suffix-hint { color: #94a3b8; font-size: 12px; margin-right: 4px; }

    .error-banner {
      display: flex; align-items: center; gap: 8px;
      background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;
      padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 13px;
    }

    .form-actions {
      display: flex; justify-content: flex-end; gap: 8px;
      margin-top: 8px; padding-top: 16px; border-top: 1px solid #f1f5f9;
    }
    .btn-spinner { display: inline-block; margin-right: 8px; }
    .mr-1 { margin-right: 4px; }

    @media (max-width: 600px) {
      .form-row { grid-template-columns: 1fr; }
      .page-header { flex-direction: column; gap: 16px; }
    }
  `],
})
export class TaskFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private tasksApi = inject(TasksService);
  private typesApi = inject(TaskTypesService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  loading = signal(true);
  saving = signal(false);
  errorMessage = signal<string | null>(null);
  taskTypes = signal<TaskTypeDto[]>([]);
  taskId = signal<string | null>(null);
  isEdit = signal(false);
  parentTaskId = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: [null as string | null],
    status: ['ToDo' as 'ToDo' | 'InProgress' | 'Done', Validators.required],
    priority: ['Medium' as 'Low' | 'Medium' | 'High' | 'Urgent', Validators.required],
    taskTypeId: [null as string | null],
    dueDate: [null as Date | null],
    estimatedMinutes: [null as number | null],
  });

  ngOnInit(): void {
    this.typesApi.list().subscribe(t => this.taskTypes.set(t));

    const parentId = this.route.snapshot.queryParamMap.get('parentId');
    if (parentId) this.parentTaskId.set(parentId);

    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.taskId.set(id);
      this.isEdit.set(true);
      this.tasksApi.get(id).subscribe({
        next: (task) => {
          this.form.patchValue({
            title: task.title,
            description: task.description ?? null,
            status: task.status,
            priority: task.priority,
            taskTypeId: task.taskTypeId ?? null,
            dueDate: task.dueDate ? new Date(task.dueDate) : null,
            estimatedMinutes: task.estimatedMinutes ?? null,
          });
          this.parentTaskId.set(task.parentTaskId ?? null);
          this.loading.set(false);
        },
        error: () => { this.errorMessage.set('Failed to load task'); this.loading.set(false); },
      });
    } else {
      this.loading.set(false);
    }
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.errorMessage.set(null);

    const v = this.form.getRawValue();
    const body: TaskWriteBody = {
      title: v.title,
      description: v.description,
      status: v.status,
      priority: v.priority,
      taskTypeId: v.taskTypeId,
      assignedToUserId: null,
      parentTaskId: this.parentTaskId(),
      dueDate: v.dueDate ? v.dueDate.toISOString() : null,
      estimatedMinutes: v.estimatedMinutes,
    };

    const op$ = this.isEdit()
      ? this.tasksApi.update(this.taskId()!, body)
      : this.tasksApi.create(body);

    op$.subscribe({
      next: () => this.router.navigate(['/apps/task']),
      error: (err) => {
        this.errorMessage.set(err?.error?.error ?? 'Save failed');
        this.saving.set(false);
      },
    });
  }

  cancel(): void { this.router.navigate(['/apps/task']); }
}
