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
  /** How the signed-in member sees lengths; saved on their account. */
  readonly units = signal<Units>(storedUnits());

  get currentUser() {
    return this.user;
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
