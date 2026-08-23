import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthApiService } from '../auth/auth-api.service';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthApiService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);
  if (!auth.isAdmin()) return router.createUrlTree(['/plants']);
  return true;
};
