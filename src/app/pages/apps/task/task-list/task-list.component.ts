import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TasksService } from 'src/app/core/services/tasks.service';
import { TaskDto } from 'src/app/models/task.model';

@Component({
  selector: 'app-task-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, RouterModule,
    MatButtonModule, MatCardModule, MatChipsModule, MatExpansionModule,
    MatIconModule, MatProgressSpinnerModule,
    MatTooltipModule, TablerIconsModule,
  ],
  template: `
    <div class="crm-page">
      <div class="page-header">
        <div class="page-title">
          <h2>Tasks</h2>
          <span class="subtitle">Plan, assign, and track work across your team</span>
        </div>
        <div class="page-actions">
          <button mat-flat-button color="primary" [routerLink]="['/apps/task/new']">
            <i-tabler name="plus" class="icon-sm mr-1"></i-tabler> New Task
          </button>
        </div>
      </div>

      <div class="kpi-grid">
        <mat-card class="kpi-card">
          <mat-card-content>
            <div class="kpi-inner">
              <div class="kpi-icon" style="background:#e8f0fe">
                <i-tabler name="list-check" style="color:#1a73e8" class="icon-md"></i-tabler>
              </div>
              <div class="kpi-data">
                <span class="kpi-value">{{ todo().length }}</span>
                <span class="kpi-label">To Do</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="kpi-card">
          <mat-card-content>
            <div class="kpi-inner">
              <div class="kpi-icon" style="background:#fff7e6">
                <i-tabler name="loader" style="color:#f59e0b" class="icon-md"></i-tabler>
              </div>
              <div class="kpi-data">
                <span class="kpi-value">{{ inProgress().length }}</span>
                <span class="kpi-label">In Progress</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="kpi-card">
          <mat-card-content>
            <div class="kpi-inner">
              <div class="kpi-icon" style="background:#dcfce7">
                <i-tabler name="circle-check" style="color:#16a34a" class="icon-md"></i-tabler>
              </div>
              <div class="kpi-data">
                <span class="kpi-value">{{ done().length }}</span>
                <span class="kpi-label">Done</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="kpi-card">
          <mat-card-content>
            <div class="kpi-inner">
              <div class="kpi-icon" style="background:#fee2e2">
                <i-tabler name="alert-triangle" style="color:#dc2626" class="icon-md"></i-tabler>
              </div>
              <div class="kpi-data">
                <span class="kpi-value">{{ overdueCount() }}</span>
                <span class="kpi-label">Overdue</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      @if (errorMessage()) {
        <div class="error-banner">
          <i-tabler name="alert-circle" class="icon-sm"></i-tabler>
          {{ errorMessage() }}
        </div>
      }

      @if (loading()) {
        <div class="spinner-wrap"><mat-spinner diameter="36"></mat-spinner></div>
      } @else {
        <mat-accordion multi class="task-sections">
          <mat-expansion-panel [expanded]="true" class="task-section">
            <mat-expansion-panel-header>
              <mat-panel-title>
                <span class="section-dot section-todo"></span>
                To Do <span class="count">({{ todo().length }})</span>
              </mat-panel-title>
            </mat-expansion-panel-header>
            <div class="quick-add">
              <input class="quick-input" placeholder="Quick add task… press Enter"
                     [(ngModel)]="quickAddTitle" (keyup.enter)="quickAdd()" />
              <button mat-flat-button color="primary" (click)="quickAdd()" [disabled]="!quickAddTitle.trim()">
                <i-tabler name="plus" class="icon-sm"></i-tabler>
              </button>
            </div>
            <ng-container *ngTemplateOutlet="rows; context: { tasks: todo() }"></ng-container>
          </mat-expansion-panel>

          <mat-expansion-panel [expanded]="true" class="task-section">
            <mat-expansion-panel-header>
              <mat-panel-title>
                <span class="section-dot section-progress"></span>
                In Progress <span class="count">({{ inProgress().length }})</span>
              </mat-panel-title>
            </mat-expansion-panel-header>
            <ng-container *ngTemplateOutlet="rows; context: { tasks: inProgress() }"></ng-container>
          </mat-expansion-panel>

          <mat-expansion-panel class="task-section">
            <mat-expansion-panel-header>
              <mat-panel-title>
                <span class="section-dot section-done"></span>
                Done <span class="count">({{ done().length }})</span>
              </mat-panel-title>
            </mat-expansion-panel-header>
            <ng-container *ngTemplateOutlet="rows; context: { tasks: done() }"></ng-container>
          </mat-expansion-panel>

          <mat-expansion-panel class="task-section">
            <mat-expansion-panel-header>
              <mat-panel-title>
                <span class="section-dot section-deleted"></span>
                Deleted <span class="count">({{ deleted().length }})</span>
              </mat-panel-title>
            </mat-expansion-panel-header>
            <ng-container *ngTemplateOutlet="rows; context: { tasks: deleted() }"></ng-container>
          </mat-expansion-panel>
        </mat-accordion>
      }

      <ng-template #rows let-tasks="tasks">
        @if (tasks.length === 0) {
          <div class="empty">No tasks here</div>
        } @else {
          @for (t of tasks; track t.id) {
            <div class="task-row" (click)="openDetail(t)">
              <span class="priority-dot" [class]="'p-' + t.priority.toLowerCase()" [matTooltip]="t.priority"></span>
              <div class="task-main">
                <div class="task-title-row">
                  <span class="task-title">{{ t.title }}</span>
                  @if (t.taskTypeName) {
                    <span class="chip" [style.background]="t.taskTypeColor">{{ t.taskTypeName }}</span>
                  }
                  @if (t.isOverdue) {
                    <span class="chip chip-danger">Overdue</span>
                  }
                </div>
                <div class="task-meta">
                  <span>{{ t.priority }}</span>
                  <span class="dot-sep">·</span>
                  <span>Due: {{ t.dueDate ? (t.dueDate | date:'mediumDate') : '—' }}</span>
                  @if (t.totalLoggedMinutes > 0) {
                    <span class="dot-sep">·</span>
                    <span>{{ t.totalLoggedMinutes }} min logged</span>
                  }
                </div>
              </div>
              <div class="task-actions" (click)="$event.stopPropagation()">
                <button mat-icon-button [routerLink]="['/apps/task', t.id]" matTooltip="Edit">
                  <i-tabler name="pencil" class="icon-sm"></i-tabler>
                </button>
                @if (!t.isDeleted) {
                  <button mat-icon-button (click)="deleteTask(t)" matTooltip="Delete">
                    <i-tabler name="trash" class="icon-sm"></i-tabler>
                  </button>
                } @else {
                  <button mat-icon-button (click)="restoreTask(t)" matTooltip="Restore">
                    <i-tabler name="restore" class="icon-sm"></i-tabler>
                  </button>
                }
              </div>
            </div>
          }
        }
      </ng-template>
    </div>
  `,
  styles: [`
    .crm-page { padding: 24px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .page-title h2 { margin: 0; font-size: 22px; font-weight: 600; }
    .page-title .subtitle { color: #6c757d; font-size: 14px; }
    .page-actions { display: flex; gap: 8px; }

    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .kpi-card mat-card-content { padding: 16px; }
    .kpi-inner { display: flex; align-items: center; gap: 12px; }
    .kpi-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
    .kpi-data { display: flex; flex-direction: column; }
    .kpi-value { font-size: 24px; font-weight: 700; }
    .kpi-label { font-size: 13px; color: #6c757d; }

    .spinner-wrap { display: flex; justify-content: center; padding: 48px; }

    .error-banner {
      display: flex; align-items: center; gap: 8px;
      background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;
      padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 14px;
    }

    .task-sections { display: block; }
    .task-section { margin-bottom: 12px; border-radius: 8px !important; }
    .section-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 10px; }
    .section-todo     { background: #94a3b8; }
    .section-progress { background: #f59e0b; }
    .section-done     { background: #16a34a; }
    .section-deleted  { background: #dc2626; }
    .count { color: #6c757d; font-weight: 400; margin-left: 6px; }

    .quick-add { display: flex; gap: 8px; padding: 8px 0 12px; }
    .quick-input {
      flex: 1; padding: 10px 14px; border: 1px solid #e5e7eb; border-radius: 8px;
      font-size: 14px; outline: none; transition: border-color 0.15s;
    }
    .quick-input:focus { border-color: #6366f1; }

    .empty { color: #9ca3af; padding: 24px; text-align: center; font-style: italic; }

    .task-row {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 8px; border-bottom: 1px solid #f1f5f9; cursor: pointer;
      transition: background 0.12s;
    }
    .task-row:hover { background: #f8fafc; }
    .task-row:last-child { border-bottom: none; }
    .priority-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .priority-dot.p-low     { background: #6b7280; }
    .priority-dot.p-medium  { background: #3b82f6; }
    .priority-dot.p-high    { background: #f59e0b; }
    .priority-dot.p-urgent  { background: #ef4444; }
    .task-main { flex: 1; min-width: 0; }
    .task-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .task-title { font-weight: 500; }
    .task-meta { color: #6b7280; font-size: 12px; margin-top: 2px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
    .dot-sep { color: #cbd5e1; }
    .task-actions { display: flex; gap: 2px; flex-shrink: 0; }

    .chip { padding: 2px 10px; border-radius: 12px; color: #fff; font-size: 11px; font-weight: 500; }
    .chip-danger { background: #ef4444; }

    @media (max-width: 1100px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 600px) {
      .kpi-grid { grid-template-columns: 1fr; }
      .page-header { flex-direction: column; gap: 16px; }
    }
  `],
})
export class TaskListComponent implements OnInit {
  private tasksApi = inject(TasksService);
  private router = inject(Router);

