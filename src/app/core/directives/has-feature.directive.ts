import {
  Directive,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
  input,
} from '@angular/core';
import { EntitlementsService } from '../services/entitlements.service';

/**
 * Structural directive that renders its content only when the calling
 * tenant's plan entitles the given feature code.
 *
 * The directive is reactive — it subscribes (via `effect()`) to the
 * EntitlementsService signal, so the DOM updates automatically when the
 * plan changes (e.g. after an admin upgrades).
 *
 * @example
 * ```html
 * <button *hasFeature="'whatsapp_bulk_campaign'" mat-flat-button>
 *   Send WhatsApp blast
 * </button>
 *
 * <ng-container *hasFeature="'dialer'; else lockedTpl">
 *   <app-dialer></app-dialer>
 * </ng-container>
 * <ng-template #lockedTpl>
 *   <app-upgrade-cta featureCode="dialer"></app-upgrade-cta>
 * </ng-template>
 * ```
 */
@Directive({
  selector: '[hasFeature]',
  standalone: true,
})
export class HasFeatureDirective {
  private readonly tpl  = inject(TemplateRef<unknown>);
  private readonly vcr  = inject(ViewContainerRef);
  private readonly ents = inject(EntitlementsService);

  /** The required feature code (see FeatureCatalog on the backend). */
  readonly hasFeature = input.required<string>();

  /** Optional fallback template shown when the feature is NOT entitled. */
  readonly hasFeatureElse = input<TemplateRef<unknown> | null>(null);

  /**
   * If true, also hide the content when the subscription doesn't allow
   * writes (past-due / cancelled). Default true — most gated buttons are
   * "Create" buttons that we definitely don't want firing in past-due state.
   */
  readonly hasFeatureRequireWrite = input(true);

  constructor() {
    effect(() => {
      const code         = this.hasFeature();
      const requireWrite = this.hasFeatureRequireWrite();
      const elseTpl      = this.hasFeatureElse();

      // Track the entitlements signal so the effect re-runs on change.
      const ent = this.ents.entitlements();
      const granted =
        ent !== null &&
        ent.featureCodes.includes(code) &&
        (!requireWrite || ent.allowsWrites);

      this.vcr.clear();
      if (granted) {
        this.vcr.createEmbeddedView(this.tpl);
      } else if (elseTpl) {
        this.vcr.createEmbeddedView(elseTpl);
      }
    });
  }
}
