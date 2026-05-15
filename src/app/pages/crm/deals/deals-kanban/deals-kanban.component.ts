import {
  ChangeDetectionStrategy, Component, OnInit,
  computed, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule, transferArrayItem } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { TablerIconsModule } from 'angular-tabler-icons';
import { DealsService } from 'src/app/core/services/deals.service';
import { PipelinesService } from 'src/app/core/services/pipelines.service';
import { SidePanelService } from 'src/app/shared/side-panel';
import { DealDto, KanbanDto, PipelineDto } from 'src/app/core/models/crm.models';
import { DealFormComponent } from '../deal-form/deal-form.component';
import { DealDetailComponent } from '../deal-detail/deal-detail.component';

@Component({
  selector: 'app-deals-kanban',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, DragDropModule,
    MatButtonModule, MatDialogModule, MatFormFieldModule, MatProgressSpinnerModule,
    MatSelectModule, MatSnackBarModule, TablerIconsModule,
  ],
  template: `
    <div class="kb-page">
      <div class="kb-header">
        <div>
          <h2 class="kb-title">Sales Pipeline</h2>
          @if (kanban(); as k) {
            <p class="kb-sub">{{ totalOpenCount() }} open deals · {{ pipelineValueLabel() }}</p>
          }
        </div>
        <div class="kb-controls">
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="kb-pipeline-picker">
            <mat-label>Pipeline</mat-label>
            <mat-select [(ngModel)]="selectedPipelineId" (ngModelChange)="onPipelineChange($event)">
              @for (p of pipelinesList(); track p.id) {
                <mat-option [value]="p.id">{{ p.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <button mat-flat-button color="primary" (click)="addDeal()">
            <i-tabler name="plus" class="icon-sm mr-1"></i-tabler> New deal
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="loading-wrap"><mat-spinner diameter="32"></mat-spinner></div>
      } @else if (kanban(); as k) {
        <div class="kb-columns" cdkDropListGroup>
          @for (col of k.columns; track col.stageId) {
            <div class="kb-col" [style.--col-color]="col.stageColor"
                 cdkDropList
                 [cdkDropListData]="col.deals"
                 [id]="col.stageId"
                 (cdkDropListDropped)="onDrop($event)">
              <div class="kb-col-head">
                <span class="kb-col-name">{{ col.stageName }}</span>
                <span class="kb-col-count">{{ col.totalCount }}</span>
              </div>
              @for (d of col.deals; track d.id) {
                <div class="kb-card" cdkDrag (click)="openDeal(d)">
                  <div class="kb-card-title">{{ d.title }}</div>
                  <div class="kb-card-meta">
                    @if (d.value !== null) {
                      <span class="kb-value">{{ d.value | number:'1.0-0' }} {{ d.currency }}</span>
                    }
                    <span class="kb-owner" [title]="d.ownerName ?? ''">{{ ownerInitials(d.ownerName) }}</span>
                  </div>
                  @if (d.expectedCloseDate) {
                    <div class="kb-close-pill">{{ d.expectedCloseDate | date:'d MMM' }}</div>
                  }
                  @if (d.contactName) {
                    <div class="kb-contact">{{ d.contactName }}{{ d.companyName ? ' · ' + d.companyName : '' }}</div>
                  }
                </div>
              }
              @if (col.deals.length === 0) {
                <div class="kb-empty">No deals — drag here</div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .kb-page { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
    .kb-header { display: flex; justify-content: space-between; align-items: flex-end; }
    .kb-title { margin: 0; font-size: 20px; font-weight: 700; }
    .kb-sub   { margin: 2px 0 0; font-size: 13px; color: var(--muted-color, #64748b); }
    .kb-controls { display: flex; gap: 12px; align-items: center; }
    .kb-pipeline-picker { width: 220px; }
    .loading-wrap { display: flex; justify-content: center; padding: 40px; }
    .kb-columns { display: flex; gap: 12px; overflow-x: auto; min-height: 60vh; padding-bottom: 8px; }
    .kb-col {
      flex: 0 0 280px; background: var(--col-bg, #f8fafc); border-radius: 10px; padding: 10px;
      border-top: 3px solid var(--col-color); display: flex; flex-direction: column; gap: 8px;
    }
    .kb-col-head { display: flex; justify-content: space-between; align-items: center; padding: 4px 4px 6px; }
    .kb-col-name { font-size: 13px; font-weight: 700; color: var(--heading-color, #0f172a); }
    .kb-col-count {
      display: inline-block; min-width: 24px; text-align: center;
      background: var(--card-bg, #fff); border-radius: 12px; padding: 2px 8px; font-size: 11px;
      color: var(--muted-color, #64748b); border: 1px solid var(--border-color, #e2e8f0);
    }
    .kb-card {
      background: var(--card-bg, #fff); border: 1px solid var(--border-color, #e2e8f0);
      border-radius: 8px; padding: 10px 12px; cursor: pointer; transition: box-shadow 120ms;
    }
    .kb-card:hover { box-shadow: 0 4px 8px rgba(15,23,42,.08); }
    .kb-card-title { font-size: 13px; font-weight: 600; color: var(--heading-color, #0f172a); margin-bottom: 4px; }
    .kb-card-meta { display: flex; justify-content: space-between; align-items: center; }
    .kb-value { font-size: 13px; font-weight: 700; color: var(--heading-color, #0f172a); }
    .kb-owner {
      width: 22px; height: 22px; border-radius: 50%; background: #6366f1; color: #fff;
      font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .kb-close-pill {
      display: inline-block; font-size: 10.5px; font-weight: 600; padding: 2px 7px;
      border-radius: 10px; background: #fef3c7; color: #92400e; margin-top: 4px;
    }
    .kb-contact { font-size: 11.5px; color: var(--muted-color, #64748b); margin-top: 4px; }
    .kb-empty {
      padding: 16px; text-align: center; font-size: 12px; color: var(--muted-color, #94a3b8);
      border: 2px dashed var(--border-color, #e2e8f0); border-radius: 8px;
    }
    .cdk-drag-placeholder { opacity: 0.4; }
    .cdk-drag-preview { box-shadow: 0 8px 24px rgba(15,23,42,.15); border-radius: 8px; }
    .icon-sm { width: 16px; height: 16px; }
    .mr-1 { margin-right: 4px; }

    /* Dark-mode overrides */
    :host-context(.dark) .kb-col { background: var(--col-bg, #1e293b); }
    :host-context(.dark) .kb-card { background: var(--card-bg, #0f172a); border-color: #334155; }
    :host-context(.dark) .kb-col-count { background: #1e293b; border-color: #334155; }
  `],
})
export class DealsKanbanComponent implements OnInit {
  private readonly dealsService     = inject(DealsService);
  private readonly pipelinesService = inject(PipelinesService);
  private readonly sidePanel        = inject(SidePanelService);
  private readonly snack            = inject(MatSnackBar);

