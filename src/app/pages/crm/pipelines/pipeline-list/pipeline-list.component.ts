import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { PipelinesService } from 'src/app/core/services/pipelines.service';
import { PipelineDto } from 'src/app/core/models/crm.models';

@Component({
  selector: 'app-pipeline-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterLink,
    MatButtonModule, MatCardModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatTableModule, MatTooltipModule,
    TablerIconsModule,
  ],
  template: `
    <div class="pl-page">
      <div class="pl-header">
        <div>
          <h2 class="pl-title">Pipelines</h2>
          <p class="pl-sub">Configure the stages each pipeline follows.</p>
        </div>
        <button mat-flat-button color="primary" (click)="newPipeline()">
          <i-tabler name="plus" class="icon-sm mr-1"></i-tabler> New pipeline
        </button>
      </div>

      @if (loading()) {
        <div class="loading-wrap"><mat-spinner diameter="32"></mat-spinner></div>
      } @else {
        <mat-card>
          <mat-card-content class="p-0">
            <table mat-table [dataSource]="pipelines()" class="pl-table">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Pipeline</th>
                <td mat-cell *matCellDef="let p">
                  <a [routerLink]="['/crm/pipelines', p.id]" class="pl-link">{{ p.name }}</a>
                  @if (p.isDefault) { <span class="pl-pill pl-pill-default">Default</span> }
                  @if (!p.isActive) { <span class="pl-pill pl-pill-inactive">Inactive</span> }
                </td>
              </ng-container>
              <ng-container matColumnDef="stages">
                <th mat-header-cell *matHeaderCellDef>Stages</th>
                <td mat-cell *matCellDef="let p">{{ p.stages?.length ?? 0 }}</td>
              </ng-container>
              <ng-container matColumnDef="deals">
                <th mat-header-cell *matHeaderCellDef>Deals</th>
                <td mat-cell *matCellDef="let p">{{ p.dealCount }}</td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let p" class="actions-cell">
                  <a mat-stroked-button [routerLink]="['/crm/pipelines', p.id]">
                    <i-tabler name="pencil" class="icon-xs mr-1"></i-tabler> Edit
                  </a>
                  <button mat-stroked-button color="warn"
                          [disabled]="p.dealCount > 0 || p.isDefault"
                          [matTooltip]="p.dealCount > 0 ? 'Move deals first' : (p.isDefault ? 'Cannot delete default' : '')"
                          (click)="deletePipeline(p)">
                    <i-tabler name="trash" class="icon-xs"></i-tabler>
                  </button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="cols"></tr>
              <tr mat-row *matRowDef="let row; columns: cols" class="pl-row"></tr>
            </table>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    :host {
      --pl-bg: #fff;
      --pl-border: #f1f5f9;
      --pl-text-hi: #0f172a;
      --pl-text-muted: #64748b;
      --pl-row-hover: #f8fafc;
    }
    :host-context(.dark-theme) {
      --pl-bg: #1a2537;
      --pl-border: #2e3f50;
      --pl-text-hi: rgba(255,255,255,.9);
      --pl-text-muted: rgba(255,255,255,.5);
      --pl-row-hover: rgba(255,255,255,.04);
    }

    .pl-page { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
    .pl-header { display: flex; justify-content: space-between; align-items: center; }
    .pl-title { margin: 0; font-size: 20px; font-weight: 700; color: var(--pl-text-hi); }
    .pl-sub   { margin: 2px 0 0; font-size: 13px; color: var(--pl-text-muted); }
    .loading-wrap { display: flex; justify-content: center; padding: 40px; }

    .pl-table { width: 100%; }
    .pl-table .mat-mdc-header-cell {
      padding: 12px 16px; font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: .5px;
      color: var(--pl-text-muted); background: #fafafa;
    }
    :host-context(.dark-theme) .pl-table .mat-mdc-header-cell { background: #1f2a3d; }
    :host-context(.dark-theme) .pl-pill-default  { background: rgba(29,78,216,.2); color: #93c5fd; }
    :host-context(.dark-theme) .pl-pill-inactive { background: rgba(255,255,255,.06); color: #94a3b8; }
    .pl-table .mat-mdc-cell { padding: 12px 16px; }
    .pl-row:hover .mat-mdc-cell { background: var(--pl-row-hover); }

    .pl-link { font-weight: 600; color: var(--pl-text-hi); text-decoration: none; }
    .pl-link:hover { text-decoration: underline; }

    .pl-pill {
      display: inline-block; padding: 2px 8px; border-radius: 12px;
      font-size: 11px; font-weight: 600; margin-left: 8px;
    }
    .pl-pill-default  { background: #dbeafe; color: #1d4ed8; }
    .pl-pill-inactive { background: #f1f5f9; color: #64748b; }

    .actions-cell { display: flex; gap: 8px; justify-content: flex-end; padding: 8px 16px; }
    .icon-xs { width: 14px; height: 14px; }
    .icon-sm { width: 16px; height: 16px; }
    .mr-1 { margin-right: 4px; }
  `],
})
export class PipelineListComponent implements OnInit {
  private readonly api    = inject(PipelinesService);
  private readonly router = inject(Router);
  private readonly snack  = inject(MatSnackBar);

  readonly cols      = ['name', 'stages', 'deals', 'actions'];
  readonly pipelines = signal<PipelineDto[]>([]);
  readonly loading   = signal(true);

  ngOnInit(): void { this.refresh(); }

  refresh(): void {
    this.loading.set(true);
    this.api.list(true).subscribe({
      next: ps => { this.pipelines.set(ps); this.loading.set(false); },
      error: () => {
        this.loading.set(false);
        this.snack.open('Failed to load pipelines.', 'Close', { duration: 3500 });
      },
    });
  }

  newPipeline(): void {
    this.api.create({ name: 'New Pipeline', isDefault: false }).subscribe({
      next: p => this.router.navigate(['/crm/pipelines', p.id]),
      error: err => this.snack.open(err?.error?.error ?? 'Create failed.', 'Close', { duration: 3500 }),
    });
  }

  deletePipeline(p: PipelineDto): void {
    if (!confirm(`Delete pipeline "${p.name}"?`)) return;
    this.api.delete(p.id).subscribe({
      next: () => this.refresh(),
      error: err => this.snack.open(err?.error?.error ?? 'Delete failed.', 'Close', { duration: 3500 }),
    });
  }
}