  loading = signal(true);
  allTasks = signal<TaskDto[]>([]);
  quickAddTitle = '';
  errorMessage = signal<string | null>(null);

  todo = computed(() => this.allTasks().filter(t => t.status === 'ToDo' && !t.isDeleted));
  inProgress = computed(() => this.allTasks().filter(t => t.status === 'InProgress' && !t.isDeleted));
  done = computed(() => this.allTasks().filter(t => t.status === 'Done' && !t.isDeleted));
  deleted = computed(() => this.allTasks().filter(t => t.isDeleted));
  overdueCount = computed(() => this.allTasks().filter(t => t.isOverdue && !t.isDeleted).length);

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.tasksApi
      .list({ includeDeleted: true })
      .subscribe({
        next: (res) => { this.allTasks.set(res); this.loading.set(false); this.errorMessage.set(null); },
        error: (err) => { this.handleApiError(err, 'Failed to load tasks'); this.loading.set(false); },
      });
  }

  openDetail(t: TaskDto): void { this.router.navigate(['/apps/task', t.id, 'details']); }

  quickAdd(): void {
    const title = this.quickAddTitle.trim();
    if (!title) return;
    this.errorMessage.set(null);
    this.tasksApi
      .create({ title, status: 'ToDo', priority: 'Medium' })
      .subscribe({
        next: () => { this.quickAddTitle = ''; this.reload(); },
        error: (err) => this.handleApiError(err, 'Failed to add task'),
      });
  }

  deleteTask(t: TaskDto): void {
    if (!confirm(`Delete task "${t.title}"?`)) return;
    this.errorMessage.set(null);
    this.tasksApi.delete(t.id).subscribe({
      next: () => this.reload(),
      error: (err) => this.handleApiError(err, 'Failed to delete task'),
    });
  }

  restoreTask(t: TaskDto): void {
    this.errorMessage.set(null);
    this.tasksApi.restore(t.id).subscribe({
      next: () => this.reload(),
      error: (err) => this.handleApiError(err, 'Failed to restore task'),
    });
  }

  private handleApiError(err: any, fallback: string): void {
    if (err?.status === 401) {
      this.errorMessage.set('Your session expired. Please log out and sign in again.');
    } else if (err?.status === 403) {
      this.errorMessage.set(
        'You don\'t have permission to manage tasks. If your role was just updated, sign out and sign back in to refresh your access.'
      );
    } else {
      this.errorMessage.set(err?.error?.error ?? fallback);
    }
  }
}