  readonly loading      = signal(true);
  readonly kanban       = signal<KanbanDto | null>(null);
  readonly pipelinesList = signal<PipelineDto[]>([]);
  selectedPipelineId: string | null = null;

  readonly totalOpenCount = computed(() => {
    const k = this.kanban();
    if (!k) return 0;
    return k.columns
      .filter(c => c.stageKind === 'Open')
      .reduce((s, c) => s + c.totalCount, 0);
  });

  readonly pipelineValueLabel = computed(() => {
    const k = this.kanban();
    if (!k) return '';
    const sums: Record<string, number> = {};
    for (const c of k.columns) {
      if (c.stageKind !== 'Open') continue;
      for (const [cur, sum] of Object.entries(c.totalValueByCurrency)) {
        sums[cur] = (sums[cur] ?? 0) + sum;
      }
    }
    return Object.entries(sums)
      .map(([cur, s]) => `${s.toLocaleString()} ${cur}`)
      .join(' · ') || '—';
  });

  ngOnInit(): void {
    this.pipelinesService.list().subscribe(ps => {
      this.pipelinesList.set(ps);
      const def = this.pipelinesService.defaultPipeline();
      this.selectedPipelineId = def?.id ?? ps[0]?.id ?? null;
      this.loadKanban();
    });
  }

