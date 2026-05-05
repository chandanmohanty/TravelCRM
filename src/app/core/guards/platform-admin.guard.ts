import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/** Parses the JWT stored in localStorage and checks is_platform_admin claim. */
function parsePlatformAdminClaim(): boolean {
  try {
    const token = localStorage.getItem('crm_token');
    if (!token) return false;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload['is_platform_admin'] === 'true' || payload['is_platform_admin'] === true;
  } catch {
    return false;
  }
}

export const platformAdminGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (parsePlatformAdminClaim()) return true;
  router.navigate(['/authentication/login']);
  return false;
};
