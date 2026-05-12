import {
  ApplicationRef,
  ComponentRef,
  EnvironmentInjector,
  Injectable,
  Injector,
  Type,
  createComponent,
  inject,
} from '@angular/core';
import { SidePanelComponent } from './side-panel.component';
import { SidePanelRef } from './side-panel-ref';
import { SIDE_PANEL_DATA, SidePanelConfig } from './side-panel-config';

/**
 * Opens an Angular component inside a {@link SidePanelComponent}, mirroring
 * the `MatDialog.open` ergonomics.
 *
 * ```ts
 * private readonly sidePanel = inject(SidePanelService);
 *
 * openEdit(supplier: SupplierDto) {
 *   const ref = this.sidePanel.open(SupplierFormComponent, {
 *     title: 'Edit Supplier',
 *     subtitle: supplier.name,
 *     width: '520px',
 *     data: { id: supplier.id },
 *   });
 *   ref.afterClosed().subscribe(result => {
 *     if (result === 'saved') this.reload();
 *   });
 * }
 * ```
 *
 * Inside `SupplierFormComponent`:
 *
 * ```ts
 * private readonly data = inject<{ id: string }>(SIDE_PANEL_DATA);
 * private readonly ref  = inject<SidePanelRef<'saved' | 'cancelled'>>(SidePanelRef);
 *
 * save() { ...; this.ref.close('saved'); }
 * cancel() { this.ref.close('cancelled'); }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class SidePanelService {
  private readonly appRef = inject(ApplicationRef);
  private readonly envInjector = inject(EnvironmentInjector);

  /** Currently open panels, used by Escape handling and a possible future `closeAll()`. */
  private readonly openPanels = new Set<ComponentRef<SidePanelComponent>>();

  /**
   * Open `component` inside a side panel.
   *
   * @typeParam T  Component type to render.
   * @typeParam D  Type of the `data` payload passed via {@link SIDE_PANEL_DATA}.
   * @typeParam R  Type of the result passed to `ref.close(...)`.
   */
  open<T, D = unknown, R = unknown>(
    component: Type<T>,
    config: SidePanelConfig<D> = {},
  ): SidePanelRef<R> {
    const ref = new SidePanelRef<R>();

    // Child injector exposes SIDE_PANEL_DATA + SidePanelRef to the rendered component.
    const injector = Injector.create({
      parent: this.envInjector,
      providers: [
        { provide: SIDE_PANEL_DATA, useValue: config.data ?? null },
        { provide: SidePanelRef, useValue: ref },
      ],
    });

    // Create the host SidePanelComponent.
    const panelRef = createComponent(SidePanelComponent, {
      environmentInjector: this.envInjector,
      elementInjector: injector,
    });

    // Wire inputs from config.
    panelRef.setInput('title', config.title ?? '');
    panelRef.setInput('subtitle', config.subtitle);
    panelRef.setInput('position', config.position ?? 'right');
    panelRef.setInput('width', config.width ?? '480px');
    panelRef.setInput(
      'closeOnBackdropClick',
      config.closeOnBackdropClick ?? true,
    );
    panelRef.setInput('closeOnEscape', config.closeOnEscape ?? true);
    panelRef.setInput('hideHeader', config.hideHeader ?? false);
    panelRef.setInput('panelClass', config.panelClass);
    panelRef.setInput('open', true);

    // Attach + render so viewChild('dynamicHost') resolves.
    this.appRef.attachView(panelRef.hostView);
    document.body.appendChild(panelRef.location.nativeElement);
    panelRef.changeDetectorRef.detectChanges();

    // Mount the user's component inside the panel body.
    const dynamicHost = panelRef.instance.dynamicHost();
    const contentRef = dynamicHost.createComponent(component, { injector });

    // Lock background scroll while the panel is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    let pendingResult: R | undefined;
    const teardown = () => {
      contentRef.destroy();
      this.appRef.detachView(panelRef.hostView);
      panelRef.destroy();
      this.openPanels.delete(panelRef);
      document.body.style.overflow = prevOverflow;
      ref._handleClosed(pendingResult);
    };

    // User-initiated close (X, backdrop, Escape).
    const closedSub = panelRef.instance.closed.subscribe(() => {
      // Toggle `open` to false so the leave animation runs, then tear down
      // once the animation finishes. We approximate the animation duration —
      // matches the 200ms panel leave + 180ms backdrop leave defined in the
      // component animations.
      panelRef.setInput('open', false);
      panelRef.changeDetectorRef.detectChanges();
      setTimeout(() => {
        closedSub.unsubscribe();
        teardown();
      }, 230);
    });

    // Programmatic close via ref.close(result).
    ref._requestClose = (result?: R) => {
      pendingResult = result;
      panelRef.instance.close();
    };

    this.openPanels.add(panelRef);
    return ref;
  }

  /** Close every open panel without a result. */
  closeAll(): void {
    // Snapshot — close() mutates openPanels via the close subscription.
    [...this.openPanels].forEach((p) => p.instance.close());
  }
}
