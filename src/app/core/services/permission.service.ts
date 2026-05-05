import { Injectable, Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from './auth.service';

/**
 * Exposes the current user's permission slug set as a reactive signal,
 * decoded once from the JWT. Consumers use `hasPermission('slug')` to
 * check capabilities; the `*hasPermission` structural directive renders
 * UI conditionally on the same signal.
 *
 * Auto-refreshes when {@link AuthService.currentUser} changes (login,
 * logout, refresh token flow).
 *
 * Platform admins carry a single `*` claim — treated as a wildcard
 * matching every slug.
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly auth = inject(AuthService);

  private readonly _slugs = signal<ReadonlySet<string>>(new Set());

  /** Read-only signal of all granted slugs. */
  readonly slugs: Signal<ReadonlySet<string>> = this._slugs.asReadonly();

  /** True when the caller holds the `*` wildcard (platform admin). */
  readonly isWildcard = computed(() => this._slugs().has('*'));

  constructor() {
    // Re-decode the JWT every time currentUser changes (login/logout).
    effect(() => {
      this.auth.currentUser();       // subscribe to changes
      untracked(() => this._slugs.set(this.readFromToken()));
    });
  }

  /** True if the caller can perform the action identified by `slug`. */
  hasPermission(slug: string): boolean {
    if (!slug) return false;
    const s = this._slugs();
    return s.has('*') || s.has(slug.toLowerCase());
  }

  /** True if any of the supplied slugs is granted. */
  hasAny(slugs: readonly string[]): boolean {
    if (!slugs?.length) return false;
    const s = this._slugs();
    if (s.has('*')) return true;
    return slugs.some(sl => s.has(sl.toLowerCase()));
  }

  private readFromToken(): ReadonlySet<string> {
    const payload = this.auth.getPayload();
    if (!payload) return new Set();
    const raw = (payload as unknown as Record<string, unknown>)['permission'];
    if (raw == null) return new Set();
    const arr = Array.isArray(raw) ? (raw as string[]) : [String(raw)];
    return new Set(arr.map(s => s.toLowerCase()));
  }
}
