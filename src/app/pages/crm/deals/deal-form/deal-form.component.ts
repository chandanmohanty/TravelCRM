// src/app/pages/crm/deals/deal-form/deal-form.component.ts
import {
  Component, ChangeDetectionStrategy, inject, OnInit, signal, computed, effect, DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DealsService } from '../../../../core/services/deals.service';
import { PipelinesService } from '../../../../core/services/pipelines.service';
import { IdentityApiService } from '../../../../core/services/identity-api.service';
import { AuthService } from '../../../../core/services/auth.service';
import { PipelineDto, PipelineStageDto, DealDto } from '../../../../core/models/crm.models';
import { UserDto } from '../../../../core/models/identity.model';
import { SidePanelRef, SIDE_PANEL_DATA } from '../../../../shared/side-panel';

const CURRENCY_CODES = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED', 'INR', 'JPY', 'CHF'];

@Component({
  selector: 'app-deal-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, RouterLink,
    MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatDatepickerModule, MatNativeDateModule, MatSliderModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="lf-wrap" [class.lf-page]="!isPanelMode">

      @if (!isPanelMode) {
        <div class="lf-page-header">
          <a mat-icon-button routerLink="/crm/deals"><mat-icon>arrow_back</mat-icon></a>
          <h2 class="lf-page-title">{{ isNew() ? 'New Deal' : 'Edit Deal' }}</h2>
        </div>
      }

      <form [formGroup]="form" (ngSubmit)="save()" class="lf">

        <!-- ── Deal Info ───────────────────────────────── -->
        <section class="lf-section">
          <p class="lf-section-label">Deal Info</p>

          <div class="lf-grid g1">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Title *</mat-label>
              <input matInput formControlName="title" autocomplete="off" />
            </mat-form-field>
          </div>

          <div class="lf-grid g2 lf-mt">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Pipeline</mat-label>
              <mat-select formControlName="pipelineId" (selectionChange)="onPipelineChange($event.value)">
                @for (p of pipelines(); track p.id) {
                  <mat-option [value]="p.id">{{ p.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Stage</mat-label>
              <mat-select formControlName="stageId" (selectionChange)="onStageChange($event.value)">
                @for (s of filteredStages(); track s.id) {
                  <mat-option [value]="s.id">{{ s.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>
        </section>

        <div class="lf-sep"></div>

        <!-- ── Contact ────────────────────────────────── -->
        <section class="lf-section">
          <p class="lf-section-label">Contact</p>
          <div class="lf-grid g2">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Contact Name *</mat-label>
              <input matInput formControlName="contactName" autocomplete="name" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Contact Email</mat-label>
              <input matInput type="email" formControlName="contactEmail" autocomplete="email" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Contact Phone</mat-label>
              <input matInput formControlName="contactPhone" autocomplete="tel" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Company</mat-label>
              <input matInput formControlName="companyName" />
            </mat-form-field>
          </div>
          @if (!isNew()) {
            <p class="lf-snapshot-hint">Contact details are a snapshot. Use the deal's Reassign / stage actions to change owner or stage.</p>
          }
        </section>

        <div class="lf-sep"></div>

        <!-- ── Commercial ─────────────────────────────── -->
        <section class="lf-section">
          <p class="lf-section-label">Commercial</p>
          <div class="lf-grid g3">
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="g-span-2">
              <mat-label>Value</mat-label>
              <input matInput type="number" min="0" formControlName="value" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Currency</mat-label>
              <mat-select formControlName="currency">
                @for (c of currencies; track c) {
                  <mat-option [value]="c">{{ c }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>

          <div class="lf-probability lf-mt">
            <div class="lf-prob-header">
              <span class="lf-section-label" style="margin:0">Probability: {{ form.get('probability')?.value }}%</span>
              @if (defaultProbability() !== null) {
                <button type="button" mat-button class="lf-reset-btn"
                        (click)="resetProbability()">Reset to default ({{ defaultProbability() }}%)</button>
              }
            </div>
            <mat-slider min="0" max="100" step="1" discrete>
              <input matSliderThumb formControlName="probability" />
            </mat-slider>
          </div>

          <div class="lf-grid g2 lf-mt">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Expected Close Date</mat-label>
              <input matInput [matDatepicker]="closePicker" formControlName="expectedCloseDate" />
              <mat-datepicker-toggle matIconSuffix [for]="closePicker"></mat-datepicker-toggle>
              <mat-datepicker #closePicker></mat-datepicker>
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Owner</mat-label>
              <mat-select formControlName="ownerUserId">
                @for (u of users(); track u.id) {
                  <mat-option [value]="u.id">{{ u.firstName }} {{ u.lastName }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>
        </section>

        <div class="lf-sep"></div>

        <!-- ── Notes & Tags ───────────────────────────── -->
        <section class="lf-section">
          <p class="lf-section-label">Notes & Tags</p>
          <div class="lf-grid g1">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Tags (comma-separated)</mat-label>
              <input matInput formControlName="tagsRaw" placeholder="VIP, Europe, Group" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="lf-mt">
              <mat-label>Notes</mat-label>
              <textarea matInput formControlName="notes" rows="3"></textarea>
            </mat-form-field>
          </div>
        </section>

        <!-- ── Actions ────────────────────────────────── -->
        <div class="lf-actions">
          @if (isPanelMode) {
            <button mat-stroked-button type="button" (click)="cancel()">Cancel</button>
          } @else {
            <a mat-stroked-button routerLink="/crm/deals">Cancel</a>
          }
          <button mat-flat-button color="primary" type="submit"
                  [disabled]="form.invalid || saving()">
            <mat-icon class="btn-icon">save</mat-icon>
            {{ saving() ? 'Saving…' : (isNew() ? 'Create Deal' : 'Save Changes') }}
          </button>
        </div>

      </form>
    </div>
  `,
  styles: [`
    /* ── Design tokens ──────────────────────────── */
    :host {
      --lf-bg:      #ffffff;
      --lf-border:  #f1f5f9;
      --lf-shadow:  rgba(15, 23, 42, .07);
      --lf-text-hi: #0f172a;
      --lf-text-dim:#94a3b8;
    }
    :host-context(.dark-theme) {
      --lf-bg:      #1a2537;
      --lf-border:  #2e3f50;
      --lf-shadow:  rgba(0, 0, 0, .22);
      --lf-text-hi: rgba(255, 255, 255, .90);
      --lf-text-dim:rgba(255, 255, 255, .38);
    }

    /* ── Outer wrapper ──────────────────────────── */
    .lf-wrap { display: block; }

    /* Page-mode: single card shell */
    .lf-page {
      background: var(--lf-bg);
      border-radius: 12px; padding: 24px;
      box-shadow: 0 2px 16px var(--lf-shadow);
      max-width: 860px;
    }
    .lf-page-header { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; }
    .lf-page-title  { margin: 0; font-size: 20px; font-weight: 700; color: var(--lf-text-hi); }

    /* ── Form skeleton ──────────────────────────── */
    .lf { display: flex; flex-direction: column; }
    .lf-section { padding: 14px 0; }
    .lf-sep { height: 1px; background: var(--lf-border); }

    /* ── Section label ──────────────────────────── */
    .lf-section-label {
      margin: 0 0 10px;
      font-size: 10.5px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.8px;
      color: var(--lf-text-dim);
    }

    /* ── CSS grids ──────────────────────────────── */
    .lf-grid    { display: grid; gap: 8px; }
    .lf-grid.g1 { grid-template-columns: 1fr; }
    .lf-grid.g2 { grid-template-columns: repeat(2, 1fr); }
    .lf-grid.g3 { grid-template-columns: repeat(3, 1fr); }
    .lf-mt      { margin-top: 8px; }
    .lf mat-form-field { width: 100%; }
    .g-span-2 { grid-column: span 2; }

    /* ── Probability ────────────────────────────── */
    .lf-probability { display: flex; flex-direction: column; gap: 4px; }
    .lf-prob-header { display: flex; align-items: center; justify-content: space-between; }
    .lf-reset-btn { font-size: 11px; height: 24px; line-height: 24px; padding: 0 8px;
                    color: #6366f1; min-width: auto; }
    mat-slider { width: 100%; }

    /* ── Snapshot hint (edit mode only) ────────── */
    .lf-snapshot-hint {
      margin: 6px 0 0; font-size: 11.5px; color: var(--lf-text-dim); font-style: italic;
    }

    /* ── Action bar ─────────────────────────────── */
    .lf-actions {
      display: flex; justify-content: flex-end; align-items: center;
      gap: 8px; padding-top: 12px;
      border-top: 1px solid var(--lf-border); margin-top: 4px;
    }
    .btn-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
  `],
})
export class DealFormComponent implements OnInit {
  private readonly fb           = inject(FormBuilder);
  private readonly dealsApi     = inject(DealsService);
  private readonly pipelinesApi = inject(PipelinesService);
  private readonly identityApi  = inject(IdentityApiService);
  private readonly auth         = inject(AuthService);
  private readonly snack        = inject(MatSnackBar);
  private readonly route        = inject(ActivatedRoute);
  private readonly router       = inject(Router);
  private readonly destroyRef   = inject(DestroyRef);
  private readonly panelRef     = inject<SidePanelRef<'saved' | 'cancelled'> | null>(
    SidePanelRef, { optional: true });
  private readonly panelData    = inject<{ dealId?: string; leadId?: string } | null>(
    SIDE_PANEL_DATA, { optional: true });

  readonly isPanelMode = !!this.panelRef;
  readonly saving      = signal(false);
  readonly isNew       = signal(true);

  readonly pipelines       = signal<PipelineDto[]>([]);
  readonly filteredStages  = signal<PipelineStageDto[]>([]);
  readonly users           = signal<UserDto[]>([]);
  readonly defaultProbability = signal<number | null>(null);

  readonly currencies = CURRENCY_CODES;

  /** Stored for optimistic-concurrency on update */
  private rowVersion = '';

  form = this.fb.group({
    title:            ['', [Validators.required, Validators.maxLength(200)]],
    pipelineId:       [''],
    stageId:          [''],
    contactName:      ['', [Validators.required, Validators.maxLength(200)]],
    contactEmail:     [''],
    contactPhone:     [''],
    companyName:      [''],
    value:            [null as number | null],
    currency:         ['USD', Validators.required],
    probability:      [50, [Validators.required, Validators.min(0), Validators.max(100)]],
    expectedCloseDate:[null as Date | null],
    ownerUserId:      [''],
    tagsRaw:          [''],
    notes:            [''],
  });

  ngOnInit(): void {
    // Load pipelines
    this.pipelinesApi.list().subscribe({
      next: ps => {
        this.pipelines.set(ps);
        const def = ps.find(p => p.isDefault) ?? ps[0];
        if (def && !this.form.get('pipelineId')?.value) {
          this.form.patchValue({ pipelineId: def.id });
          this.setStagesForPipeline(def);
        }
      },
    });

    // Load users for owner picker
    this.identityApi.listUsers({ pageSize: 200 }).subscribe({
      next: resp => this.users.set(resp.items),
    });

    // Default owner to current user
    const currentUserId = this.auth.currentUser()?.userId ?? '';
    if (currentUserId) {
      this.form.patchValue({ ownerUserId: currentUserId });
    }

    // Edit mode
    const dealId = this.panelData?.dealId ?? this.route.snapshot.paramMap.get('id');
    if (dealId && dealId !== 'new') {
      this.isNew.set(false);
      this.dealsApi.get(dealId).subscribe({
        next: deal => this.populateForm(deal),
        error: err => {
          this.snack.open(err?.error?.error ?? 'Failed to load deal.', 'Close', { duration: 3500 });
          if (this.isPanelMode) this.panelRef!.close();
          else this.router.navigate(['/crm/deals']);
        },
      });
    }

    // Wire dirty tracking to panel (takeUntilDestroyed prevents subscription leak)
    if (this.panelRef) {
      this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
        this.panelRef!.setDirty(this.form.dirty);
      });
    }
  }

  onPipelineChange(pipelineId: string): void {
    const pipeline = this.pipelines().find(p => p.id === pipelineId);
    if (!pipeline) return;
    this.setStagesForPipeline(pipeline);
    // Reset stage
    this.form.patchValue({ stageId: '' });
    this.defaultProbability.set(null);
  }

  onStageChange(stageId: string): void {
    const stage = this.filteredStages().find(s => s.id === stageId);
    if (!stage) return;
    this.defaultProbability.set(stage.defaultProbability);
    this.form.patchValue({ probability: stage.defaultProbability });
  }

  resetProbability(): void {
    const dp = this.defaultProbability();
    if (dp !== null) {
      this.form.patchValue({ probability: dp });
    }
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    const tags = v.tagsRaw
      ? v.tagsRaw.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0)
      : [];

    const dealId = this.panelData?.dealId ?? this.route.snapshot.paramMap.get('id');
    const isEdit = !this.isNew();

    const closeDate = v.expectedCloseDate
      ? this.formatDate(v.expectedCloseDate as Date)
      : null;

    if (isEdit && dealId) {
      this.dealsApi.update(dealId, {
        rowVersion:          this.rowVersion,
        title:               v.title!,
        value:               v.value ?? null,
        currency:            v.currency!,
        probability:         v.probability!,
        expectedCloseDate:   closeDate,
        tags,
        notes:               v.notes ?? null,
      }).subscribe({
        next: () => this.onSaveSuccess(),
        error: err => this.onSaveError(err),
      });
    } else {
      this.dealsApi.create({
        leadId:              this.panelData?.leadId,
        title:               v.title!,
        contactName:         v.contactName!,
        contactEmail:        v.contactEmail ?? undefined,
        contactPhone:        v.contactPhone ?? undefined,
        companyName:         v.companyName ?? undefined,
        pipelineId:          v.pipelineId ?? undefined,
        stageId:             v.stageId ?? undefined,
        value:               v.value ?? undefined,
        currency:            v.currency!,
        probability:         v.probability!,
        expectedCloseDate:   closeDate ?? undefined,
        ownerUserId:         v.ownerUserId ?? undefined,
        tags,
        notes:               v.notes ?? undefined,
      }).subscribe({
        next: () => this.onSaveSuccess(),
        error: err => this.onSaveError(err),
      });
    }
  }

  cancel(): void {
    if (this.isPanelMode) this.panelRef!.close();
    else this.router.navigate(['/crm/deals']);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private populateForm(deal: DealDto): void {
    this.rowVersion = deal.rowVersion;
    // Update filtered stages first
    const pipeline = this.pipelines().find(p => p.id === deal.pipelineId);
    if (pipeline) this.setStagesForPipeline(pipeline);

    this.form.patchValue({
      title:             deal.title,
      pipelineId:        deal.pipelineId,
      stageId:           deal.stageId,
      contactName:       deal.contactName,
      contactEmail:      deal.contactEmail ?? '',
      contactPhone:      deal.contactPhone ?? '',
      companyName:       deal.companyName ?? '',
      value:             deal.value ?? null,
      currency:          deal.currency,
      probability:       deal.probability,
      expectedCloseDate: deal.expectedCloseDate ? new Date(deal.expectedCloseDate) : null,
      ownerUserId:       deal.ownerUserId,
      tagsRaw:           deal.tags.join(', '),
      notes:             deal.notes ?? '',
    });

    // In edit mode, disable fields that dealsApi.update does not accept.
    // Contact details are an immutable snapshot; pipeline/stage are changed
    // via the detail panel's stage-move; owner is changed via Reassign.
    this.form.controls.contactName.disable();
    this.form.controls.contactEmail.disable();
    this.form.controls.contactPhone.disable();
    this.form.controls.companyName.disable();
    this.form.controls.pipelineId.disable();
    this.form.controls.stageId.disable();
    this.form.controls.ownerUserId.disable();

    const currentStage = this.filteredStages().find(s => s.id === deal.stageId);
    if (currentStage) this.defaultProbability.set(currentStage.defaultProbability);
  }

  private setStagesForPipeline(pipeline: PipelineDto): void {
    this.filteredStages.set(pipeline.stages ?? []);
    if (!this.form.get('stageId')?.value) {
      const firstStage = pipeline.stages?.[0];
      if (firstStage) {
        this.form.patchValue({ stageId: firstStage.id });
        this.defaultProbability.set(firstStage.defaultProbability);
        this.form.patchValue({ probability: firstStage.defaultProbability });
      }
    }
  }

  private onSaveSuccess(): void {
    this.saving.set(false);
    this.snack.open('Deal saved.', 'Close', { duration: 2500 });
    this.form.markAsPristine();
    this.panelRef?.setDirty(false);
    if (this.isPanelMode) this.panelRef!.close('saved');
    else this.router.navigate(['/crm/deals']);
  }

  private onSaveError(err: unknown): void {
    this.saving.set(false);
    const msg = (err as { error?: { error?: string } })?.error?.error ?? 'Save failed.';
    this.snack.open(msg, 'Close', { duration: 3500 });
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
