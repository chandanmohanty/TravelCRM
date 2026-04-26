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
    MatSelectModule,
  ],
  template: `
    <div class="p-24">
      <mat-card>
        <mat-card-content>
          <h2>{{ isEdit() ? 'Edit Task' : 'New Task' }}</h2>
          @if (loading()) {
            <div class="text-center p-32"><mat-spinner diameter="32"></mat-spinner></div>
          } @else {
            <form [formGroup]="form" (ngSubmit)="save()" class="d-flex flex-column gap-16">
              <mat-form-field appearance="outline">
                <mat-label>Title</mat-label>
                <input matInput formControlName="title" maxlength="200" />
                @if (form.controls.title.touched && form.controls.title.invalid) {
                  <mat-error>Title is required</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Description</mat-label>
                <textarea matInput formControlName="description" rows="4" maxlength="4000"></textarea>
              </mat-form-field>

              <div class="d-flex gap-16">
                <mat-form-field appearance="outline" class="flex-grow-1">
                  <mat-label>Status</mat-label>
                  <mat-select formControlName="status">
                    <mat-option value="ToDo">To Do</mat-option>
                    <mat-option value="InProgress">In Progress</mat-option>
                    <mat-option value="Done">Done</mat-option>
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline" class="flex-grow-1">
                  <mat-label>Priority</mat-label>
                  <mat-select formControlName="priority">
                    <mat-option value="Low">Low</mat-option>
                    <mat-option value="Medium">Medium</mat-option>
                    <mat-option value="High">High</mat-option>
                    <mat-option value="Urgent">Urgent</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              <div class="d-flex gap-16">
                <mat-form-field appearance="outline" class="flex-grow-1">
                  <mat-label>Type</mat-label>
                  <mat-select formControlName="taskTypeId">
                    <mat-option [value]="null">None</mat-option>
                    @for (t of taskTypes(); track t.id) {
                      <mat-option [value]="t.id">{{ t.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline" class="flex-grow-1">
                  <mat-label>Due Date</mat-label>
                  <input matInput [matDatepicker]="picker" formControlName="dueDate" />
                  <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
                  <mat-datepicker #picker></mat-datepicker>
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline">
                <mat-label>Estimated Minutes</mat-label>
                <input matInput type="number" min="1" formControlName="estimatedMinutes" />
              </mat-form-field>

              @if (errorMessage()) {
                <div class="text-danger">{{ errorMessage() }}</div>
              }

              <div class="d-flex gap-8">
                <button mat-flat-button color="primary" type="submit"
                        [disabled]="form.invalid || saving()">
                  {{ isEdit() ? 'Update' : 'Create' }}
                </button>
                <button mat-button type="button" (click)="cancel()">Cancel</button>
              </div>
            </form>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`.text-danger { color: #ef4444; }`],
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

    // Capture optional parentId from query params (when adding subtask)
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
