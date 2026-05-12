import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, of, tap } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { API_BASE_URL } from '../tokens/api-base-url.token';

// ── Wire-format DTOs (mirror C# Features/Subscriptions/Dtos.cs) ──────────────

/**
 * Public plan as returned by `/api/plans` and the Platform Plans admin endpoint.
 */
export interface PlanDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthlyPrice: number | null;
  annualPricePerMonth: number | null;
  flatMonthlyPrice: number | null;
  currency: string;
  seatLimit: number | null;
  storageGbLimit: number | null;
  webhookLimit: number | null;
  workflowRuleLimit: number | null;
  marketingRuleLimit: number | null;
  chatLicenseLimit: number | null;
  departmentLimit: number | null;
  roleLimit: number | null;
  isActive: boolean;
  isContactSalesOnly: boolean;
  sortOrder: number;
  featureCodes: string[];
}

/**
 * Snapshot returned by `/api/me/entitlements`. Mirrors C# EntitlementsDto.
 */
export interface EntitlementsDto {
  tenantId: string;
  planId: string;
  planCode: string;
  planName: string;
  status: 'Free' | 'Trial' | 'Active' | 'PastDue' | 'Cancelled';
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelledAt: string | null;
  allowsWrites: boolean;

  seatLimit: number | null;
  usedSeats: number;
  storageGbLimit: number | null;
  storageUsedBytes: number;
  webhookLimit: number | null;
  workflowRuleLimit: number | null;
  marketingRuleLimit: number | null;
  chatLicenseLimit: number | null;
  departmentLimit: number | null;
  roleLimit: number | null;

  featureCodes: string[];
}

/**
 * Subscription / plan entitlement state for the current tenant. Holds the
 * answer to "is feature X enabled on this plan?" — consumed by the
 * `*hasFeature` directive, route guards, and tenant-facing meters.
 *
 * Loaded once on app bootstrap (call {@link load} from the bootstrap
 * sequence or from AuthService after login). Cached as a signal so any
 * template binding stays reactive when an admin upgrades the plan.
 */
@Injectable({ providedIn: 'root' })
export class EntitlementsService {
  private readonly http    = inject(HttpClient);
  private readonly apiBase = inject(API_BASE_URL);

  /** Backing signal — null until first load, then either the snapshot or null on failure. */
  private readonly _entitlements = signal<EntitlementsDto | null>(null);

  /** Fast O(1) lookup. Recomputed when entitlements signal changes. */
  private readonly _featureSet = computed(() => {
    const e = this._entitlements();
    return e ? new Set(e.featureCodes) : new Set<string>();
  });

  /** Public read-only signal — bind in templates or computed()s. */
  readonly entitlements = this._entitlements.asReadonly();

  /** Loaded? Useful to gate UI on bootstrap. */
  readonly isLoaded = computed(() => this._entitlements() !== null);

  /** True when subscription is in a writable state (not past-due / cancelled). */
  readonly allowsWrites = computed(() => this._entitlements()?.allowsWrites ?? false);

  /** Current plan code (e.g. "starter", "grow"), or null before load. */
  readonly planCode = computed(() => this._entitlements()?.planCode ?? null);

  /**
   * Synchronous entitlement check. Returns false until {@link load} completes,
   * which is fine — UI is rendered after load, and the `*hasFeature`
   * directive re-evaluates when the signal updates.
   */
  isEntitled(featureCode: string): boolean {
    return this._featureSet().has(featureCode);
  }

  /**
   * Reactive entitlement check that re-evaluates when the signal updates.
   * Use this inside `computed()`s or template bindings.
   */
  isEntitled$(featureCode: string) {
    return computed(() => this._featureSet().has(featureCode));
  }

  /**
   * Re-fetch from the server. Call on login + after any plan-change event.
   *
   * EnvelopeInterceptor unwraps the `{success, data}` shape on the way in,
   * so this service sees the bare DTO.
   */
  load(): Observable<EntitlementsDto | null> {
    return this.http
      .get<EntitlementsDto>(`${this.apiBase}/api/me/entitlements`)
      .pipe(
        tap(e => this._entitlements.set(e)),
        catchError(() => {
          // Platform admins, unauthenticated calls, or missing subscriptions
          // land here — clear the cache and let the UI fall back to "no
          // entitlements" (all checks return false).
          this._entitlements.set(null);
          return of(null);
        }),
      );
  }

  /** Wipe the cache — called by AuthService on logout. */
  clear(): void {
    this._entitlements.set(null);
  }

  // ── Plan catalogue (used by upgrade page and Platform Plans admin) ────────

  /** Public plan list (excludes contact-sales tiers). */
  listPlans(): Observable<PlanDto[]> {
    return this.http.get<PlanDto[]>(`${this.apiBase}/api/plans`);
  }

  /** Platform-admin plan list (includes inactive + contact-sales). */
  listAllPlans(): Observable<PlanDto[]> {
    return this.http.get<PlanDto[]>(`${this.apiBase}/api/platform/plans`);
  }

  /** Platform-admin update of a plan's pricing / limits / features. */
  updatePlan(id: string, body: Partial<PlanDto> & { featureCodes: string[] }): Observable<PlanDto> {
    return this.http.put<PlanDto>(`${this.apiBase}/api/platform/plans/${id}`, body);
  }

  /** Platform-admin: assign a tenant to a plan. */
  assignPlan(tenantId: string, planId: string): Observable<{ subscriptionId: string }> {
    return this.http.post<{ subscriptionId: string }>(
      `${this.apiBase}/api/platform/plans/assign`,
      { tenantId, planId },
    );
  }
}
