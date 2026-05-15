// src/app/pages/crm/deals/deal-detail/deal-detail.component.ts
import {
  Component, ChangeDetectionStrategy, inject, OnInit, signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { DealsService } from '../../../../core/services/deals.service';
import { PipelinesService } from '../../../../core/services/pipelines.service';
import { IdentityApiService } from '../../../../core/services/identity-api.service';
import {
  DealDto, DealActivityDto, PipelineDto, PipelineStageDto,
} from '../../../../core/models/crm.models';
import { UserDto } from '../../../../core/models/identity.model';
import { SidePanelRef, SIDE_PANEL_DATA } from '../../../../shared/side-panel';

@Component({
  selector: 'app-deal-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, DatePipe, ReactiveFormsModule, RouterLink,
    MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatSnackBarModule, MatProgressSpinnerModule, MatDividerModule,
  ],
  template: `
    <div class="dd-wrap" [class.dd-page]="!isPanelMode">

      @if (!isPanelMode) {
        <div class="dd-page-header">
          <a mat-icon-button routerLink="/crm/deals"><mat-icon>arrow_back</mat-icon></a>
          <h2 class="dd-page-title">Deal Detail</h2>
        </div>
      }

      @if (loading()) {
        <div class="dd-loading"><mat-spinner diameter="32"></mat-spinner></div>
      } @else if (deal(); as d) {

        <!-- ── Header ─────────────────────────────── -->
        <div class="dd-header">
          <div class="dd-header-main">
            <h3 class="dd-title">{{ d.title }}</h3>
            <span class="dd-breadcrumb" [style.--stage-color]="d.stageColor">
              {{ d.pipelineName }} · {{ d.stageName }}
            </span>
          </div>
          <span class="dd-status-badge" [class]="'status-' + d.status.toLowerCase()">
            {{ d.status }}
          </span>
        </div>

        <!-- ── Stage quick-change ────────────────── -->
        <div class="dd-stage-row">
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="dd-stage-select">
            <mat-label>Move to Stage</mat-label>
            <mat-select [value]="d.stageId" (selectionChange)="moveStage(d, $event.value)">
              @for (s of stages(); track s.id) {
                <mat-option [value]="s.id">{{ s.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>

        <mat-divider class="dd-divider"></mat-divider>

        <!-- ── Overview ──────────────────────────── -->
        <section class="dd-section">
          <p class="dd-section-label">Overview</p>
          <div class="dd-overview-grid">
            <div class="dd-field">
              <span class="dd-field-label">Contact</span>
              <span class="dd-field-value">{{ d.contactName }}</span>
            </div>
            @if (d.contactEmail) {
              <div class="dd-field">
                <span class="dd-field-label">Email</span>
                <span class="dd-field-value">{{ d.contactEmail }}</span>
              </div>
            }
            @if (d.contactPhone) {
              <div class="dd-field">
                <span class="dd-field-label">Phone</span>
                <span class="dd-field-value">{{ d.contactPhone }}</span>
              </div>
            }
            @if (d.companyName) {
              <div class="dd-field">
                <span class="dd-field-label">Company</span>
                <span class="dd-field-value">{{ d.companyName }}</span>
              </div>
            }
            @if (d.value !== null) {
              <div class="dd-field">
                <span class="dd-field-label">Value</span>
                <span class="dd-field-value dd-value-hi">
                  {{ d.value | number:'1.2-2' }} {{ d.currency }}
                </span>
              </div>
            }
            <div class="dd-field">
              <span class="dd-field-label">Probability</span>
              <span class="dd-field-value">{{ d.probability }}%</span>
            </div>
            @if (d.expectedCloseDate) {
              <div class="dd-field">
                <span class="dd-field-label">Expected Close</span>
                <span class="dd-field-value">{{ d.expectedCloseDate | date:'mediumDate' }}</span>
              </div>
            }
            <div class="dd-field">
              <span class="dd-field-label">Owner</span>
              <span class="dd-field-value">{{ d.ownerName ?? d.ownerUserId }}</span>
            </div>
            @if (d.tags && d.tags.length > 0) {
              <div class="dd-field dd-field-full">
                <span class="dd-field-label">Tags</span>
                <div class="dd-tags">
                  @for (t of d.tags; track t) {
                    <span class="dd-tag">{{ t }}</span>
                  }
                </div>
              </div>
            }
            @if (d.notes) {
              <div class="dd-field dd-field-full">
                <span class="dd-field-label">Notes</span>
                <span class="dd-field-value dd-notes">{{ d.notes }}</span>
              </div>
            }
          </div>
        </section>

        <mat-divider class="dd-divider"></mat-divider>

        <!-- ── Actions row ────────────────────────── -->
        <section class="dd-section dd-actions-section">
          <p class="dd-section-label">Actions</p>

          <!-- Reassign owner -->
          <div class="dd-reassign-row">
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="dd-owner-select">
              <mat-label>Reassign Owner</mat-label>
              <mat-select [formControl]="reassignCtrl">
                @for (u of users(); track u.id) {
                  <mat-option [value]="u.id">{{ u.firstName }} {{ u.lastName }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <button mat-stroked-button class="dd-action-btn"
                    [disabled]="reassigning() || reassignCtrl.value === d.ownerUserId"
                    (click)="reassign(d)">
              {{ reassigning() ? 'Saving…' : 'Reassign' }}
            </button>
          </div>

          <!-- Add note -->
          <div class="dd-note-row">
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="dd-note-field">
              <mat-label>Add Note</mat-label>
              <textarea matInput [formControl]="noteCtrl" rows="2"
                        placeholder="Enter a note…"></textarea>
            </mat-form-field>
            <button mat-stroked-button class="dd-action-btn"
                    [disabled]="addingNote() || !noteCtrl.value?.trim()"
                    (click)="addNote(d)">
              {{ addingNote() ? 'Adding…' : 'Add Note' }}
            </button>
          </div>

          <!-- Delete -->
          <div class="dd-delete-row">
            <button mat-stroked-button color="warn"
                    [disabled]="d.status !== 'Open' || deleting()"
                    (click)="deleteDeal(d)"
                    [title]="d.status !== 'Open' ? 'Only Open deals can be deleted' : 'Delete deal'">
              <mat-icon class="btn-icon">delete</mat-icon>
              {{ deleting() ? 'Deleting…' : 'Delete Deal' }}
            </button>
            @if (d.status !== 'Open') {
              <span class="dd-delete-hint">Closed deals cannot be deleted</span>
            }
          </div>
        </section>

        <mat-divider class="dd-divider"></mat-divider>

        <!-- ── Activity feed ──────────────────────── -->
        <section class="dd-section">
          <p class="dd-section-label">Activity</p>
          @if (activity().length === 0) {
            <p class="dd-empty">No activity recorded yet.</p>
          } @else {
            <ul class="dd-activity-list">
              @for (act of activity(); track act.id) {
                <li class="dd-activity-item">
                  <div class="dd-avatar" [style.background]="avatarColor(act.actorName)">
                    {{ actorInitials(act.actorName) }}
                  </div>
                  <div class="dd-activity-body">
                    <div class="dd-activity-line">
                      <mat-icon class="dd-act-icon">{{ activityIcon(act.kind) }}</mat-icon>
                      <span class="dd-activity-text">{{ activityLabel(act) }}</span>
                    </div>
                    @if (act.note) {
                      <p class="dd-activity-note">"{{ act.note }}"</p>
                    }
                    <span class="dd-activity-time">{{ act.occurredAt | date:'short' }}</span>
                  </div>
                </li>
              }
            </ul>
          }
        </section>

      } @else if (!loading()) {
        <div class="dd-empty-state">
          <p>Deal not found.</p>
          @if (!isPanelMode) {
            <a mat-stroked-button routerLink="/crm/deals">Back to Deals</a>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    /* ── Design tokens ──────────────────────────── */
    :host {
      --dd-bg:       #ffffff;
      --dd-border:   #f1f5f9;
      --dd-shadow:   rgba(15, 23, 42, .07);
      --dd-text-hi:  #0f172a;
      --dd-text-dim: #94a3b8;
      --dd-text-mid: #64748b;
    }
    :host-context(.dark-theme) {
      --dd-bg:       #1a2537;
      --dd-border:   #2e3f50;
      --dd-shadow:   rgba(0, 0, 0, .22);
      --dd-text-hi:  rgba(255, 255, 255, .90);
      --dd-text-dim: rgba(255, 255, 255, .38);
      --dd-text-mid: rgba(255, 255, 255, .55);
    }

    /* ── Outer wrapper ──────────────────────────── */
    .dd-wrap { display: block; }

    .dd-page {
      background: var(--dd-bg);
      border-radius: 12px; padding: 24px;
      box-shadow: 0 2px 16px var(--dd-shadow);
      max-width: 720px;
    }
    .dd-page-header { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; }
    .dd-page-title  { margin: 0; font-size: 20px; font-weight: 700; color: var(--dd-text-hi); }

    /* ── Loading ────────────────────────────────── */
    .dd-loading { display: flex; justify-content: center; padding: 40px; }

    /* ── Header ─────────────────────────────────── */
    .dd-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      gap: 12px; padding: 12px 0 10px;
    }
    .dd-header-main { display: flex; flex-direction: column; gap: 6px; }
    .dd-title { margin: 0; font-size: 18px; font-weight: 700; color: var(--dd-text-hi); }
    .dd-breadcrumb {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 12px; font-weight: 600; color: var(--dd-text-mid);
      background: var(--dd-border); border-radius: 20px;
      padding: 3px 10px; width: fit-content;
    }
    .dd-breadcrumb::before {
      content: ''; display: inline-block;
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--stage-color, #94a3b8);
    }

    /* Status badge */
    .dd-status-badge {
      display: inline-block; font-size: 11px; font-weight: 700;
      letter-spacing: .5px; text-transform: uppercase;
      border-radius: 20px; padding: 4px 12px;
    }
    .status-open { background: #dbeafe; color: #1d4ed8; }
    .status-won  { background: #dcfce7; color: #166534; }
    .status-lost { background: #fee2e2; color: #991b1b; }

    /* ── Stage row ──────────────────────────────── */
    .dd-stage-row { padding: 8px 0; }
    .dd-stage-select { width: 100%; }

    /* ── Divider ────────────────────────────────── */
    .dd-divider { margin: 6px 0 !important; border-color: var(--dd-border) !important; }

    /* ── Section ────────────────────────────────── */
    .dd-section { padding: 12px 0; }
    .dd-section-label {
      margin: 0 0 10px;
      font-size: 10.5px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.8px;
      color: var(--dd-text-dim);
    }

    /* ── Overview grid ──────────────────────────── */
    .dd-overview-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px 16px;
    }
    .dd-field { display: flex; flex-direction: column; gap: 2px; }
    .dd-field-full { grid-column: span 2; }
    .dd-field-label {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .5px; color: var(--dd-text-dim);
    }
    .dd-field-value { font-size: 13.5px; color: var(--dd-text-hi); }
    .dd-value-hi { font-weight: 700; color: #6366f1; }
    .dd-notes { white-space: pre-wrap; line-height: 1.5; }

    /* Tags */
    .dd-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
    .dd-tag {
      background: var(--dd-border); color: var(--dd-text-mid);
      border-radius: 12px; padding: 2px 8px; font-size: 11px; font-weight: 600;
    }

    /* ── Actions section ────────────────────────── */
    .dd-actions-section { display: flex; flex-direction: column; gap: 12px; }
    .dd-reassign-row,
    .dd-note-row { display: flex; align-items: flex-start; gap: 8px; }
    .dd-owner-select,
    .dd-note-field { flex: 1; }
    .dd-action-btn { margin-top: 4px; white-space: nowrap; align-self: flex-end; margin-bottom: 2px; }

    .dd-delete-row { display: flex; align-items: center; gap: 12px; }
    .dd-delete-hint { font-size: 12px; color: var(--dd-text-dim); }

    /* ── Activity ───────────────────────────────── */
    .dd-activity-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
    .dd-activity-item { display: flex; gap: 10px; }
    .dd-avatar {
      flex-shrink: 0; width: 32px; height: 32px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700; color: #fff;
    }
    .dd-activity-body { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .dd-activity-line { display: flex; align-items: center; gap: 4px; }
    .dd-act-icon { font-size: 15px; width: 15px; height: 15px; color: var(--dd-text-dim); }
    .dd-activity-text { font-size: 13px; color: var(--dd-text-hi); }
    .dd-activity-note {
      margin: 2px 0 0; font-size: 12.5px; font-style: italic;
      color: var(--dd-text-mid); line-height: 1.4;
    }
    .dd-activity-time { font-size: 11px; color: var(--dd-text-dim); }

    /* ── Empty states ───────────────────────────── */
    .dd-empty { font-size: 13px; color: var(--dd-text-dim); margin: 0; }
    .dd-empty-state { padding: 40px 0; text-align: center; }

    /* ── Misc ───────────────────────────────────── */
    .btn-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
  `],
})
export class DealDetailComponent implements OnInit {
  private readonly dealsApi     = inject(DealsService);
  private readonly pipelinesApi = inject(PipelinesService);
  private readonly identityApi  = inject(IdentityApiService);
  private readonly snack        = inject(MatSnackBar);
  private readonly route        = inject(ActivatedRoute);
  private readonly router       = inject(Router);
  private readonly fb           = inject(FormBuilder);
  private readonly panelRef     = inject<SidePanelRef<'saved' | 'cancelled'> | null>(
    SidePanelRef, { optional: true });
  private readonly panelData    = inject<{ dealId?: string } | null>(
    SIDE_PANEL_DATA, { optional: true });

