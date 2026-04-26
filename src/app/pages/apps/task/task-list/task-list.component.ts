import { ChangeDetectionStrategy, Component, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TasksService } from 'src/app/core/services/tasks.service';
import { TaskTypesService } from 'src/app/core/services/task-types.service';
import { TaskDto, TaskTypeDto } from 'src/app/models/task.model';
import { TaskDetailComponent } from '../task-detail/task-detail.component';

@Component({
  selector: 'app-task-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterModule,
    MatButtonModule, MatCardModule, MatChipsModule, MatExpansionModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule,
    MatSelectModule, MatSidenavModule, MatTooltipModule,
    TaskDetailComponent,
  ],
  template: `
    <mat-sidenav-container class="task-list-container" autosize>
      <mat-sidenav-content>
        <div class="p-24">
          <div class="d-flex justify-content-between align-items-center m-b-16">
            <h2 class="m-0">Tasks</h2>
            <button mat-flat-button color="primary" (click)="goToNew()">
              <mat-icon>add</mat-icon> New Task
            </button>
          </div>

          <mat-card class="m-b-16">
            <mat-card-content>
              <div class="d-flex gap-16 flex-wrap">
                <mat-form-field appearance="outline" class="flex-grow-1">
                  <mat-label>Search</mat-label>
                  <input matInput [(ngModel)]="searchText" (ngModelChange)="reload()" placeholder="Search title…" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Priority</mat-label>
                  <mat-select [(ngModel)]="priorityFilter" (ngModelChange)="reload()">
                    <mat-option [value]="null">All</mat-option>
                    <mat-option value="Low">Low</mat-option>
                    <mat-option value="Medium">Medium</mat-option>
                    <mat-option value="High">High</mat-option>
                    <mat-option value="Urgent">Urgent</mat-option>
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Type</mat-label>
                  <mat-select [(ngModel)]="taskTypeFilter" (ngModelChange)="reload()">
                    <mat-option [value]="null">All</mat-option>
                    @for (t of taskTypes(); track t.id) {
                      <mat-option [value]="t.id">{{ t.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </div>
            </mat-card-content>
          </mat-card>

          @if (loading()) {
            <div class="text-center p-32"><mat-spinner diameter="32"></mat-spinner></div>
          } @else {
            <mat-expansion-panel [expanded]="true" class="m-b-8">
              <mat-expansion-panel-header>
                <mat-panel-title>To Do ({{ todo().length }})</mat-panel-title>
              </mat-expansion-panel-header>
              <div class="d-flex gap-8 p-y-8">
                <input class="form-control flex-grow-1" placeholder="Quick add task… press Enter"
                       [(ngModel)]="quickAddTitle" (keyup.enter)="quickAdd()" />
                <button mat-stroked-button (click)="quickAdd()" [disabled]="!quickAddTitle.trim()">Add</button>
              </div>
              <ng-container *ngTemplateOutlet="rows; context: { tasks: todo() }"></ng-container>
            </mat-expansion-panel>

            <mat-expansion-panel [expanded]="true" class="m-b-8">
              <mat-expansion-panel-header>
                <mat-panel-title>In Progress ({{ inProgress().length }})</mat-panel-title>
              </mat-expansion-panel-header>
              <ng-container *ngTemplateOutlet="rows; context: { tasks: inProgress() }"></ng-container>
            </mat-expansion-panel>

            <mat-expansion-panel class="m-b-8">
              <mat-expansion-panel-header>
                <mat-panel-title>Done ({{ done().length }})</mat-panel-title>
              </mat-expansion-panel-header>
              <ng-container *ngTemplateOutlet="rows; context: { tasks: done() }"></ng-container>
            </mat-expansion-panel>

            <mat-expansion-panel>
              <mat-expansion-panel-header>
                <mat-panel-title>Deleted ({{ deleted().length }})</mat-panel-title>
              </mat-expansion-panel-header>
              <ng-container *ngTemplateOutlet="rows; context: { tasks: deleted() }"></ng-container>
            </mat-expansion-panel>
          }

          <ng-template #rows let-tasks="tasks">
            @if (tasks.length === 0) {
              <div class="text-muted p-y-16 text-center">No tasks</div>
            } @else {
              @for (t of tasks; track t.id) {
                <div class="task-row d-flex align-items-center p-y-8 p-x-8 cursor-pointer"
                     (click)="open(t)">
                  <div class="flex-grow-1">
                    <div class="d-flex align-items-center gap-8">
                      <span class="f-w-500">{{ t.title }}</span>
                      @if (t.taskTypeName) {
                        <span class="chip" [style.background]="t.taskTypeColor">{{ t.taskTypeName }}</span>
                      }
                      @if (t.isOverdue) {
                        <span class="chip chip-danger">Overdue</span>
                      }
                    </div>
                    <small class="text-muted">{{ t.priority }} · Due: {{ t.dueDate ? (t.dueDate | date:'shortDate') : '—' }}</small>
                  </div>
                  <button mat-icon-button (click)="$event.stopPropagation(); editTask(t)" matTooltip="Edit">
                    <mat-icon>edit</mat-icon>
                  </button>
                  @if (!t.isDeleted) {
                    <button mat-icon-button (click)="$event.stopPropagation(); deleteTask(t)" matTooltip="Delete">
                      <mat-icon>delete</mat-icon>
                    </button>
                  } @else {
                    <button mat-icon-button (click)="$event.stopPropagation(); restoreTask(t)" matTooltip="Restore">
                      <mat-icon>restore</mat-icon>
                    </button>
                  }
                </div>
              }
            }
          </ng-template>
        </div>
      </mat-sidenav-content>

      <mat-sidenav #drawer mode="over" position="end" [style.width.px]="480">
        @if (selectedTask()) {
          <app-task-detail [taskId]="selectedTask()!.id" (closed)="drawer.close()" (changed)="reload()"></app-task-detail>
        }
      </mat-sidenav>
    </mat-sidenav-container>
  `,
  styles: [`
    .task-row { border-bottom: 1px solid #eee; }
    .task-row:hover { background: #f7f9fc; }
    .chip { padding: 2px 8px; border-radius: 12px; color: #fff; font-size: 11px; }
    .chip-danger { background: #ef4444; }
    .cursor-pointer { cursor: pointer; }
    .task-list-container { min-height: calc(100vh - 100px); }
  `],
})
export class TaskListComponent implements OnInit {
  @ViewChild('drawer') drawer!: MatSidenav;

