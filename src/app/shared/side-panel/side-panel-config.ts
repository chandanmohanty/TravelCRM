import { InjectionToken } from '@angular/core';

/** Position the panel slides in from. Defaults to 'right'. */
export type SidePanelPosition = 'right' | 'left';

/**
 * Configuration accepted by {@link SidePanelService.open}.
 *
 * Mirrors `MatDialogConfig` so the mental model is familiar — but smaller,
 * since a slide-in panel has fewer knobs than a modal dialog.
 */
export interface SidePanelConfig<D = unknown> {
  /** Header title shown at the top of the panel. */
  title?: string;
  /** Optional one-line subtitle under the title. */
  subtitle?: string;
  /** Side to slide in from. Default `'right'`. */
  position?: SidePanelPosition;
  /** CSS width. Default `'480px'`. Accepts any CSS length (e.g. `'40vw'`). */
  width?: string;
  /** Data payload, injectable as `SIDE_PANEL_DATA` inside the rendered component. */
  data?: D;
  /** Click on the dimmed backdrop closes the panel. Default `true`. */
  closeOnBackdropClick?: boolean;
  /** Pressing Escape closes the panel. Default `true`. */
  closeOnEscape?: boolean;
  /** Extra CSS class applied to the panel element (for one-off styling). */
  panelClass?: string;
  /**
   * If `true`, hides the built-in header. The rendered component is then
   * responsible for rendering its own title + close button.
   * Default `false`.
   */
  hideHeader?: boolean;
}

/**
 * Injection token for the `data` payload passed to {@link SidePanelService.open}.
 * Inject it inside the rendered component:
 *
 * ```ts
 * private data = inject<MyData>(SIDE_PANEL_DATA);
 * ```
 */
export const SIDE_PANEL_DATA = new InjectionToken<unknown>('SidePanelData');
