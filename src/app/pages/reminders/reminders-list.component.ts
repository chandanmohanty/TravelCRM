import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ReminderDto, RemindersService } from '../../core/services/reminders.service';

@Component({
  selector: 'app-reminders-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, DatePipe, RouterLink,
    MatCardModule, MatButtonModule, MatIconModule,
    MatTableModule, MatChipsModule, MatMenuModule,
    MatSnackBarModule, MatProgressSpinnerModule, MatTooltipModule,
  ],
  template: `
    <div class="page-header m-b-24 d-flex align-items-center justify-content-between">
      <div>
        <h2 class="f-s-24 f-w-700 m-0">Reminders</h2>
        <p class="text-muted m-0 m-t-4">Scheduled and event-triggered notification rules.</p>
      </div>
      <a mat-flat-button color="primary" routerLink="/reminders/new">
        <mat-icon>add</mat-icon> New Reminder
      </a>
    </div>

    <mat-card class="cardWithShadow">
      <mat-card-content class="p-0">
        @if (loading()) {
          <div class="p-24 text-center"><mat-spinner diameter="32" class="m-auto"></mat-spinner></div>
        } @else if (reminders().length === 0) {
          <div class="p-24 text-center">
            <mat-icon class="f-s-48 text-muted">notifications_none</mat-icon>
            <p class="m-t-16">No reminders configured yet.</p>
            <a mat-flat-button color="primary" routerLink="/reminders/new">Create your first reminder</a>
          </div>
        } @else {
          <table mat-table [dataSource]="reminders()" class="w-100">
            <ng-container matColumnDef="title">
              <th mat-header-cell *matHeaderCellDef>Reminder</th>
              <td mat-cell *matCellDef="let r">
                <div class="d-flex align-items-center gap-8">
                  <span class="f-w-600">{{ r.title }}</span>
                  <mat-chip [class]="r.status === 'Active' ? 'state-active' : 'state-paused'">
                    {{ r.status }}
                  </mat-chip>
                </div>
                <div class="text-muted f-s-12">
                  {{ r.triggerType === 'TimeBased' ? (r.cronExpression ?? r.scheduledAt ?? '—') : ('Event: ' + r.eventName) }}
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="channel">
              <th mat-header-cell *matHeaderCellDef>Channel</th>
              <td mat-cell *matCellDef="let r">
                <mat-chip class="chip-channel">{{ r.channel }}</mat-chip>
              </td>
            </ng-container>

            <ng-container matColumnDef="recipient">
              <th mat-header-cell *matHeaderCellDef>Recipient</th>
              <td mat-cell *matCellDef="let r">
                <span class="f-s-13">
                  {{ r.recipientName || r.recipientEmail || r.recipientPhone || '—' }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="updated">
              <th mat-header-cell *matHeaderCellDef>Updated</th>
              <td mat-cell *matCellDef="let r">
                {{ (r.updatedAt || r.createdAt) | date: 'mediumDate' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="text-end">Actions</th>
              <td mat-cell *matCellDef="let r" class="text-end">
                <button mat-icon-button [matMenuTriggerFor]="menu">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #menu="matMenu">
                  <a mat-menu-item [routerLink]="['/reminders', r.id]">
                    <mat-icon>edit</mat-icon><span>Edit</span>
                  </a>
                  <button mat-menu-item (click)="remove(r)" class="text-error">
                    <mat-icon>delete</mat-icon><span>Delete</span>
                  </button>
                </mat-menu>
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
    .mat-mdc-chip.state-active  { background: #d4edda; color: #155724; }
    .mat-mdc-chip.state-paused  { background: #fff3cd; color: #856404; }
    .mat-mdc-chip.chip-channel  { background: #e3f2fd; color: #1565c0; }
    .text-error { color: #d32f2f; }
  `],
})
export class RemindersListComponent implements OnInit {
  private readonly api   = inject(RemindersService);
  private readonly snack = inject(MatSnackBar);

  readonly loading   = signal(false);
  readonly reminders = signal<ReminderDto[]>([]);

  readonly columns = ['title', 'channel', 'recipient', 'updated', 'actions'] as const;

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: list => { this.reminders.set(list); this.loading.set(false); },
      error: err => {
        this.loading.set(false);
        this.snack.open(err?.error?.error ?? 'Failed to load reminders.', 'Close', { duration: 3500 });
      },
    });
  }

  remove(r: ReminderDto): void {
    if (!confirm(`Delete reminder "${r.title}"? This cannot be undone.`)) return;
    this.api.delete(r.id).subscribe({
      next: () => { this.snack.open('Deleted.', 'Close', { duration: 2000 }); this.load(); },
      error: err => this.snack.open(err?.error?.error ?? 'Delete failed.', 'Close', { duration: 3500 }),
    });
  }
}
