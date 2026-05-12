// src/app/pages/crm/leads/lead-form/lead-form.component.ts
import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { LeadsService, LeadWriteBody } from '../../../../core/services/leads.service';
import { LeadStatus, LeadSource } from '../../../../core/models/crm.models';
import { SidePanelRef, SIDE_PANEL_DATA } from '../../../../shared/side-panel';

@Component({
  selector: 'app-lead-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, RouterLink,
    MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="lf-wrap" [class.lf-page]="!isPanelMode">

      @if (!isPanelMode) {
        <div class="lf-page-header">
          <a mat-icon-button routerLink="/crm/leads"><mat-icon>arrow_back</mat-icon></a>
          <h2 class="lf-page-title">{{ isNew() ? 'New Lead' : 'Edit Lead' }}</h2>
        </div>
      }

      <form [formGroup]="form" (ngSubmit)="save()" class="lf">

        <!-- ── Contact Details ─────────────────────── -->
        <section class="lf-section">
          <p class="lf-section-label">Contact Details</p>
          <div class="lf-grid g3">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>First Name *</mat-label>
              <input matInput formControlName="firstName" autocomplete="given-name" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Last Name *</mat-label>
              <input matInput formControlName="lastName" autocomplete="family-name" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Email *</mat-label>
              <input matInput type="email" formControlName="email" autocomplete="email" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Phone</mat-label>
              <input matInput formControlName="phone" autocomplete="tel" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Company</mat-label>
              <input matInput formControlName="company" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Job Title</mat-label>
              <input matInput formControlName="jobTitle" />
            </mat-form-field>
          </div>
        </section>

        <div class="lf-sep"></div>

        <!-- ── Lead Details ────────────────────────── -->
        <section class="lf-section">
          <p class="lf-section-label">Lead Details</p>
          <div class="lf-grid g2">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Status</mat-label>
              <mat-select formControlName="status">
                <mat-option value="New">New</mat-option>
                <mat-option value="Contacted">Contacted</mat-option>
                <mat-option value="Qualified">Qualified</mat-option>
                <mat-option value="Unqualified">Unqualified</mat-option>
                <mat-option value="Converted">Converted</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Source</mat-label>
              <mat-select formControlName="source">
                <mat-option value="Website">Website</mat-option>
                <mat-option value="Referral">Referral</mat-option>
                <mat-option value="SocialMedia">Social Media</mat-option>
                <mat-option value="EmailCampaign">Email Campaign</mat-option>
                <mat-option value="TradeShow">Trade Show</mat-option>
                <mat-option value="ColdCall">Cold Call</mat-option>
                <mat-option value="Partner">Partner</mat-option>
                <mat-option value="Other">Other</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Score (0–100)</mat-label>
              <input matInput type="number" min="0" max="100" formControlName="score" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Est. Value (USD)</mat-label>
              <input matInput type="number" min="0" formControlName="estimatedValue" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Assigned To</mat-label>
              <input matInput formControlName="assignedTo" placeholder="Agent name" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Tags (comma-separated)</mat-label>
              <input matInput formControlName="tagsRaw" placeholder="Europe, VIP" />
            </mat-form-field>
          </div>
          <div class="lf-grid g1 lf-mt">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Notes</mat-label>
              <textarea matInput formControlName="notes" rows="3"></textarea>
            </mat-form-field>
          </div>
        </section>

        <!-- ── Actions ─────────────────────────────── -->
        <div class="lf-actions">
          @if (isPanelMode) {
            <button mat-stroked-button type="button" (click)="cancel()">Cancel</button>
          } @else {
            <a mat-stroked-button routerLink="/crm/leads">Cancel</a>
          }
          <button mat-flat-button color="primary" type="submit"
                  [disabled]="form.invalid || saving()">
            <mat-icon class="btn-icon">save</mat-icon>
            {{ saving() ? 'Saving…' : (isNew() ? 'Create Lead' : 'Save Changes') }}
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

    /* ── Action bar ─────────────────────────────── */
    .lf-actions {
      display: flex; justify-content: flex-end; align-items: center;
      gap: 8px; padding-top: 12px;
      border-top: 1px solid var(--lf-border); margin-top: 4px;
    }
    .btn-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
  `],
})
export class LeadFormComponent implements OnInit {
  private readonly fb        = inject(FormBuilder);
  private readonly api       = inject(LeadsService);
  private readonly snack     = inject(MatSnackBar);
  private readonly route     = inject(ActivatedRoute);
  private readonly router    = inject(Router);
  private readonly panelRef  = inject<SidePanelRef<'saved' | 'cancelled'> | null>(
    SidePanelRef, { optional: true });
  private readonly panelData = inject<{ id?: string } | null>(
    SIDE_PANEL_DATA, { optional: true });
  readonly isPanelMode = !!this.panelRef;

  readonly saving = signal(false);
  readonly isNew  = signal(true);

  form = this.fb.group({
    firstName:      ['', [Validators.required, Validators.maxLength(100)]],
    lastName:       ['', [Validators.required, Validators.maxLength(100)]],
    email:          ['', [Validators.required, Validators.email]],
    phone:          [''],
    company:        [''],
    jobTitle:       [''],
    status:         ['New' as LeadStatus, Validators.required],
    source:         ['Website' as LeadSource, Validators.required],
    score:          [50, [Validators.required, Validators.min(0), Validators.max(100)]],
    assignedTo:     [''],
    tagsRaw:        [''],
    notes:          [''],
    estimatedValue: [null as number | null],
  });

  ngOnInit(): void {
    const id = this.panelData?.id ?? this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isNew.set(false);
      this.api.get(id).subscribe({
        next: r => {
          this.form.patchValue({
            firstName: r.firstName, lastName: r.lastName, email: r.email,
            phone: r.phone, company: r.company, jobTitle: r.jobTitle,
            status: r.status as LeadStatus,
            source: this.displayToSource(r.source),
            score: r.score, assignedTo: r.assignedTo,
            tagsRaw: r.tags.join(', '),
            notes: r.notes,
            estimatedValue: r.estimatedValue ?? null,
          });
        },
        error: err => {
          this.snack.open(err?.error?.error ?? 'Failed to load lead.', 'Close', { duration: 3500 });
          if (this.isPanelMode) this.panelRef!.close();
          else this.router.navigate(['/crm/leads']);
        },
      });
    }

    if (this.panelRef) {
      this.form.valueChanges.subscribe(() => {
        this.panelRef!.setDirty(this.form.dirty);
      });
    }
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    const body: LeadWriteBody = {
      firstName:      v.firstName!,
      lastName:       v.lastName!,
      email:          v.email!,
      phone:          v.phone ?? '',
      company:        v.company ?? '',
      jobTitle:       v.jobTitle ?? '',
      status:         v.status as LeadStatus,
      source:         v.source as LeadSource,
      score:          v.score ?? 50,
      assignedTo:     v.assignedTo ?? '',
      tags:           v.tagsRaw ? v.tagsRaw.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0) : [],
      notes:          v.notes ?? '',
      estimatedValue: v.estimatedValue ?? undefined,
    };

    const id = this.panelData?.id ?? this.route.snapshot.paramMap.get('id');
    const call$ = (id && id !== 'new') ? this.api.update(id, body) : this.api.create(body);

    call$.subscribe({
      next: () => {
        this.saving.set(false);
        this.snack.open('Lead saved.', 'Close', { duration: 2500 });
        this.form.markAsPristine();
        this.panelRef?.setDirty(false);
        if (this.isPanelMode) this.panelRef!.close('saved');
        else this.router.navigate(['/crm/leads']);
      },
      error: err => {
        this.saving.set(false);
        this.snack.open(err?.error?.error ?? 'Save failed.', 'Close', { duration: 3500 });
      },
    });
  }

  cancel(): void {
    if (this.isPanelMode) this.panelRef!.close();
    else this.router.navigate(['/crm/leads']);
  }

  /**
   * Maps API display strings back to the C# enum names used as mat-option values.
   * e.g. "Social Media" → "SocialMedia", "Website" → "Website"
   */
  private displayToSource(display: string): LeadSource {
    const map: Record<string, string> = {
      'Social Media':   'SocialMedia',
      'Email Campaign': 'EmailCampaign',
      'Trade Show':     'TradeShow',
      'Cold Call':      'ColdCall',
    };
    return (map[display] ?? display) as LeadSource;
  }
}
