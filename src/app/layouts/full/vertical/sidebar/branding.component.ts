import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { BrandContextService } from 'src/app/core/services/brand-context.service';

/**
 * Sidebar / header brand block. Reactively binds the logo source to the
 * computed `logoUrl` signal on {@link BrandContextService}, which already
 * handles the light/dark mode swap and the tenant → platform → built-in SVG
 * fallback chain. Re-renders automatically on:
 *   - brand load at bootstrap
 *   - brand save (component triggers `brandCtx.load()`)
 *   - theme toggle (CoreService.options signal change → logoUrl recomputes)
 */
@Component({
  selector: 'app-branding',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterModule],
  template: `
    <a [routerLink]="['/']" [attr.title]="brandCtx.displayName()" class="branding-link">
      <img
        [src]="brandCtx.logoUrl()"
        [alt]="brandCtx.displayName()"
        class="branding-logo align-middle"
      />
    </a>
  `,
  styles: [`
    .branding-link {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      text-decoration: none;
    }
    .branding-logo {
      max-height: 48px;
      max-width: 180px;
      width: auto;
      height: auto;
      object-fit: contain;
    }
  `],
})
export class BrandingComponent {
  readonly brandCtx = inject(BrandContextService);
}
