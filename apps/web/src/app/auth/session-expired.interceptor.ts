import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthApiService } from './auth-api.service';
import { endsSession, safeReturnUrl } from './session-expiry';

/**
 * A session that ended on the server (expired, signed out elsewhere) answers
 * every API call with 401. Without this, pages showed empty states such as
 * "No properties yet". Forget the local sign-in and send the person to sign
 * in, then back to the page they were on. Only the first 401 redirects: after
 * it the app no longer thinks anyone is signed in. A 401 answering a request
 * sent before the latest sign-in is about the old session and is ignored.
 */
export const sessionExpiredInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthApiService);
  const router = inject(Router);
  const sentDuring = auth.signInCount;
  return next(req).pipe(
    catchError((err: unknown) => {
      if (
        err instanceof HttpErrorResponse &&
        err.status === 401 &&
        endsSession(req.url) &&
        auth.isAuthenticated() &&
        auth.signInCount === sentDuring
      ) {
        auth.forget();
        const back = safeReturnUrl(router.url);
        void router.navigate(['/login'], {
          queryParams: { expired: 1, ...(back === '/today' ? {} : { returnUrl: back }) },
        });
      }
      return throwError(() => err);
    }),
  );
};