  readonly isPanelMode = !!this.panelRef;

  readonly loading     = signal(true);
  readonly deal        = signal<DealDto | null>(null);
  readonly activity    = signal<DealActivityDto[]>([]);
  readonly stages      = signal<PipelineStageDto[]>([]);
  readonly users       = signal<UserDto[]>([]);
  readonly reassigning = signal(false);
  readonly addingNote  = signal(false);
  readonly deleting    = signal(false);

  readonly reassignCtrl = this.fb.control('');
  readonly noteCtrl     = this.fb.control('');

  ngOnInit(): void {
    // Load users for reassign picker
    this.identityApi.listUsers({ pageSize: 200 }).subscribe({
      next: resp => this.users.set(resp.data),
    });

    const dealId = this.panelData?.dealId ?? this.route.snapshot.paramMap.get('id');
    if (dealId) {
      this.loadDeal(dealId);
    } else {
      this.loading.set(false);
    }
  }

  moveStage(deal: DealDto, newStageId: string): void {
    if (newStageId === deal.stageId) return;
    const newStage = this.stages().find(s => s.id === newStageId);
    if (!newStage) return;

    if (newStage.kind !== 'Open') {
      const label = newStage.kind === 'Won' ? 'Won' : 'Lost';
      const confirmed = confirm(
        `Move deal to "${newStage.name}"? This will mark it as ${label}. Are you sure?`
      );
      if (!confirmed) return;
    }

    this.dealsApi.move(deal.id, { rowVersion: deal.rowVersion, stageId: newStageId }).subscribe({
      next: updated => {
        this.deal.set(updated);
        this.activity.set([...(updated.recentActivity ?? [])].reverse());
        this.snack.open('Stage updated.', 'Close', { duration: 2000 });
      },
      error: err => this.handleError(err, deal.id),
    });
  }

