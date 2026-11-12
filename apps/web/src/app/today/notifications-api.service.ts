import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { NotificationSettingsDto, PushSubscriptionDto } from '@open-garden/shared-types';
import { firstValueFrom } from 'rxjs';

const API = '/api/notifications';

/** The signed-in member's reminder settings. */
@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  private readonly http = inject(HttpClient);

  settings(): Promise<NotificationSettingsDto> {
    return firstValueFrom(this.http.get<NotificationSettingsDto>(API, { withCredentials: true }));
  }

  subscribe(subscription: PushSubscriptionDto): Promise<void> {
    return firstValueFrom(
      this.http.put<void>(`${API}/push`, subscription, { withCredentials: true }),
    );
  }

  unsubscribe(endpoint: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${API}/push`, { body: { endpoint }, withCredentials: true }),
    );
  }

  setEmailDigest(enabled: boolean): Promise<void> {
    return firstValueFrom(
      this.http.put<void>(`${API}/email`, { enabled }, { withCredentials: true }),
    );
  }
}
