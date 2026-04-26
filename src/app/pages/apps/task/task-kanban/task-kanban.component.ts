import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule, transferArrayItem, moveItemInArray } from '@angular/cdk/drag-drop';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TasksService } from 'src/app/core/services/tasks.service';
import { TaskDto, TaskStatus } from 'src/app/models/task.model';

@Component({
  selector: 'app-task-kanban',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, DragDropModule, MatButtonModule, MatCardModule,
    MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="p-24">
      <div class="d-flex justify-content-between align-items-center m-b-16">
        <h2 class="m-0">Kanban Board</h2>
        <button mat-flat-button color="primary" (click)="goToNew()">
          <mat-icon>add</mat-icon> New Task
        </button>
      </div>

      @if (loading()) {
        <div class="text-center p-32"><mat-spinner diameter="32"></mat-spinner></div>
      } @else {
        <div class="kanban-board d-flex gap-16">
          @for (col of columns; track col.status) {
            <div class="kanban-column flex-grow-1">
              <div class="kanban-column-header p-12 f-w-600">
                {{ col.label }} ({{ col.tasks.length }})
              </div>
              <div class="kanban-column-body p-8"
                   cdkDropList
                   [id]="col.status"
                   [cdkDropListData]="col.tasks"
                   [cdkDropListConnectedTo]="connectedListIds"
                   (cdkDropListDropped)="onDrop($event)">
                @for (t of col.tasks; track t.id) {
                  <mat-card class="kanban-card m-b-8" cdkDrag (click)="openTask(t)">
                    <mat-card-content>
                      <div class="d-flex align-items-center gap-8">
                        <span class="priority-dot priority-{{ t.priority.toLowerCase() }}"></span>
                        <span class="f-w-500">{{ t.title }}</span>
                      </div>
                      @if (t.taskTypeName) {
                        <span class="chip m-t-4" [style.background]="t.taskTypeColor">{{ t.taskTypeName }}</span>
                      }
                      @if (t.dueDate) {
                        <small class="text-muted d-block m-t-4">
                          Due: {{ t.dueDate | date:'shortDate' }}
                          @if (t.isOverdue) { <span class="text-danger">(overdue)</span> }
                        </small>
                      }
                    </mat-card-content>
                  </mat-card>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .kanban-column { background: #f3f4f6; border-radius: 8px; min-width: 280px; }
    .kanban-column-header { background: #e5e7eb; border-radius: 8px 8px 0 0; }
    .kanban-column-body { min-height: 400px; }
    .kanban-card { cursor: pointer; }
    .chip { padding: 2px 8px; border-radius: 12px; color: #fff; font-size: 11px; }
    .priority-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .priority-low { background: #6b7280; }
    .priority-medium { background: #3b82f6; }
    .priority-high { background: #f59e0b; }
    .priority-urgent { background: #ef4444; }
    .text-danger { color: #ef4444; }
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
      next: () => { /* optimistic move already applied */ },
      error: () => {
        // rollback on failure
        transferArrayItem(event.container.data, event.previousContainer.data,
                          event.currentIndex, event.previousIndex);
      },
    });
  }

  openTask(t: TaskDto): void { this.router.navigate(['/apps/task', t.id]); }
  goToNew(): void { this.router.navigate(['/apps/task/new']); }
}
