import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewEncapsulation,
  booleanAttribute,
  inject,
  input,
  output,
  signal,
  viewChild,
  ViewContainerRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { animate, style, transition, trigger } from '@angular/animations';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TablerIconsModule } from 'angular-tabler-icons';
import type { SidePanelPosition } from './side-panel-config';

/**
 * Reusable slide-in panel. Two ways to use it:
 *
 * 1. **Imperative** (preferred for forms replacing MatDialog) — open it
 *    from anywhere via {@link SidePanelService.open}. The component you
 *    pass is rendered into the panel body via the `dynamicHost` outlet.
 *
 * 2. **Template** — drop `<app-side-panel>` into a parent template,
 *    bind `[open]`, and project content. Useful when the panel is
 *    semantically owned by one specific page.
 *
 * ```html
 * <app-side-panel
 *   [open]="showFilters()"
 *   title="Filters"
 *   width="420px"
 *   (closed)="showFilters.set(false)">
 *   <p>Filter controls go here…</p>
 *   <div panelFooter>
 *     <button mat-flat-button color="primary">Apply</button>
 *   </div>
 * </app-side-panel>
 * ```
 */
@Component({
  selector: 'app-side-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Use ViewEncapsulation.None so the imperative service can mount this
  // outside the originating component's view and styles still apply.
  encapsulation: ViewEncapsulation.None,
  imports: [CommonModule, MatButtonModule, MatIconModule, TablerIconsModule],
  template: `
    @if (open()) {
      <div
        class="side-panel-backdrop"
        [@backdrop]
        (click)="onBackdropClick()"
        aria-hidden="true"
      ></div>

      <aside
        class="side-panel"
        [class.side-panel-right]="position() === 'right'"
        [class.side-panel-left]="position() === 'left'"
        [ngClass]="panelClass()"
        [@panel]="position()"
        [style.width]="width()"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title() || 'Side panel'"
      >
        @if (!hideHeader()) {
          <header class="side-panel-header">
            <div class="side-panel-title-wrap">
              <h2 class="side-panel-title">{{ title() }}</h2>
              @if (subtitle()) {
                <p class="side-panel-subtitle">{{ subtitle() }}</p>
              }
            </div>
            <button
              mat-icon-button
              type="button"
              class="side-panel-close"
              aria-label="Close panel"
              (click)="close()"
            >
              <i-tabler name="x" class="icon-sm"></i-tabler>
            </button>
          </header>
        }

        <div class="side-panel-body">
          <!-- Imperative service mounts the user's component here -->
          <ng-container #dynamicHost></ng-container>
          <!-- Template-mode projected content -->
          <ng-content></ng-content>
        </div>

        <div class="side-panel-footer">
          <ng-content select="[panelFooter]"></ng-content>
        </div>
      </aside>
    }
  `,
  styles: [
    `
      .side-panel-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.45);
        z-index: 1040;
      }
      .side-panel {
        position: fixed;
        top: 0;
        bottom: 0;
        max-width: 100vw;
        background: #ffffff;
        box-shadow: 0 12px 48px rgba(15, 23, 42, 0.18);
        display: flex;
        flex-direction: column;
        z-index: 1041;
        overflow: hidden;
      }
      .side-panel-right {
        right: 0;
        border-top-left-radius: 12px;
        border-bottom-left-radius: 12px;
      }
      .side-panel-left {
        left: 0;
        border-top-right-radius: 12px;
        border-bottom-right-radius: 12px;
      }

      .side-panel-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        padding: 18px 20px;
        border-bottom: 1px solid #f1f5f9;
        background: #ffffff;
      }
      .side-panel-title-wrap {
        flex: 1;
        min-width: 0;
      }
      .side-panel-title {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #0f172a;
        line-height: 1.3;
      }
      .side-panel-subtitle {
        margin: 4px 0 0;
        font-size: 13px;
        color: #64748b;
        line-height: 1.4;
      }
      .side-panel-close {
        flex-shrink: 0;
        color: #475569;
      }

      .side-panel-body {
        flex: 1 1 auto;
        overflow-y: auto;
        padding: 20px;
        background: #ffffff;
      }
      .side-panel-footer {
        border-top: 1px solid #f1f5f9;
        background: #ffffff;
      }
      /* Hide the footer wrapper when nothing is projected into [panelFooter] */
      .side-panel-footer:empty {
        display: none;
      }
      .side-panel-footer:not(:empty) {
        padding: 14px 20px;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      @media (max-width: 600px) {
        .side-panel {
          width: 100vw !important;
          border-radius: 0;
        }
      }

      /*
       * Material's CDK overlay container defaults to z-index 1000, which sits
       * BELOW the side panel (1040/1041).  Raise it globally so that any
       * Material overlay (dialogs, tooltips, menus) opened while a side panel
       * is visible renders on top.  ViewEncapsulation.None means this rule is
       * written to the global stylesheet — exactly what we need here.
       */
      .cdk-overlay-container {
        z-index: 1100;
      }
    `,
  ],
  animations: [
    trigger('backdrop', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('180ms ease-out', style({ opacity: 1 })),
      ]),
      transition(':leave', [animate('180ms ease-in', style({ opacity: 0 }))]),
    ]),
    trigger('panel', [
      transition('void => right', [
        style({ transform: 'translateX(100%)' }),
        animate('220ms cubic-bezier(0.2, 0.8, 0.2, 1)', style({ transform: 'translateX(0)' })),
      ]),
      transition('right => void', [
        animate('200ms cubic-bezier(0.4, 0, 1, 1)', style({ transform: 'translateX(100%)' })),
      ]),
      transition('void => left', [
        style({ transform: 'translateX(-100%)' }),
        animate('220ms cubic-bezier(0.2, 0.8, 0.2, 1)', style({ transform: 'translateX(0)' })),
      ]),
      transition('left => void', [
        animate('200ms cubic-bezier(0.4, 0, 1, 1)', style({ transform: 'translateX(-100%)' })),
      ]),
    ]),
  ],
})
export class SidePanelComponent {
  // ── Inputs (signal-based) ─────────────────────────────────────────────
  /** Controls visibility. The imperative service sets this to `true` on open. */
  open = input(false, { transform: booleanAttribute });
  title = input('');
  subtitle = input<string | undefined>(undefined);
  /** Slide-in direction. Default `'right'`. */
  position = input<SidePanelPosition>('right');
  /** Any CSS width. Default `'480px'`. */
  width = input('480px');
  /** Click on the dim backdrop closes the panel. Default `true`. */
  closeOnBackdropClick = input(true, { transform: booleanAttribute });
  /** Escape key closes the panel. Default `true`. */
  closeOnEscape = input(true, { transform: booleanAttribute });
  /** Hide the built-in header so the rendered component can supply its own. */
  hideHeader = input(false, { transform: booleanAttribute });
  /**
   * Block user-initiated close attempts in template mode. Bind to e.g.
   * `[disableClose]="saving()"` to prevent dismissal mid-save.
   *
   * For imperative usage (via `SidePanelService`), prefer `ref.disableClose()`
   * — that path also covers the dirty-changes prompt via `ref.setDirty(...)`.
   */
  disableClose = input(false, { transform: booleanAttribute });
  /** Extra CSS class applied to the panel element. */
  panelClass = input<string | undefined>(undefined);

  // ── Output ────────────────────────────────────────────────────────────
  /** Fires when the user closes via X, backdrop, or Escape. */
  closed = output<void>();

  // ── Public refs (used by the service to mount dynamic content) ────────
  /** ViewContainerRef inside the panel body, used by `SidePanelService`. */
  readonly dynamicHost = viewChild.required('dynamicHost', { read: ViewContainerRef });

  /** Host element — exposed so the service can attach it to the DOM. */
  readonly host = inject(ElementRef<HTMLElement>);

  // ── Behavior ──────────────────────────────────────────────────────────
  /** Internally tracks the open state so the service can animate close. */
  private readonly _internalOpen = signal(false);

  onBackdropClick(): void {
    if (this.closeOnBackdropClick()) this.close();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open() && this.closeOnEscape()) this.close();
  }

  /**
   * Emits `closed`. In template mode the parent's `(closed)` handler decides
   * what to do; in imperative mode (via `SidePanelService`) the service
   * consults `ref._canClose()` before tearing down.
   *
   * Honours the `[disableClose]` input for template-mode users.
   */
  close(): void {
    if (this.disableClose()) return;
    this.closed.emit();
  }
}
