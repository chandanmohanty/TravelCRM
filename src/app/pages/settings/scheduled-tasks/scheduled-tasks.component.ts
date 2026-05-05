import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ScheduledTask, ScheduledTasksService } from '../../../core/services/scheduled-tasks.service';

@Component({
  selector: 'app-scheduled-tasks',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, DatePipe,
    MatCardModule, MatButtonModule, MatIconModule,
    MatTableModule, MatChipsModule, MatSnackBarModule, MatTooltipModule,
  ],
  template: `
    <div class="page-header m-b-24 d-flex align-items-center justify-content-between">
      <div>
        <h2 class="f-s-24 f-w-700 m-0">Scheduled Tasks</h2>
        <p class="text-muted m-0 m-t-4">Recurring background jobs (Hangfire). Use "Run now" to trigger a job immediately.</p>
      </div>
      <div class="d-flex gap-8">
        <button mat-stroked-button (click)="load()" [disabled]="loading()">
          <mat-icon>refresh</mat-icon> Refresh
        </button>
        <a mat-stroked-button href="/hangfire" target="_blank" rel="noopener"
           matTooltip="Full Hangfire dashboard (platform admins only)">
          <mat-icon>open_in_new</mat-icon> Dashboard
        </a>
      </div>
    </div>

    <mat-card class="cardWithShadow">
      <mat-card-content class="p-0">
        @if (loading()) {
          <div class="p-24 text-center">Loading…</div>
        } @else if (tasks().length === 0) {
          <div class="p-24 text-center">
            <mat-icon class="f-s-48 text-muted">schedule</mat-icon>
            <p class="m-t-16">No recurring jobs are registered.</p>
          </div>
        } @else {
          <table mat-table [dataSource]="tasks()" class="w-100">
            <ng-container matColumnDef="id">
              <th mat-header-cell *matHeaderCellDef>Job ID</th>
              <td mat-cell *matCellDef="let t">
                <div class="f-w-600">{{ t.id }}</div>
                <div class="text-muted f-s-12">{{ t.methodName }}</div>
              </td>
            </ng-container>

            <ng-container matColumnDef="cron">
              <th mat-header-cell *matHeaderCellDef>Cron</th>
              <td mat-cell *matCellDef="let t">
                <code class="f-s-12">{{ t.cron }}</code>
              </td>
            </ng-container>

            <ng-container matColumnDef="last">
              <th mat-header-cell *matHeaderCellDef>Last run</th>
              <td mat-cell *matCellDef="let t">
                @if (t.lastExecution) {
                  <div>{{ t.lastExecution | date: 'medium' }}</div>
                  <mat-chip-set>
                    <mat-chip [class]="stateClass(t.lastJobState)">{{ t.lastJobState || 'Unknown' }}</mat-chip>
                    @if (t.lastDuration) {
                      <mat-chip>⏱ {{ formatDuration(t.lastDuration) }}</mat-chip>
                    }
                  </mat-chip-set>
                } @else {
                  <span class="text-muted">Never</span>
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="next">
              <th mat-header-cell *matHeaderCellDef>Next run</th>
              <td mat-cell *matCellDef="let t">
                {{ t.nextExecution ? (t.nextExecution | date: 'medium') : '—' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="text-end">Actions</th>
              <td mat-cell *matCellDef="let t" class="text-end">
                <button mat-stroked-button color="primary"
                        (click)="run(t)" [disabled]="running() === t.id">
                  <mat-icon>play_arrow</mat-icon>
                  {{ running() === t.id ? 'Triggering…' : 'Run now' }}
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .mat-mdc-chip.state-succeeded { background: #d4edda; color: #155724; }
    .mat-mdc-chip.state-failed, .mat-mdc-chip.state-deleted { background: #f8d7da; color: #721c24; }
    .mat-mdc-chip.state-enqueued, .mat-mdc-chip.state-processing { background: #cce5ff; color: #004085; }
  `],
})
export class ScheduledTasksComponent implements OnInit {
  private readonly api   = inject(ScheduledTasksService);
  private readonly snack = inject(MatSnackBar);

  readonly loading = signal(false);
  readonly running = signal<string | null>(null);
  readonly tasks   = signal<ScheduledTask[]>([]);

  readonly columns = ['id', 'cron', 'last', 'next', 'actions'] as const;

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: list => { this.tasks.set(list); this.loading.set(false); },
      error: err => {
        this.loading.set(false);
        this.snack.open(err?.error?.error ?? 'Failed to load jobs.', 'Close', { duration: 3500 });
      },
    });
  }

  run(t: ScheduledTask): void {
    this.running.set(t.id);
    this.api.run(t.id).subscribe({
      next: r => {
        this.running.set(null);
        this.snack.open(r.message, 'Close', { duration: 2500 });
        setTimeout(() => this.load(), 800);
      },
      error: err => {
        this.running.set(null);
        this.snack.open(err?.error?.error ?? 'Failed to trigger job.', 'Close', { duration: 3500 });
      },
    });
  }

  stateClass(state: string | null): string {
    return 'state-' + (state ?? 'unknown').toLowerCase();
  }

  /** Convert .NET TimeSpan "hh:mm:ss.fff" to a human label. */
  formatDuration(raw: string): string {
    const m = /^(\d+):(\d{2}):(\d{2})(?:\.(\d+))?$/.exec(raw);
    if (!m) return raw;
    const h = +m[1], mi = +m[2], s = +m[3];
    if (h > 0) return `${h}h ${mi}m`;
    if (mi > 0) return `${mi}m ${s}s`;
    return `${s}s`;
  }
}
