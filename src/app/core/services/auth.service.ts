import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { LocaleService } from './locale.service';
import { API_BASE_URL } from '../tokens/api-base-url.token';

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface LoginRequest  { email: string; password: string; }

export interface LoginResponse {
  accessToken:    string;
  refreshToken:   string;
  expiresAt:      string;
  userId:         string;
  email:          string;
  fullName:       string;
  roles:          string[];
  tenantId:       string;
  tenantSlug:     string;
  isPlatformAdmin: boolean;
  preferredLanguage?: string;
  timeZone?:       string;
  currencyCode?:   string;
}

export interface JwtPayload {
  sub:               string;
  email:             string;
  given_name:        string;
  family_name:       string;
  tenant_id:         string;
  tenant_slug:       string;
  is_platform_admin: string;   // "true" | "false"
  exp:               number;
  [key: string]: unknown;
}

// ── Storage keys ──────────────────────────────────────────────────────────────

const TOKEN_KEY         = 'crm_token';
const REFRESH_TOKEN_KEY = 'crm_refresh_token';
const USER_KEY          = 'crm_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http   = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly locale = inject(LocaleService);
  private readonly api    = `${inject(API_BASE_URL)}/api`;

  // Reactive signal — updated on login / logout
  private _user = signal<LoginResponse | null>(this.loadUser());

  // Cache the decoded JWT payload so we don't base64-decode + JSON.parse on
  // every `getPayload()` call (hasPermission / guards can fire many times
  // per render). Keyed by the raw token so we recompute transparently on refresh.
  private _cachedToken: string | null = null;
  private _cachedPayload: JwtPayload | null = null;

  readonly currentUser   = this._user.asReadonly();
  readonly isLoggedIn    = computed(() => !!this._user());
  readonly isPlatformAdmin = computed(() => this._user()?.isPlatformAdmin === true);

  // ── Public API ─────────────────────────────────────────────────────────────

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.api}/auth/login`, { email, password })
      .pipe(
        tap(res => this.persist(res))
      );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._user.set(null);
    this.router.navigate(['/authentication/login']);
  }

  getAccessToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  /** Decoded JWT payload — null if no token or token is malformed. Cached per token. */
  getPayload(): JwtPayload | null {
    const token = this.getAccessToken();
    if (!token) {
      this._cachedToken = null;
      this._cachedPayload = null;
      return null;
    }
    if (token === this._cachedToken) return this._cachedPayload;
    try {
      this._cachedPayload = JSON.parse(atob(token.split('.')[1])) as JwtPayload;
      this._cachedToken = token;
      return this._cachedPayload;
    } catch {
      this._cachedToken = null;
      this._cachedPayload = null;
      return null;
    }
  }

  /** True if a token exists and has NOT expired yet. */
  isTokenValid(): boolean {
    const payload = this.getPayload();
    if (!payload) return false;
    return payload.exp * 1000 > Date.now();
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private persist(res: LoginResponse): void {
    localStorage.setItem(TOKEN_KEY,         res.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, res.refreshToken);
    localStorage.setItem(USER_KEY,          JSON.stringify(res));
    this._user.set(res);
    this.locale.initFromLoginResponse(res);
  }

  private loadUser(): LoginResponse | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as LoginResponse) : null;
    } catch {
      return null;
    }
  }
}