  reassign(deal: DealDto): void {
    const newOwner = this.reassignCtrl.value;
    if (!newOwner || newOwner === deal.ownerUserId) return;
    this.reassigning.set(true);
    this.dealsApi.reassign(deal.id, { rowVersion: deal.rowVersion, ownerUserId: newOwner }).subscribe({
      next: updated => {
        this.reassigning.set(false);
        this.deal.set(updated);
        this.activity.set([...(updated.recentActivity ?? [])].reverse());
        this.snack.open('Owner updated.', 'Close', { duration: 2000 });
      },
      error: err => {
        this.reassigning.set(false);
        this.handleError(err, deal.id);
      },
    });
  }

  addNote(deal: DealDto): void {
    const note = this.noteCtrl.value?.trim();
    if (!note) return;
    this.addingNote.set(true);
    this.dealsApi.addNote(deal.id, note).subscribe({
      next: newActivity => {
        this.addingNote.set(false);
        this.noteCtrl.reset();
        // Prepend to activity list (reverse-chrono)
        this.activity.update(acts => [newActivity, ...acts]);
        this.snack.open('Note added.', 'Close', { duration: 2000 });
        // Reload to get fresh rowVersion + ownerName etc.
        this.loadDeal(deal.id);
      },
      error: err => {
        this.addingNote.set(false);
        this.handleError(err, deal.id);
      },
    });
  }

