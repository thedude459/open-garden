import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

const API = '/api';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private user: { id: string; email: string; role: string } | null = null;

  get currentUser() {
    return this.user;
  }

  async login(email: string, password: string) {
    const res = await firstValueFrom(
      this.http.post<{ user: { id: string; email: string; role: string } }>(
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
      this.http.post<{ user: { id: string; email: string; role: string } }>(
        `${API}/auth/register`,
        { email, password, displayName },
        { withCredentials: true },
      ),
    );
    this.persistUser(res.user);
    return res.user;
  }

  async logout() {
    await firstValueFrom(
      this.http.post(`${API}/auth/logout`, {}, { withCredentials: true }),
    ).catch(() => undefined);
    this.user = null;
    sessionStorage.removeItem('og_user_id');
    sessionStorage.removeItem('og_role');
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

  private persistUser(user: { id: string; email: string; role: string }) {
    this.user = user;
    sessionStorage.setItem('og_user_id', user.id);
    sessionStorage.setItem('og_role', user.role);
  }
}
