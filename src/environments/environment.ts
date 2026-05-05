/**
 * Development environment configuration. The production build picks
 * `environment.prod.ts` instead (via file replacements configured in `angular.json`
 * if those are added later).
 */
export const environment = {
  production: false,
  /** Root URL of the TravelCRM API. Consumed via the `API_BASE_URL` injection token. */
  apiUrl: 'http://localhost:5044',
} as const;
