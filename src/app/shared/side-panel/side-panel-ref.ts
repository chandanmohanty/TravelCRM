import { Observable, Subject } from 'rxjs';

/**
 * Handle to an open side panel. The rendered component injects this to
 * close itself with an optional result; the opener subscribes to
 * {@link afterClosed} to react.
 *
 * Modelled after `MatDialogRef`. Two opt-in close-guard APIs:
 *
 * - {@link disableClose} — blocks every user-initiated close attempt
 *   (X, backdrop, Escape). Programmatic `ref.close(...)` from the
 *   rendered component still works.
 * - {@link setDirty} — marks the panel as having unsaved changes.
 *   User-initiated close attempts open a Material confirmation dialog;
 *   the panel only closes if the user clicks "Discard".
 *
 * Both are independent. `disableClose()` takes precedence over `setDirty()`.
 *
 * ```ts
 * // Inside the rendered form
 * private readonly ref = inject<SidePanelRef<'saved'>>(SidePanelRef);
 *
 * constructor() {
 *   // wire form.dirty into the panel's discard prompt
 *   effect(() => this.ref.setDirty(this.form.dirty));
 * }
 *
 * save() {
 *   // explicit close — bypasses the prompt
 *   this.api.save(...).subscribe(() => this.ref.close('saved'));
 * }
 * ```
 */
export class SidePanelRef<R = unknown> {
  private readonly _afterClosed = new Subject<R | undefined>();
  private _disableClose = false;
  private _dirty = false;
  private _dirtyConfirmMessage = 'You have unsaved changes. Discard them?';

  /** Stream that emits exactly once when the panel finishes closing. */
  afterClosed(): Observable<R | undefined> {
    return this._afterClosed.asObservable();
  }

  /**
   * Block every user-initiated close attempt (X button, backdrop click,
   * Escape key). Programmatic close from inside the rendered component
   * via {@link close} still works — this is for blocking accidental
   * dismissal of in-flight operations.
   */
  disableClose(): void {
    this._disableClose = true;
  }

  /** Re-enable user-initiated closing after a previous {@link disableClose}. */
  enableClose(): void {
    this._disableClose = false;
  }

  /**
   * Mark the panel as having unsaved changes. When true, user-initiated
   * close attempts open a Material confirmation dialog; the panel only
   * closes if the user clicks "Discard".
   *
   * Form components typically wire this to `form.dirty`:
   *
   * ```ts
   * effect(() => this.ref.setDirty(this.form.dirty));
   * ```
   */
  setDirty(dirty: boolean): void {
    this._dirty = dirty;
  }

  /** Customize the body text shown in the discard-changes dialog. */
  setDirtyConfirmMessage(message: string): void {
    this._dirtyConfirmMessage = message;
  }

  /**
   * Close the panel. **Bypasses** the dirty/disable-close guards — this
   * is for the rendered component itself explicitly closing (save succeeded,
   * user clicked the in-form Cancel button after confirming, etc.).
   *
   * @param result Optional value delivered to {@link afterClosed} subscribers.
   */
  close(result?: R): void {
    this._requestClose?.(result);
  }

  /** @internal Service-side hook to drive the leave animation + cleanup. */
  _requestClose?: (result?: R) => void;

  /** @internal True while user-initiated close is blocked. */
  _isDisabled(): boolean {
    return this._disableClose;
  }

  /** @internal True when unsaved-changes guard is active. */
  _isDirty(): boolean {
    return this._dirty;
  }

  /** @internal Body text passed to the discard-changes dialog. */
  _getDirtyMessage(): string {
    return this._dirtyConfirmMessage;
  }

  /** @internal Called after teardown to fire {@link afterClosed}. */
  _handleClosed(result?: R): void {
    this._afterClosed.next(result);
    this._afterClosed.complete();
  }
}
