import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TablerIconsModule } from 'angular-tabler-icons';
import {
  SidePanelComponent,
  SidePanelService,
} from 'src/app/shared/side-panel';
import { DemoFormComponent, DemoFormResult } from './demo-form.component';

/**
 * Playground page for the shared SidePanel primitive.
 *
 * Exists so the team can see every flavour of the API in action without
 * touching a real form:
 *
 *  - Imperative open() with a typed afterClosed() result
 *  - Discard-changes guard via SidePanelRef.setDirty()
 *  - disableClose() while a fake save is in flight
 *  - Position: left vs right
 *  - Template-mode <app-side-panel> with content projection + [disableClose]
 */
@Component({
  selector: 'app-side-panel-demo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    TablerIconsModule,
    SidePanelComponent,
  ],
  template: `
    <div class="crm-page">
      <div class="page-header">
        <div class="page-title">
          <h2>Side Panel Playground</h2>
          <span class="subtitle">
            Live sandbox for the shared <code>SidePanel</code> primitive.
            Each card exercises a different flavour of the API.
          </span>
        </div>
      </div>

      <div class="demo-grid">

        <!-- ── 1. Imperative open + typed afterClosed -->
        <mat-card class="demo-card">
          <mat-card-content>
            <h3>1. Imperative open · typed result</h3>
            <p>
              Opens <code>DemoFormComponent</code> via
              <code>SidePanelService.open()</code>. The promise resolves with
              the typed payload passed to <code>ref.close()</code> — try Save
              vs Cancel and watch the status below change.
            </p>
            <button mat-flat-button color="primary" (click)="openSimple()">
              <i-tabler name="layout-sidebar-right" class="icon-sm mr-1"></i-tabler>
              Open form panel
            </button>
            @if (lastResult()) {
              <pre class="result">{{ lastResult() | json }}</pre>
            }
          </mat-card-content>
        </mat-card>

        <!-- ── 2. Pre-filled data injection -->
        <mat-card class="demo-card">
          <mat-card-content>
            <h3>2. Pre-filled data</h3>
            <p>
              Same form, but opens with a <code>data</code> payload that
              <code>DemoFormComponent</code> reads via
              <code>inject(SIDE_PANEL_DATA)</code>.
            </p>
            <button mat-flat-button color="primary" (click)="openPrefilled()">
              <i-tabler name="user-edit" class="icon-sm mr-1"></i-tabler>
              Open with pre-filled values
            </button>
          </mat-card-content>
        </mat-card>

        <!-- ── 3. Discard-changes guard -->
        <mat-card class="demo-card">
          <mat-card-content>
            <h3>3. Discard-changes guard</h3>
            <p>
              The demo form wires <code>form.dirty</code> into
              <code>ref.setDirty(true)</code>. Edit a field, then press
              Escape, click the backdrop, or hit the X — you'll get the
              "Discard changes?" prompt before the panel actually closes.
            </p>
            <button mat-stroked-button (click)="openSimple()">
              <i-tabler name="alert-circle" class="icon-sm mr-1"></i-tabler>
              Try the dirty guard
            </button>
          </mat-card-content>
        </mat-card>

        <!-- ── 4. Slide in from the left -->
        <mat-card class="demo-card">
          <mat-card-content>
            <h3>4. Position: left</h3>
            <p>
              Same component, opens from the left edge instead of the right.
              Useful for navigation drawers or context-on-context flows.
            </p>
            <button mat-stroked-button (click)="openLeft()">
              <i-tabler name="layout-sidebar-left" class="icon-sm mr-1"></i-tabler>
              Open as left panel
            </button>
          </mat-card-content>
        </mat-card>

        <!-- ── 5. Template mode with [disableClose] -->
        <mat-card class="demo-card">
          <mat-card-content>
            <h3>5. Template mode · <code>[disableClose]</code></h3>
            <p>
              Drop <code>&lt;app-side-panel&gt;</code> in a template, bind
              <code>[open]</code>, and project content. Toggle the lock to
              demonstrate <code>[disableClose]</code> — when locked, X /
              backdrop / Esc all become no-ops.
            </p>
            <div class="row">
              <button mat-flat-button color="primary" (click)="showFilters.set(true)">
                <i-tabler name="filter" class="icon-sm mr-1"></i-tabler>
                Open template panel
              </button>
              <mat-form-field appearance="outline" class="compact">
                <mat-label>Lock close?</mat-label>
                <mat-select [(ngModel)]="lockClose">
                  <mat-option [value]="false">No (default)</mat-option>
                  <mat-option [value]="true">Yes (disableClose)</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
          </mat-card-content>
        </mat-card>

      </div>
    </div>

    <!-- Template-mode panel (driven by [open] / (closed)) -->
    <app-side-panel
      [open]="showFilters()"
      title="Filters"
      subtitle="Template-mode demo · disableClose = {{ lockClose }}"
      width="420px"
      [disableClose]="lockClose"
      (closed)="showFilters.set(false)">
      <p class="hint">
        This panel is rendered inline by the playground component's template
        (not by the imperative service). It has no rendered child component —
        just projected content + a footer slot.
      </p>
      <ul class="bullets">
        <li>Backdrop, Esc, and X are wired automatically.</li>
        <li>Setting <code>lockClose = true</code> disables all three.</li>
        <li>The footer below uses <code>panelFooter</code> projection.</li>
      </ul>

      <div panelFooter>
        <button mat-stroked-button (click)="showFilters.set(false)" [disabled]="lockClose">
          Cancel
        </button>
        <button mat-flat-button color="primary" (click)="showFilters.set(false)">
          Apply
        </button>
      </div>
    </app-side-panel>
  `,
  styles: [
    `
      .crm-page { padding: 24px; }
      .page-header { margin-bottom: 24px; }
      .page-title h2 { margin: 0; font-size: 22px; font-weight: 600; }
      .page-title .subtitle { color: #6c757d; font-size: 14px; }
      .page-title code {
        background: #f1f5f9; padding: 1px 6px; border-radius: 4px;
        font-size: 12px; color: #1e293b;
      }

      .demo-grid {
        display: grid; gap: 16px;
        grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      }
      .demo-card mat-card-content { padding: 20px; }
      .demo-card h3 {
        margin: 0 0 8px; font-size: 16px; font-weight: 600; color: #0f172a;
      }
      .demo-card p {
        margin: 0 0 14px; color: #475569; font-size: 13px; line-height: 1.5;
      }
      .demo-card code {
        background: #f1f5f9; padding: 1px 6px; border-radius: 4px;
        font-size: 12px; color: #1e293b;
      }
      .row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
      .compact { width: 220px; }
      .result {
        margin: 14px 0 0; padding: 12px;
        background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;
        font-size: 12px; color: #1e293b; overflow-x: auto;
      }

      .mr-1 { margin-right: 4px; }

      .hint {
        font-size: 13px; color: #475569; margin: 0 0 12px; line-height: 1.5;
      }
      .bullets { margin: 0; padding-left: 20px; color: #475569; font-size: 13px; line-height: 1.7; }
      .bullets code {
        background: #f1f5f9; padding: 1px 6px; border-radius: 4px; font-size: 11px;
      }
    `,
  ],
})
export class SidePanelDemoComponent {
  private readonly sidePanel = inject(SidePanelService);