  deleteDeal(deal: DealDto): void {
    if (deal.status !== 'Open') return;
    const confirmed = confirm(`Delete deal "${deal.title}"? This cannot be undone.`);
    if (!confirmed) return;
    this.deleting.set(true);
    this.dealsApi.delete(deal.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.snack.open('Deal deleted.', 'Close', { duration: 2500 });
        if (this.isPanelMode) this.panelRef!.close('saved');
        else this.router.navigate(['/crm/deals']);
      },
      error: err => {
        this.deleting.set(false);
        const msg = (err as { error?: { error?: string } })?.error?.error ?? 'Delete failed.';
        this.snack.open(msg, 'Close', { duration: 3500 });
      },
    });
  }

  actorInitials(name: string | null): string {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  }

  avatarColor(name: string | null): string {
    if (!name) return '#94a3b8';
    const colors = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    const idx = name.charCodeAt(0) % colors.length;
    return colors[idx];
  }

  activityIcon(kind: DealActivityDto['kind']): string {
    const icons: Record<DealActivityDto['kind'], string> = {
      Created:      'add_circle',
      StageChanged: 'swap_horiz',
      OwnerChanged: 'person',
      ValueChanged: 'attach_money',
      Closed:       'check_circle',
      Reopened:     'refresh',
      Note:         'note',
    };
    return icons[kind] ?? 'circle';
  }

  activityLabel(act: DealActivityDto): string {
    const actor = act.actorName ?? 'System';
    switch (act.kind) {
      case 'Created':      return `${actor} created this deal`;
      case 'StageChanged': return `${actor} moved stage: ${act.fromValue} → ${act.toValue}`;
      case 'OwnerChanged': return `${actor} reassigned owner: ${act.fromValue} → ${act.toValue}`;
      case 'ValueChanged': return `${actor} changed value: ${act.fromValue} → ${act.toValue}`;
      case 'Closed':       return `${actor} closed deal as ${act.toValue}`;
      case 'Reopened':     return `${actor} reopened deal`;
      case 'Note':         return `${actor} added a note`;
      default:             return `${actor} updated deal`;
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private loadDeal(dealId: string): void {
    this.loading.set(true);
    this.dealsApi.get(dealId).subscribe({
      next: deal => {
        this.deal.set(deal);
        // Activity is reverse-chrono (newest first)
        this.activity.set([...(deal.recentActivity ?? [])].reverse());
        this.reassignCtrl.setValue(deal.ownerUserId);
        this.loading.set(false);
        // Populate stages for the move picker
        this.loadStagesForPipeline(deal.pipelineId);
      },
      error: err => {
        this.loading.set(false);
        const msg = (err as { error?: { error?: string } })?.error?.error ?? 'Failed to load deal.';
        this.snack.open(msg, 'Close', { duration: 3500 });
        if (this.isPanelMode) this.panelRef!.close();
        else this.router.navigate(['/crm/deals']);
      },
    });
  }

  private loadStagesForPipeline(pipelineId: string): void {
    // Use cached pipelines if available
    const cached = this.pipelinesApi.pipelines();
    const pipeline = cached.find(p => p.id === pipelineId);
    if (pipeline) {
      this.stages.set(pipeline.stages ?? []);
      return;
    }
    // Fetch if not cached
    this.pipelinesApi.get(pipelineId).subscribe({
      next: p => this.stages.set(p.stages ?? []),
    });
  }

  private handleError(err: unknown, dealId: string): void {
    const status = (err as { status?: number })?.status;
    const apiErr = (err as { error?: { error?: string } })?.error?.error;
    if (status === 409 || apiErr === 'concurrency_conflict') {
      this.snack.open('This deal was updated by someone else — refreshing', 'Close', { duration: 3500 });
      this.loadDeal(dealId);
    } else {
      const msg = apiErr ?? 'Operation failed.';
      this.snack.open(msg, 'Close', { duration: 3500 });
    }
  }
}
