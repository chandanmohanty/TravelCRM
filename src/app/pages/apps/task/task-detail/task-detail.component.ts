import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TasksService } from 'src/app/core/services/tasks.service';
import { TimeEntriesService } from 'src/app/core/services/time-entries.service';
import { TaskDto, TimeEntryDto } from 'src/app/models/task.model';

@Component({
  selector: 'app-task-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, MatButtonModule, MatDividerModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="p-16">
      <div class="d-flex justify-content-between align-items-center m-b-16">
        <h3 class="m-0">Task Detail</h3>
        <button mat-icon-button (click)="closed.emit()"><mat-icon>close</mat-icon></button>
      </div>

      @if (loading()) {
        <div class="text-center p-32"><mat-spinner diameter="32"></mat-spinner></div>
      } @else if (task()) {
        <div>
          <h4>{{ task()!.title }}</h4>
          @if (task()!.description) { <p>{{ task()!.description }}</p> }
          <p><strong>Status:</strong> {{ task()!.status }}</p>
          <p><strong>Priority:</strong> {{ task()!.priority }}</p>
          @if (task()!.dueDate) { <p><strong>Due:</strong> {{ task()!.dueDate | date:'mediumDate' }}</p> }
          @if (task()!.estimatedMinutes) {
            <p><strong>Estimated:</strong> {{ task()!.estimatedMinutes }} min · <strong>Logged:</strong> {{ task()!.totalLoggedMinutes }} min</p>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" [style.width.%]="progressPct()"></div>
            </div>
          }

          <mat-divider class="m-y-16"></mat-divider>

          <div class="d-flex justify-content-between align-items-center">
            <h5 class="m-0">Subtasks ({{ task()!.children.length }})</h5>
            <button mat-stroked-button (click)="addSubtask()">+ Add subtask</button>
          </div>
          @for (child of task()!.children; track child.id) {
            <ng-container *ngTemplateOutlet="subtree; context: { node: child, depth: 0 }"></ng-container>
          }

          <ng-template #subtree let-node="node" let-depth="depth">
            <div class="subtask-row p-y-4" [style.margin-left.px]="depth * 16">
              <span>{{ node.title }} <small class="text-muted">({{ node.status }})</small></span>
              @if (node.children?.length) {
                @for (gc of node.children; track gc.id) {
                  <ng-container *ngTemplateOutlet="subtree; context: { node: gc, depth: depth + 1 }"></ng-container>
                }
              }
            </div>
          </ng-template>

          <mat-divider class="m-y-16"></mat-divider>

          <h5>Time Log</h5>
          <form [formGroup]="logForm" (ngSubmit)="logTime()" class="d-flex gap-8 align-items-start m-b-8">
            <mat-form-field appearance="outline" class="flex-grow-0" style="width: 100px;">
              <mat-label>Min</mat-label>
              <input matInput type="number" min="1" formControlName="minutes" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="flex-grow-1">
              <mat-label>Notes</mat-label>
              <input matInput formControlName="notes" maxlength="500" />
            </mat-form-field>
            <button mat-stroked-button type="submit" [disabled]="logForm.invalid || logging()">Log</button>
          </form>
          @if (entries().length === 0) {
            <div class="text-muted">No time logged yet.</div>
          } @else {
            <table class="w-100 time-log-table">
              <thead><tr><th>User</th><th>Min</th><th>Notes</th><th>When</th><th></th></tr></thead>
              <tbody>
                @for (e of entries(); track e.id) {
                  <tr>
                    <td>{{ e.userName }}</td>
                    <td>{{ e.minutes }}</td>
                    <td>{{ e.notes }}</td>
                    <td>{{ e.loggedAt | date:'short' }}</td>
                    <td>
                      <button mat-icon-button (click)="deleteEntry(e)"><mat-icon>delete</mat-icon></button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .progress-bar-bg { width: 100%; height: 8px; background: #e5e7eb; border-radius: 4px; }
    .progress-bar-fill { height: 100%; background: #3b82f6; border-radius: 4px; }
    .subtask-row { border-left: 2px solid #e5e7eb; padding-left: 8px; }
    .time-log-table th, .time-log-table td { padding: 4px 8px; text-align: left; font-size: 13px; }
  `],
})
export class TaskDetailComponent implements OnChanges {
  @Input({ required: true }) taskId!: string;
  @Output() closed = new EventEmitter<void>();
  @Output() changed = new EventEmitter<void>();

  private tasksApi = inject(TasksService);
  private timeApi = inject(TimeEntriesService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  loading = signal(true);
  logging = signal(false);
  task = signal<TaskDto | null>(null);
  entries = signal<TimeEntryDto[]>([]);

  logForm = this.fb.nonNullable.group({
    minutes: [30, [Validators.required, Validators.min(1), Validators.max(24 * 60)]],
    notes: ['', Validators.maxLength(500)],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['taskId'] && this.taskId) this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.tasksApi.get(this.taskId).subscribe({
      next: (t) => { this.task.set(t); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
    this.timeApi.list(this.taskId).subscribe(e => this.entries.set(e));
  }

  progressPct(): number {
    const t = this.task();
    if (!t || !t.estimatedMinutes) return 0;
    return Math.min(100, Math.round((t.totalLoggedMinutes / t.estimatedMinutes) * 100));
  }

  addSubtask(): void {
    this.router.navigate(['/apps/task/new'], { queryParams: { parentId: this.taskId } });
  }

  logTime(): void {
    if (this.logForm.invalid || this.logging()) return;
    const v = this.logForm.getRawValue();
    this.logging.set(true);
    this.timeApi.log(this.taskId, { minutes: v.minutes, notes: v.notes || null }).subscribe({
      next: () => {
        this.logForm.reset({ minutes: 30, notes: '' });
        this.logging.set(false);
        this.reload();
        this.changed.emit();
      },
      error: () => this.logging.set(false),
    });
  }

  deleteEntry(e: TimeEntryDto): void {
    if (!confirm('Delete this time entry?')) return;
    this.timeApi.delete(this.taskId, e.id).subscribe(() => { this.reload(); this.changed.emit(); });
  }
}