  private tasksApi = inject(TasksService);
  private typesApi = inject(TaskTypesService);
  private router = inject(Router);

  loading = signal(true);
  allTasks = signal<TaskDto[]>([]);
  taskTypes = signal<TaskTypeDto[]>([]);
  selectedTask = signal<TaskDto | null>(null);

  searchText = '';
  priorityFilter: string | null = null;
  taskTypeFilter: string | null = null;
  quickAddTitle = '';

  todo = computed(() => this.allTasks().filter(t => t.status === 'ToDo' && !t.isDeleted));
  inProgress = computed(() => this.allTasks().filter(t => t.status === 'InProgress' && !t.isDeleted));
  done = computed(() => this.allTasks().filter(t => t.status === 'Done' && !t.isDeleted));
  deleted = computed(() => this.allTasks().filter(t => t.isDeleted));

  ngOnInit(): void {
    this.typesApi.list().subscribe(t => this.taskTypes.set(t));
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.tasksApi
      .list({
        search: this.searchText || undefined,
        priority: this.priorityFilter || undefined,
        taskTypeId: this.taskTypeFilter || undefined,
        includeDeleted: true,
      })
      .subscribe({
        next: (res) => { this.allTasks.set(res); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
  }

  open(task: TaskDto): void {
    this.selectedTask.set(task);
    this.drawer.open();
  }

  goToNew(): void { this.router.navigate(['/apps/task/new']); }
  editTask(t: TaskDto): void { this.router.navigate(['/apps/task', t.id]); }

  quickAdd(): void {
    const title = this.quickAddTitle.trim();
    if (!title) return;
    this.tasksApi
      .create({ title, status: 'ToDo', priority: 'Medium' })
      .subscribe(() => { this.quickAddTitle = ''; this.reload(); });
  }

  deleteTask(t: TaskDto): void {
    if (!confirm(`Delete task "${t.title}"?`)) return;
    this.tasksApi.delete(t.id).subscribe(() => this.reload());
  }

  restoreTask(t: TaskDto): void {
    this.tasksApi.restore(t.id).subscribe(() => this.reload());
  }
}
