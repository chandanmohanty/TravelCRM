import { Observable, Subject } from 'rxjs';

/**
 * Handle to an open side panel. The rendered component injects this to
 * close itself with an optional result; the opener subscribes to
 * {@link afterClosed} to react.
 *
 * Modelled after `MatDialogRef`.
 *
 * ```ts
 * // Opener
 * this.sidePanel.open(SupplierFormComponent, { data: { id } })
 *   .afterClosed()
 *   .subscribe(result => { if (result === 'saved') this.reload(); });
 *
 * // Rendered component
 * private ref = inject<SidePanelRef<'saved' | 'cancelled'>>(SidePanelRef);
 * save() { ...; this.ref.close('saved'); }
 * ```
 */
export class SidePanelRef<R = unknown> {
  private readonly _afterClosed = new Subject<R | undefined>();

  /** Stream that emits exactly once when the panel finishes closing. */
  afterClosed(): Observable<R | undefined> {
    return this._afterClosed.asObservable();
  }

  /**
   * Close the panel.
   *
   * @param result Optional value delivered to {@link afterClosed} subscribers.
   */
  close(result?: R): void {
    this._requestClose?.(result);
  }

  /** @internal Hook the service uses to drive the close animation + cleanup. */
  _requestClose?: (result?: R) => void;

  /** @internal Called by the service after the panel has been fully torn down. */
  _handleClosed(result?: R): void {
    this._afterClosed.next(result);
    this._afterClosed.complete();
  }
}
