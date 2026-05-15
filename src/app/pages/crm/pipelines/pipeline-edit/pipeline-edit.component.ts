import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TablerIconsModule } from 'angular-tabler-icons';
import { PipelinesService } from 'src/app/core/services/pipelines.service';
import { PipelineDto, PipelineStageDto, PipelineStageKind } from 'src/app/core/models/crm.models';

@Component({
  selector: 'app-pipeline-edit',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterLink, FormsModule, ReactiveFormsModule, DragDropModule,
    MatButtonModule, MatCardModule, MatFormFieldModule,
    MatInputModule, MatProgressSpinnerModule, MatSelectModule, MatSlideToggleModule,
    MatSnackBarModule, MatTooltipModule, TablerIconsModule,
  ],
  template: `
    <div class="pe-page">
      <a routerLink="/crm/pipelines" class="pe-back">
        <i-tabler name="arrow-left" class="icon-xs"></i-tabler> Back to pipelines
      </a>

      @if (loading()) {
        <div class="loading-wrap"><mat-spinner diameter="32"></mat-spinner></div>
      } @else if (pipeline(); as p) {
        <mat-card>
          <mat-card-content>
            <form [formGroup]="form" class="pe-form">
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="flex-2">
                <mat-label>Pipeline name *</mat-label>
                <input matInput formControlName="name" maxlength="100">
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="flex-3">
                <mat-label>Description</mat-label>
                <input matInput formControlName="description" maxlength="500">
              </mat-form-field>
              <mat-slide-toggle formControlName="isDefault">Default</mat-slide-toggle>
              <mat-slide-toggle formControlName="isActive">Active</mat-slide-toggle>
            </form>

            <h3 class="pe-stages-title">Stages</h3>
            <p class="pe-help">Drag rows to reorder.</p>

            <div cdkDropList (cdkDropListDropped)="onDrop($event)" class="pe-stages">
              @for (s of stages(); track s.id) {
                <div cdkDrag class="pe-stage">
                  <i-tabler name="grip-vertical" class="pe-drag" cdkDragHandle aria-label="Drag to reorder stage"></i-tabler>
                  <input class="pe-stage-name" [(ngModel)]="s.name" maxlength="100"
                         [ngModelOptions]="{ standalone: true }">
                  <input type="color" [(ngModel)]="s.colorHex" class="pe-color" aria-label="Stage color"
                         [ngModelOptions]="{ standalone: true }">
                  <input type="number" class="pe-prob" min="0" max="100"
                         [(ngModel)]="s.defaultProbability"
                         [ngModelOptions]="{ standalone: true }">
                  <span class="pe-pct">%</span>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="pe-kind">
                    <mat-select [(ngModel)]="s.kind" [ngModelOptions]="{ standalone: true }">
                      <mat-option value="Open">Open</mat-option>
                      <mat-option value="Won">Won</mat-option>
                      <mat-option value="Lost">Lost</mat-option>
                    </mat-select>
                  </mat-form-field>
                  <mat-slide-toggle [(ngModel)]="s.isActive"
                                    [ngModelOptions]="{ standalone: true }">Active</mat-slide-toggle>
                  <button mat-icon-button color="warn"
                          [disabled]="s.dealCount > 0"
                          [matTooltip]="s.dealCount > 0 ? 'Move deals first' : 'Delete stage'"
                          (click)="deleteStage(s)">
                    <i-tabler name="trash" class="icon-xs"></i-tabler>
                  </button>
                </div>
              }
            </div>

            <button mat-stroked-button (click)="addStage()" class="pe-add">
              <i-tabler name="plus" class="icon-xs mr-1"></i-tabler> Add stage
            </button>

            <div class="pe-actions">
              <a mat-stroked-button routerLink="/crm/pipelines">Cancel</a>
              <button mat-flat-button color="primary" (click)="saveAll()" [disabled]="saving()">
                {{ saving() ? 'Saving…' : 'Save all changes' }}
              </button>
            </div>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    :host {
      --pe-bg: #fff;
      --pe-border: #e2e8f0;
      --pe-text-hi: #0f172a;
      --pe-text-muted: #64748b;
      --pe-stage-bg: #fafafa;
      --pe-input-border: #e2e8f0;
    }
    :host-context(.dark-theme) {
      --pe-bg: #1a2537;
      --pe-border: #2e3f50;
      --pe-text-hi: rgba(255,255,255,.9);
      --pe-text-muted: rgba(255,255,255,.5);
      --pe-stage-bg: #1e2d42;
      --pe-input-border: #2e3f50;
    }

    .pe-page { padding: 20px; max-width: 1100px; display: flex; flex-direction: column; gap: 16px; }

    .pe-back {
      font-size: 13px; color: var(--pe-text-muted); text-decoration: none;
      display: inline-flex; align-items: center; gap: 6px;
    }
    .pe-back:hover { color: var(--pe-text-hi); }

    .loading-wrap { display: flex; justify-content: center; padding: 40px; }

    .pe-form {
      display: flex; gap: 16px; align-items: center;
      flex-wrap: wrap; margin-bottom: 24px;
    }
    .flex-2 { flex: 2 1 220px; }
    .flex-3 { flex: 3 1 320px; }

    .pe-stages-title { margin: 0; font-size: 16px; font-weight: 700; color: var(--pe-text-hi); }
    .pe-help { margin: 4px 0 12px; font-size: 12px; color: #94a3b8; }

    .pe-stages { display: flex; flex-direction: column; gap: 6px; }

    .pe-stage {
      display: flex; align-items: center; gap: 12px;
      padding: 8px 12px;
      background: var(--pe-stage-bg);
      border: 1px solid var(--pe-border);
      border-radius: 8px;
    }
    .pe-stage.cdk-drag-preview {
      box-shadow: 0 4px 24px rgba(0,0,0,.18);
      border-radius: 8px;
    }
    .pe-stage.cdk-drag-placeholder { opacity: .4; }

    .pe-drag { cursor: grab; color: #94a3b8; width: 16px; height: 16px; flex-shrink: 0; }

    .pe-stage-name {
      flex: 1; border: 1px solid var(--pe-input-border);
      padding: 6px 10px; border-radius: 6px;
      background: transparent; color: var(--pe-text-hi); font-size: 14px;
    }
    .pe-color {
      width: 36px; height: 28px; border: 1px solid var(--pe-input-border);
      border-radius: 6px; padding: 0; cursor: pointer; flex-shrink: 0;
    }
    .pe-prob {
      width: 64px; padding: 6px 8px;
      border: 1px solid var(--pe-input-border); border-radius: 6px;
      background: transparent; color: var(--pe-text-hi); font-size: 14px;
      flex-shrink: 0;
    }
    .pe-pct { font-size: 13px; color: var(--pe-text-muted); flex-shrink: 0; }
    .pe-kind { width: 120px; flex-shrink: 0; }

    .pe-add { margin-top: 12px; }
    .pe-actions {
      display: flex; justify-content: flex-end; gap: 8px;
      margin-top: 16px; padding-top: 12px;
      border-top: 1px solid var(--pe-border);
    }

    .icon-xs { width: 14px; height: 14px; }
    .mr-1 { margin-right: 4px; }
  `],
})
export class PipelineEditComponent implements OnInit {
  private readonly api    = inject(PipelinesService);
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snack  = inject(MatSnackBar);
  private readonly fb     = inject(FormBuilder);

