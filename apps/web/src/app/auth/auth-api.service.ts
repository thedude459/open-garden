import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { Units } from '@open-garden/shared-types';

const API = '/api';

type SignedInUser = { id: string; email: string; role: string; units?: Units };

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private user: SignedInUser | null = null;
  /** Counts sign-ins, so a reply to a request sent before one can be told apart. */
  private signIns = 0;
  /** How the signed-in member sees lengths; saved on their account. */
  readonly units = signal<Units>(storedUnits());

  get currentUser() {
    return this.user;
  }

  get signInCount() {
    return this.signIns;
  }

  async login(email: string, password: string) {
    const res = await firstValueFrom(
      this.http.post<{ user: SignedInUser }>(
        `${API}/auth/login`,
        { email, password },
        { withCredentials: true },
      ),
    );
    this.persistUser(res.user);
    return res.user;
  }

  async register(email: string, password: string, displayName?: string) {
    const res = await firstValueFrom(
      this.http.post<{ user: SignedInUser }>(
        `${API}/auth/register`,
        { email, password, displayName },
        { withCredentials: true },
      ),
    );
    this.persistUser(res.user);
    return res.user;
  }

  async logout() {
    await firstValueFrom(this.http.post(`${API}/auth/logout`, {}, { withCredentials: true })).catch(
      () => undefined,
    );
    this.forget();
  }

  /** Forget the signed-in member in this browser, as when the server ended the session. */
  forget() {
    this.user = null;
    sessionStorage.removeItem('og_user_id');
    sessionStorage.removeItem('og_role');
    sessionStorage.removeItem('og_authed');
    sessionStorage.removeItem('og_units');
    this.units.set('imperial');
  }

  async setUnits(units: Units) {
    await firstValueFrom(
      this.http.put(`${API}/account/units`, { units }, { withCredentials: true }),
    );
    this.units.set(units);
    sessionStorage.setItem('og_units', units);
  }

  /** Change the password; the server signs out every other session. */
  async changePassword(currentPassword: string, newPassword: string) {
    await firstValueFrom(
      this.http.put(
        `${API}/account/password`,
        { currentPassword, newPassword },
        { withCredentials: true },
      ),
    );
  }

  /** Delete the account after the password check; this browser forgets it. */
  async deleteAccount(password: string) {
    await firstValueFrom(
      this.http.delete(`${API}/account`, { body: { password }, withCredentials: true }),
    );
    this.forget();
  }

  /** Whether this server can email a password reset link. */
  async resetByEmail(): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ byEmail: boolean }>(`${API}/auth/password-reset`),
      );
      return res.byEmail;
    } catch {
      return false;
    }
  }

  async requestPasswordReset(email: string) {
    await firstValueFrom(this.http.post(`${API}/auth/password-reset`, { email }));
  }

  async resetPassword(token: string, password: string) {
    await firstValueFrom(this.http.post(`${API}/auth/password-reset/confirm`, { token, password }));
  }

  currentUserId(): string | null {
    return this.user?.id ?? sessionStorage.getItem('og_user_id');
  }

  isAuthenticated(): boolean {
    return this.user !== null || Boolean(sessionStorage.getItem('og_authed'));
  }

  isAdmin(): boolean {
    const role = this.user?.role ?? sessionStorage.getItem('og_role');
    return role === 'admin';
  }

  markAuthenticated() {
    sessionStorage.setItem('og_authed', '1');
  }

  private persistUser(user: SignedInUser) {
    this.signIns += 1;
    this.user = user;
    sessionStorage.setItem('og_user_id', user.id);
    sessionStorage.setItem('og_role', user.role);
    sessionStorage.setItem('og_authed', '1');
    const units = user.units === 'metric' ? 'metric' : 'imperial';
    sessionStorage.setItem('og_units', units);
    this.units.set(units);
  }
}

function storedUnits(): Units {
  try {
    return sessionStorage.getItem('og_units') === 'metric' ? 'metric' : 'imperial';
  } catch {
    return 'imperial';
  }
}