  // Template-mode panel state
  readonly showFilters = signal(false);
  lockClose = false;

  // Display the last imperative-open result
  readonly lastResult = signal<DemoFormResult | null>(null);

  openSimple(): void {
    const ref = this.sidePanel.open<DemoFormComponent, unknown, DemoFormResult>(
      DemoFormComponent,
      {
        title: 'Simple form',
        subtitle: 'Edit + close to see the result below',
        width: '480px',
      },
    );
    ref.afterClosed().subscribe((r) => this.lastResult.set(r ?? null));
  }

  openPrefilled(): void {
    const ref = this.sidePanel.open<
      DemoFormComponent,
      { prefill: { name: string; email: string; role: string } },
      DemoFormResult
    >(DemoFormComponent, {
      title: 'Edit profile',
      subtitle: 'Pre-filled via SIDE_PANEL_DATA',
      width: '480px',
      data: {
        prefill: { name: 'Sam Holiday', email: 'sam@example.com', role: 'manager' },
      },
    });
    ref.afterClosed().subscribe((r) => this.lastResult.set(r ?? null));
  }

  openLeft(): void {
    const ref = this.sidePanel.open<DemoFormComponent, unknown, DemoFormResult>(
      DemoFormComponent,
      {
        title: 'Left-side panel',
        subtitle: 'Same component, opens from the left',
        width: '480px',
        position: 'left',
      },
    );
    ref.afterClosed().subscribe((r) => this.lastResult.set(r ?? null));
  }
}
