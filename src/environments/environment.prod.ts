/**
 * Production environment configuration. `apiUrl` is empty so requests go to the
 * same origin as the SPA (common setup with a reverse proxy forwarding `/api/*`
 * to the backend).
 */
export const environment = {
  production: true,
  /** Empty means "same-origin". */
  apiUrl: '',
} as const;