  loadKanban(): void {
    if (!this.selectedPipelineId) { this.loading.set(false); return; }
    this.loading.set(true);
    this.dealsService.getKanban(this.selectedPipelineId).subscribe({
      next: k  => { this.kanban.set(k); this.loading.set(false); },
      error: () => {
        this.loading.set(false);
        this.snack.open('Failed to load kanban.', 'Close', { duration: 3500 });
      },
    });
  }

  onPipelineChange(pid: string): void {
    this.selectedPipelineId = pid;
    this.loadKanban();
  }

  onDrop(e: CdkDragDrop<DealDto[]>): void {
    // Same-column reorder → no-op (Phase 1 doesn't persist intra-column order)
    if (e.previousContainer === e.container) return;

    const card       = e.previousContainer.data[e.previousIndex];
    const toStageId  = e.container.id;

    // Optimistic move — update both arrays in-place so CDK reflects it immediately
    transferArrayItem(
      e.previousContainer.data,
      e.container.data,
      e.previousIndex,
      e.currentIndex,
    );
    // Nudge signal to trigger change detection in OnPush
    this.kanban.update(k => k ? { ...k } : k);

    const toColumn = this.kanban()!.columns.find(c => c.stageId === toStageId)!;

    if (toColumn.stageKind !== 'Open') {
      // Won / Lost — ask for confirmation + optional close note
      const note = prompt(
        `Close deal "${card.title}" as ${toColumn.stageName}? Enter an optional close note (Cancel to abort):`,
      );
      if (note === null) {
        // User cancelled — revert the optimistic move
        transferArrayItem(
          e.container.data,
          e.previousContainer.data,
          e.currentIndex,
          e.previousIndex,
        );
        this.kanban.update(k => k ? { ...k } : k);
        return;
      }
      this.commitMove(card, toStageId, note.trim() || undefined);
      return;
    }

    this.commitMove(card, toStageId);
  }

  private commitMove(card: DealDto, toStageId: string, note?: string): void {
    this.dealsService
      .move(card.id, { rowVersion: card.rowVersion, stageId: toStageId, note })
      .subscribe({
        next:  () => this.loadKanban(),
        error: err => {
          if (err?.error?.error === 'concurrency_conflict') {
            this.snack.open(
              'This deal was just updated by someone else — refreshing.',
              'Close',
              { duration: 3500 },
            );
          } else {
            this.snack.open(
              err?.error?.message ?? err?.error?.error ?? 'Move failed.',
              'Close',
              { duration: 3500 },
            );
          }
          this.loadKanban();
        },
      });
  }

  ownerInitials(name: string | null | undefined): string {
    if (!name) return '?';
    const parts = name.split(' ').filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
  }

  addDeal(): void {
    const ref = this.sidePanel.open(DealFormComponent, {
      title: 'New Deal',
      subtitle: 'Add a deal to the pipeline',
      width: '560px',
      data: { pipelineId: this.selectedPipelineId },
    });
    ref.afterClosed().subscribe(r => { if (r === 'saved') this.loadKanban(); });
  }

  openDeal(d: DealDto): void {
    const ref = this.sidePanel.open(DealDetailComponent, {
      title: d.title,
      subtitle: `${d.pipelineName} · ${d.stageName}`,
      width: '560px',
      data: { dealId: d.id },
    });
    ref.afterClosed().subscribe(() => this.loadKanban());
  }
}
