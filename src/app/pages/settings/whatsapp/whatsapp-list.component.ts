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
import { WhatsAppConfigDto, WhatsAppSettingsService } from '../../../core/services/whatsapp-settings.service';

@Component({
  selector: 'app-whatsapp-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, DatePipe, RouterLink,
    MatCardModule, MatButtonModule, MatIconModule,
    MatTableModule, MatChipsModule, MatMenuModule,
    MatSnackBarModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="page-header m-b-24 d-flex align-items-center justify-content-between">
      <div>
        <h2 class="f-s-24 f-w-700 m-0">WhatsApp Configurations</h2>
        <p class="text-muted m-0 m-t-4">Connect Gupshup or WATI for WhatsApp messaging.</p>
      </div>
      <a mat-flat-button color="primary" routerLink="/settings/whatsapp/new">
        <mat-icon>add</mat-icon> New WhatsApp Provider
      </a>
    </div>

    <mat-card class="cardWithShadow">
      <mat-card-content class="p-0">
        @if (loading()) {
          <div class="p-24 text-center"><mat-spinner diameter="32" class="m-auto"></mat-spinner></div>
        } @else if (configs().length === 0) {
          <div class="p-24 text-center">
            <mat-icon class="f-s-48 text-muted">chat</mat-icon>
            <p class="m-t-16">No WhatsApp provider is configured yet.</p>
            <a mat-flat-button color="primary" routerLink="/settings/whatsapp/new">Add your first one</a>
          </div>
        } @else {
          <table mat-table [dataSource]="configs()" class="w-100">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Name</th>
              <td mat-cell *matCellDef="let c">
                <div class="d-flex align-items-center gap-8">
                  <span class="f-w-600">{{ c.name }}</span>
                  @if (c.isActive) {
                    <mat-chip class="state-active">Active</mat-chip>
                  }
                </div>
                <div class="text-muted f-s-12">{{ c.provider }} · {{ c.phoneNumber }}</div>
              </td>
            </ng-container>

            <ng-container matColumnDef="key">
              <th mat-header-cell *matHeaderCellDef>API Key</th>
              <td mat-cell *matCellDef="let c">
                @if (c.hasApiKey) {
                  <mat-chip class="state-active">Set</mat-chip>
                } @else {
                  <mat-chip class="state-missing">Missing</mat-chip>
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="updated">
              <th mat-header-cell *matHeaderCellDef>Updated</th>
              <td mat-cell *matCellDef="let c">
                {{ (c.updatedAt || c.createdAt) | date: 'medium' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="text-end">Actions</th>
              <td mat-cell *matCellDef="let c" class="text-end">
                <button mat-icon-button [matMenuTriggerFor]="menu">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #menu="matMenu">
                  <a mat-menu-item [routerLink]="['/settings/whatsapp', c.id]">
                    <mat-icon>edit</mat-icon><span>Edit</span>
                  </a>
                  <button mat-menu-item (click)="test(c)" [disabled]="testing() === c.id">
                    <mat-icon>bolt</mat-icon>
                    <span>{{ testing() === c.id ? 'Testing…' : 'Test connection' }}</span>
                  </button>
                  @if (!c.isActive) {
                    <button mat-menu-item (click)="activate(c)">
                      <mat-icon>check_circle</mat-icon><span>Set active</span>
                    </button>
                  }
                  <button mat-menu-item (click)="remove(c)" class="text-error">
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
    .mat-mdc-chip.state-missing { background: #f8d7da; color: #721c24; }
    .text-error { color: #d32f2f; }
  `],
})
export class WhatsAppListComponent implements OnInit {
  private readonly api   = inject(WhatsAppSettingsService);
  private readonly snack = inject(MatSnackBar);

  readonly loading = signal(false);
  readonly testing = signal<string | null>(null);
  readonly configs = signal<WhatsAppConfigDto[]>([]);

  readonly columns = ['name', 'key', 'updated', 'actions'] as const;

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: list => { this.configs.set(list); this.loading.set(false); },
      error: err => {
        this.loading.set(false);
        this.snack.open(err?.error?.error ?? 'Failed to load WhatsApp configs.', 'Close', { duration: 3500 });
      },
    });
  }

  activate(c: WhatsAppConfigDto): void {
    this.api.activate(c.id).subscribe({
      next: () => { this.snack.open('Config activated.', 'Close', { duration: 2500 }); this.load(); },
      error: err => this.snack.open(err?.error?.error ?? 'Activate failed.', 'Close', { duration: 3500 }),
    });
  }

  test(c: WhatsAppConfigDto): void {
    this.testing.set(c.id);
    this.api.test(c.id).subscribe({
      next: r => {
        this.testing.set(null);
        this.snack.open(
          r.success ? 'Connection successful!' : `Failed: ${r.error}`,
          'Close', { duration: 4000 });
      },
      error: err => {
        this.testing.set(null);
        this.snack.open(err?.error?.error ?? 'Test failed.', 'Close', { duration: 3500 });
      },
    });
  }

  remove(c: WhatsAppConfigDto): void {
    if (!confirm(`Delete WhatsApp config "${c.name}"? This cannot be undone.`)) return;
    this.api.delete(c.id).subscribe({
      next: () => { this.snack.open('Deleted.', 'Close', { duration: 2000 }); this.load(); },
      error: err => this.snack.open(err?.error?.error ?? 'Delete failed.', 'Close', { duration: 3500 }),
    });
  }
}
