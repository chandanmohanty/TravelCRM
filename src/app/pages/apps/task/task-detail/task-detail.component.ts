import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TasksService } from 'src/app/core/services/tasks.service';
import { TimeEntriesService } from 'src/app/core/services/time-entries.service';
import { TaskDto, TimeEntryDto } from 'src/app/models/task.model';

@Component({
  selector: 'app-task-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterModule,
    MatButtonModule, MatCardModule, MatDividerModule,
    MatFormFieldModule, MatIconModule, MatInputModule,
    MatProgressSpinnerModule, MatTooltipModule, TablerIconsModule,
  ],
  template: `
    <div class="crm-page">
      <div class="page-header">
        <div class="page-title">
          <h2>{{ task()?.title || 'Task Detail' }}</h2>
          <span class="subtitle">View subtasks, log time, and track progress</span>
        </div>
        <div class="page-actions">
          <button mat-stroked-button (click)="back()">
            <i-tabler name="arrow-left" class="icon-sm mr-1"></i-tabler> Back
          </button>
          @if (task()) {
            <button mat-flat-button color="primary" [routerLink]="['/apps/task', task()!.id]">
              <i-tabler name="pencil" class="icon-sm mr-1"></i-tabler> Edit
            </button>
          }
        </div>
      </div>

      @if (loading()) {
        <div class="spinner-wrap"><mat-spinner diameter="36"></mat-spinner></div>
      } @else if (task(); as t) {
        <div class="detail-grid">
          <!-- Left column: task fields -->
          <mat-card>
            <mat-card-content>
              <h3 class="section-h">Overview</h3>

              <div class="meta-row">
                <span class="badge" [class]="'st-' + t.status.toLowerCase()">{{ t.status }}</span>
                <span class="badge" [class]="'p-' + t.priority.toLowerCase()">{{ t.priority }}</span>
                @if (t.taskTypeName) {
                  <span class="chip" [style.background]="t.taskTypeColor">{{ t.taskTypeName }}</span>
                }
                @if (t.isOverdue) {
                  <span class="chip chip-danger">Overdue</span>
                }
                @if (t.isDeleted) {
                  <span class="chip chip-muted">Deleted</span>
                }
              </div>

              @if (t.description) {
                <p class="description">{{ t.description }}</p>
              } @else {
                <p class="description muted">No description.</p>
              }

              <div class="info-grid">
                <div>
                  <span class="info-label">Due Date</span>
                  <span class="info-value">{{ t.dueDate ? (t.dueDate | date:'mediumDate') : '—' }}</span>
                </div>
                <div>
                  <span class="info-label">Estimated</span>
                  <span class="info-value">{{ t.estimatedMinutes ? t.estimatedMinutes + ' min' : '—' }}</span>
                </div>
                <div>
                  <span class="info-label">Logged</span>
                  <span class="info-value">{{ t.totalLoggedMinutes }} min</span>
                </div>
                <div>
                  <span class="info-label">Created</span>
                  <span class="info-value">{{ t.createdAt | date:'mediumDate' }}</span>
                </div>
              </div>

              @if (t.estimatedMinutes) {
                <div class="progress-block">
                  <div class="progress-label">
                    <span>Progress</span>
                    <span>{{ progressPct() }}%</span>
                  </div>
                  <div class="progress-bar-bg">
                    <div class="progress-bar-fill" [style.width.%]="progressPct()"></div>
                  </div>
                </div>
              }
            </mat-card-content>
          </mat-card>

          <!-- Right column: subtasks -->
          <mat-card>
            <mat-card-content>
              <div class="section-head">
                <h3 class="section-h">Subtasks ({{ t.children.length }})</h3>
                <button mat-stroked-button (click)="addSubtask()">
                  <i-tabler name="plus" class="icon-sm mr-1"></i-tabler> Add subtask
                </button>
              </div>
              @if (t.children.length === 0) {
                <p class="muted">No subtasks yet.</p>
              } @else {
                <div class="subtask-tree">
                  @for (child of t.children; track child.id) {
                    <ng-container *ngTemplateOutlet="subtree; context: { node: child, depth: 0 }"></ng-container>
                  }
                </div>
              }

              <ng-template #subtree let-node="node" let-depth="depth">
                <div class="subtask-row" [style.padding-left.px]="depth * 20 + 8">
                  <span class="priority-dot" [class]="'p-' + node.priority.toLowerCase()"></span>
                  <span class="subtask-title">{{ node.title }}</span>
                  <span class="badge sm" [class]="'st-' + node.status.toLowerCase()">{{ node.status }}</span>
                  <a class="open-link" [routerLink]="['/apps/task', node.id, 'details']">
                    <i-tabler name="external-link" class="icon-sm"></i-tabler>
                  </a>
                </div>
                @if (node.children?.length) {
                  @for (gc of node.children; track gc.id) {
                    <ng-container *ngTemplateOutlet="subtree; context: { node: gc, depth: depth + 1 }"></ng-container>
                  }
                }
              </ng-template>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- Time log section, full width -->
        <mat-card class="time-log-card">
          <mat-card-content>
            <h3 class="section-h">Time Log</h3>

            <form [formGroup]="logForm" (ngSubmit)="logTime()" class="log-form">
              <mat-form-field appearance="outline" class="minutes-field">
                <mat-label>Minutes</mat-label>
                <input matInput type="number" min="1" formControlName="minutes" />
              </mat-form-field>
              <mat-form-field appearance="outline" class="notes-field">
                <mat-label>Notes (optional)</mat-label>
                <input matInput formControlName="notes" maxlength="500"
                       placeholder="What did you work on?" />
              </mat-form-field>
              <button mat-flat-button color="primary" type="submit"
                      [disabled]="logForm.invalid || logging()">
                <i-tabler name="clock-plus" class="icon-sm mr-1"></i-tabler>
                Log Time
              </button>
            </form>

            @if (entries().length === 0) {
              <p class="muted">No time logged yet.</p>
            } @else {
              <table class="log-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Minutes</th>
                    <th>Notes</th>
                    <th>When</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (e of entries(); track e.id) {
                    <tr>
                      <td>{{ e.userName || '—' }}</td>
                      <td><strong>{{ e.minutes }}</strong></td>
                      <td>{{ e.notes || '—' }}</td>
                      <td>{{ e.loggedAt | date:'short' }}</td>
                      <td>
                        <button mat-icon-button (click)="deleteEntry(e)" matTooltip="Delete entry">
                          <i-tabler name="trash" class="icon-sm"></i-tabler>
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </mat-card-content>
        </mat-card>
      } @else {
        <p class="muted">Task not found.</p>
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
    .muted { color: #94a3b8; font-style: italic; }
    .mr-1 { margin-right: 4px; }

    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }

    .section-h { margin: 0 0 16px; font-size: 16px; font-weight: 600; }
    .section-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .section-head .section-h { margin: 0; }

    .meta-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
    .badge { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
    .badge.sm { padding: 2px 8px; font-size: 10px; }
    .badge.st-todo       { background: #f1f5f9; color: #475569; }
    .badge.st-inprogress { background: #fff7e6; color: #b45309; }
    .badge.st-done       { background: #dcfce7; color: #15803d; }
    .badge.p-low    { background: #f1f5f9; color: #475569; }
    .badge.p-medium { background: #dbeafe; color: #1e40af; }
    .badge.p-high   { background: #ffedd5; color: #c2410c; }
    .badge.p-urgent { background: #fee2e2; color: #b91c1c; }

    .chip { padding: 3px 10px; border-radius: 12px; color: #fff; font-size: 11px; font-weight: 500; }
    .chip-danger { background: #ef4444; }
    .chip-muted  { background: #94a3b8; }

    .description { margin: 8px 0 16px; line-height: 1.55; color: #334155; }

    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #f1f5f9; }
    .info-label { display: block; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 2px; }
    .info-value { font-size: 14px; color: #0f172a; }

    .progress-block { margin-top: 16px; }
    .progress-label { display: flex; justify-content: space-between; font-size: 12px; color: #64748b; margin-bottom: 6px; }
    .progress-bar-bg { width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; }
    .progress-bar-fill { height: 100%; background: linear-gradient(90deg, #3b82f6, #6366f1); border-radius: 4px; transition: width 0.4s; }

    .subtask-tree { display: flex; flex-direction: column; gap: 4px; }
    .subtask-row {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 8px; border-radius: 6px;
    }
    .subtask-row:hover { background: #f8fafc; }
    .priority-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .priority-dot.p-low     { background: #6b7280; }
    .priority-dot.p-medium  { background: #3b82f6; }
    .priority-dot.p-high    { background: #f59e0b; }
    .priority-dot.p-urgent  { background: #ef4444; }
    .subtask-title { flex: 1; font-size: 14px; }
    .open-link { color: #6366f1; }

    .time-log-card mat-card-content { padding: 24px; }
    .log-form { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 16px; }
    .minutes-field { width: 140px; }
    .notes-field { flex: 1; }

    .log-table { width: 100%; border-collapse: collapse; }
    .log-table th, .log-table td { padding: 10px 12px; text-align: left; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
    .log-table th { color: #64748b; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; background: #f8fafc; }
    .log-table tbody tr:hover { background: #f8fafc; }

    @media (max-width: 900px) {
      .detail-grid { grid-template-columns: 1fr; }
      .log-form { flex-direction: column; }
      .minutes-field, .notes-field { width: 100%; }
    }
  `],
})
export class TaskDetailComponent implements OnInit {
  private tasksApi = inject(TasksService);
  private timeApi = inject(TimeEntriesService);
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  taskId = '';
  loading = signal(true);
  logging = signal(false);
  task = signal<TaskDto | null>(null);
  entries = signal<TimeEntryDto[]>([]);

  logForm = this.fb.nonNullable.group({
    minutes: [30, [Validators.required, Validators.min(1), Validators.max(24 * 60)]],
    notes: ['', Validators.maxLength(500)],
  });

  ngOnInit(): void {
    this.taskId = this.route.snapshot.paramMap.get('id')!;
    this.reload();
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
      },
      error: () => this.logging.set(false),
    });
  }

  deleteEntry(e: TimeEntryDto): void {
    if (!confirm('Delete this time entry?')) return;
    this.timeApi.delete(this.taskId, e.id).subscribe(() => this.reload());
  }

  back(): void { this.router.navigate(['/apps/task']); }
}
