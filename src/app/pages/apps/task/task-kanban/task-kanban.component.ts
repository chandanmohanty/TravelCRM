import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule, transferArrayItem, moveItemInArray } from '@angular/cdk/drag-drop';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TasksService } from 'src/app/core/services/tasks.service';
import { TaskDto, TaskStatus } from 'src/app/models/task.model';

@Component({
  selector: 'app-task-kanban',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, DragDropModule, RouterModule,
    MatButtonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule,
    TablerIconsModule,
  ],
  template: `
    <div class="crm-page">
      <div class="page-header">
        <div class="page-title">
          <h2>Kanban Board</h2>
          <span class="subtitle">Drag tasks between columns to update their status</span>
        </div>
        <div class="page-actions">
          <button mat-stroked-button [routerLink]="['/apps/task']">
            <i-tabler name="list" class="icon-sm mr-1"></i-tabler> List View
          </button>
          <button mat-flat-button color="primary" [routerLink]="['/apps/task/new']">
            <i-tabler name="plus" class="icon-sm mr-1"></i-tabler> New Task
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="spinner-wrap"><mat-spinner diameter="36"></mat-spinner></div>
      } @else {
        <div class="kanban-board">
          @for (col of columns; track col.status) {
            <div class="kanban-column">
              <div class="kanban-column-header" [class]="'col-' + col.status.toLowerCase()">
                <span class="col-title">{{ col.label }}</span>
                <span class="col-count">{{ col.tasks.length }}</span>
              </div>
              <div class="kanban-column-body"
                   cdkDropList
                   [id]="col.status"
                   [cdkDropListData]="col.tasks"
                   [cdkDropListConnectedTo]="connectedListIds"
                   (cdkDropListDropped)="onDrop($event)">
                @for (t of col.tasks; track t.id) {
                  <mat-card class="kanban-card" cdkDrag (click)="openTask(t)">
                    <mat-card-content>
                      <div class="card-top">
                        <span class="priority-dot" [class]="'p-' + t.priority.toLowerCase()"></span>
                        <span class="card-title">{{ t.title }}</span>
                      </div>
                      @if (t.taskTypeName) {
                        <span class="chip" [style.background]="t.taskTypeColor">{{ t.taskTypeName }}</span>
                      }
                      <div class="card-meta">
                        @if (t.dueDate) {
                          <span class="meta-item" [class.meta-overdue]="t.isOverdue">
                            <i-tabler name="calendar-event" class="icon-xs"></i-tabler>
                            {{ t.dueDate | date:'MMM d' }}
                          </span>
                        }
                        @if (t.totalLoggedMinutes > 0) {
                          <span class="meta-item">
                            <i-tabler name="clock" class="icon-xs"></i-tabler>
                            {{ t.totalLoggedMinutes }}m
                          </span>
                        }
                      </div>
                    </mat-card-content>
                  </mat-card>
                }
                @if (col.tasks.length === 0) {
                  <div class="empty-col">No tasks</div>
                }
              </div>
            </div>
          }
        </div>
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
    .mr-1 { margin-right: 4px; }

    .kanban-board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .kanban-column { background: #f1f5f9; border-radius: 10px; display: flex; flex-direction: column; }
    .kanban-column-header {
      padding: 12px 16px; display: flex; justify-content: space-between; align-items: center;
      border-radius: 10px 10px 0 0; font-weight: 600;
    }
    .kanban-column-header.col-todo       { background: #e2e8f0; color: #334155; }
    .kanban-column-header.col-inprogress { background: #fef3c7; color: #92400e; }
    .kanban-column-header.col-done       { background: #d1fae5; color: #065f46; }
    .col-count {
      background: rgba(255,255,255,0.7); padding: 2px 10px; border-radius: 12px;
      font-size: 12px;
    }

    .kanban-column-body {
      padding: 12px; min-height: 500px; display: flex; flex-direction: column; gap: 10px;
    }
    .kanban-card { cursor: grab; transition: box-shadow 0.15s, transform 0.15s; }
    .kanban-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .kanban-card mat-card-content { padding: 14px !important; }
    .card-top { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .card-title { font-weight: 500; line-height: 1.35; }
    .priority-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .priority-dot.p-low     { background: #6b7280; }
    .priority-dot.p-medium  { background: #3b82f6; }
    .priority-dot.p-high    { background: #f59e0b; }
    .priority-dot.p-urgent  { background: #ef4444; }

    .chip { display: inline-block; padding: 2px 10px; border-radius: 12px; color: #fff; font-size: 11px; margin-bottom: 8px; }

    .card-meta { display: flex; gap: 12px; color: #64748b; font-size: 12px; align-items: center; }
    .meta-item { display: inline-flex; align-items: center; gap: 4px; }
    .meta-overdue { color: #dc2626; font-weight: 500; }
    .icon-xs { width: 12px; height: 12px; }

    .empty-col { color: #94a3b8; font-size: 13px; padding: 20px; text-align: center; font-style: italic; }

    .cdk-drag-preview { box-shadow: 0 8px 24px rgba(0,0,0,0.18); }
    .cdk-drag-placeholder { opacity: 0.4; }
    .cdk-drop-list-dragging .kanban-card:not(.cdk-drag-placeholder) { transition: transform 250ms cubic-bezier(0,0,0.2,1); }

    @media (max-width: 900px) { .kanban-board { grid-template-columns: 1fr; } }
  `],
})
export class TaskKanbanComponent implements OnInit {
  private tasksApi = inject(TasksService);
  private router = inject(Router);

  loading = signal(true);
  columns: { status: TaskStatus; label: string; tasks: TaskDto[] }[] = [
    { status: 'ToDo', label: 'To Do', tasks: [] },
    { status: 'InProgress', label: 'In Progress', tasks: [] },
    { status: 'Done', label: 'Done', tasks: [] },
  ];
  connectedListIds = ['ToDo', 'InProgress', 'Done'];

  ngOnInit(): void {
    this.tasksApi.list({ includeDeleted: false }).subscribe({
      next: (tasks) => {
        for (const c of this.columns) c.tasks = [];
        for (const t of tasks) {
          const col = this.columns.find((c) => c.status === t.status);
          if (col) col.tasks.push(t);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onDrop(event: CdkDragDrop<TaskDto[]>): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }
    const task = event.previousContainer.data[event.previousIndex];
    const newStatus = event.container.id as TaskStatus;
    transferArrayItem(event.previousContainer.data, event.container.data,
                      event.previousIndex, event.currentIndex);
    this.tasksApi.updateStatus(task.id, newStatus).subscribe({
      next: () => { /* optimistic move applied */ },
      error: () => {
        transferArrayItem(event.container.data, event.previousContainer.data,
                          event.currentIndex, event.previousIndex);
      },
    });
  }

  openTask(t: TaskDto): void { this.router.navigate(['/apps/task', t.id, 'details']); }
}
