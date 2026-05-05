import { InjectionToken } from '@angular/core';

/**
 * Injection token for the TravelCRM API base URL.
 *
 * Provided in `app.config.ts` from `environment.apiUrl`. Consumers should use
 * `inject(API_BASE_URL)` instead of hardcoding `http://localhost:5044` in each
 * service. This allows production builds to point at a different backend
 * (same-origin, proxied, or a separate host) without code changes.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');