  readonly pipeline = signal<PipelineDto | null>(null);
  readonly stages   = signal<PipelineStageDto[]>([]);
  readonly loading  = signal(true);
  readonly saving   = signal(false);

  readonly form = this.fb.group({
    name:        ['', [Validators.required, Validators.maxLength(100)]],
    description: [''],
    isDefault:   [false],
    isActive:    [true],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.get(id).subscribe({
      next: p => {
        this.pipeline.set(p);
        this.stages.set([...p.stages].sort((a, b) => a.sortOrder - b.sortOrder));
        this.form.patchValue({
          name:        p.name,
          description: p.description ?? '',
          isDefault:   p.isDefault,
          isActive:    p.isActive,
        });
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snack.open('Failed to load pipeline.', 'Close', { duration: 3500 });
      },
    });
  }

  onDrop(e: CdkDragDrop<PipelineStageDto[]>): void {
    const next = [...this.stages()];
    moveItemInArray(next, e.previousIndex, e.currentIndex);
    this.stages.set(next);
  }

  addStage(): void {
    const id = this.pipeline()!.id;
    this.api.addStage(id, {
      name: 'New Stage', probability: 50, kind: 'Open' as PipelineStageKind, colorHex: '#94a3b8',
    }).subscribe({
      next: created => this.stages.update(curr => [...curr, created]),
      error: err => this.snack.open(err?.error?.error ?? 'Add failed.', 'Close', { duration: 3500 }),
    });
  }

  deleteStage(s: PipelineStageDto): void {
    if (!confirm(`Delete stage "${s.name}"?`)) return;
    const id = this.pipeline()!.id;
    this.api.deleteStage(id, s.id).subscribe({
      next: () => this.stages.update(curr => curr.filter(x => x.id !== s.id)),
      error: err => this.snack.open(err?.error?.error ?? 'Delete failed.', 'Close', { duration: 3500 }),
    });
  }

  async saveAll(): Promise<void> {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const id = this.pipeline()!.id;
    const v  = this.form.getRawValue();

    try {
      // 1. Save pipeline metadata
      await firstValueFrom(this.api.update(id, {
        name:        v.name!,
        description: v.description ?? null,
        isActive:    v.isActive!,
        isDefault:   v.isDefault!,
      }));

      // 2. Update every stage (in parallel)
      await Promise.all(this.stages().map(s =>
        firstValueFrom(this.api.updateStage(id, s.id, {
          name:        s.name,
          probability: s.defaultProbability,
          kind:        s.kind,
          colorHex:    s.colorHex,
          isActive:    s.isActive,
        }))
      ));

      // 3. Persist the new sort order
      await firstValueFrom(this.api.reorderStages(id, this.stages().map(s => s.id)));

      this.saving.set(false);
      this.snack.open('Pipeline saved.', 'Close', { duration: 2500 });
      this.router.navigate(['/crm/pipelines']);
    } catch (err: any) {
      this.saving.set(false);
      this.snack.open(err?.error?.error ?? 'Save failed.', 'Close', { duration: 3500 });
    }
  }
}
