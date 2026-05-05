import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom, catchError, of } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-base-url.token';
import { BrandApiService } from './brand-api.service';
import {
  BRAND_BUILTIN_FALLBACK,
  BrandResolved,
  BrandSource,
} from '../models/brand-settings.model';
import { CoreService } from 'src/app/services/core.service';

/**
 * Application-wide reactive store for the resolved brand (see the tenant →
 * platform → built-in fallback chain documented in the feature).
 *
 * Loaded once at bootstrap by `APP_INITIALIZER` and re-loaded whenever the user
 * saves new brand settings. All consumers read via `brand()` and the derived
 * `logoUrl()` computed (which handles light/dark mode automatically).
 */
@Injectable({ providedIn: 'root' })
export class BrandContextService {
  private readonly api      = inject(BrandApiService);
  private readonly base     = inject(API_BASE_URL);
  private readonly coreSvc  = inject(CoreService);

  /** Hardcoded path of the bundled SVG — final fallback when no URL is set. */
  private readonly BUILTIN_LOGO = './assets/images/logos/logo.svg';
  private readonly BUILTIN_FAVICON = '/favicon.ico';

  // Internal state
  private readonly _brand = signal<BrandResolved>(BRAND_BUILTIN_FALLBACK);
  private readonly _loaded = signal(false);

  /** Reactive accessor for the currently resolved brand. */
  readonly brand    = this._brand.asReadonly();
  readonly isLoaded = this._loaded.asReadonly();

  /**
   * Computed logo URL — picks the dark or light variant based on the current
   * theme from `CoreService`. If the chosen variant is not set, falls back
   * through light → built-in SVG in that order. Absolute external URLs are
   * passed through unchanged; relative URLs (from our upload endpoint) are
   * prefixed with the API base so the browser loads them from the API host.
   */
  readonly logoUrl = computed(() => {
    const b = this._brand();
    const theme = this.coreSvc.options().theme;
    const chosen = theme === 'dark'
      ? (b.logoDarkUrl ?? b.logoLightUrl)
      : (b.logoLightUrl ?? b.logoDarkUrl);
    return this.absolutise(chosen) ?? this.BUILTIN_LOGO;
  });

  /** Computed favicon URL, with built-in fallback. */
  readonly faviconUrl = computed(() =>
    this.absolutise(this._brand().faviconUrl) ?? this.BUILTIN_FAVICON,
  );

  /** Display name shown next to the logo and in `document.title` defaults. */
  readonly displayName = computed(() => this._brand().displayName);

  /** True when the real brand data has been loaded from the API (vs built-in default). */
  readonly isPopulated = computed(() => this._brand().source !== BrandSource.Hardcoded);

  constructor() {
    // Keep the live <link rel="icon"> in sync with the computed favicon URL.
    effect(() => {
      const url = this.faviconUrl();
      const link = document.getElementById('app-favicon') as HTMLLinkElement | null;
      if (link && url) link.href = url;
    });
  }

  /**
   * APP_INITIALIZER entry point. Resolves successfully in all cases so the app
   * bootstrap can never be blocked by a backend outage — a network error
   * simply leaves the built-in fallback in effect.
   */
  async load(): Promise<void> {
    try {
      const result = await firstValueFrom(
        this.api.getResolved().pipe(catchError(() => of(null))),
      );
      if (result) {
        this._brand.set(result);
      }
    } catch {
      // Unreachable — `catchError(of(null))` above converts HTTP errors to null.
    } finally {
      this._loaded.set(true);
    }
  }

  /** Imperatively replace the in-memory brand after a successful save. */
  setBrand(next: BrandResolved): void {
    this._brand.set(next);
  }

  // ── helpers ───────────────────────────────────────────────────────────

  /**
   * Convert a server-supplied URL into something the browser can load.
   * - null / empty → null (caller substitutes built-in default)
   * - absolute (http/https) → returned unchanged
   * - site-relative (`/uploads/...`) → prefixed with API base URL
   */
  private absolutise(url: string | null): string | null {
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith('/')) return `${this.base}${url}`;
    return url;
  }
}
