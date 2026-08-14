import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  GardenCreateDto,
  GardenDetailDto,
  GardenInviteDto,
  GardenMemberPatchDto,
  GardenPatchDto,
  GardenSummaryDto,
  MemberDto,
  PageDto,
} from '@open-garden/shared-types';
import { GardenCacheService } from './garden-cache.service';

const API = '/api';

export class OnlineRequiredError extends Error {
  readonly code = 'ONLINE_REQUIRED';
  constructor() {
    super('You need to be online to make this change');
    this.name = 'OnlineRequiredError';
  }
}

@Injectable({ providedIn: 'root' })
export class GardensApiService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(GardenCacheService);

  async list(page = 1, pageSize = 20): Promise<PageDto<GardenSummaryDto>> {
    const key = this.cache.listKey({ page, pageSize });
    try {
      const params = new HttpParams().set('page', String(page)).set('pageSize', String(pageSize));
      const result = await firstValueFrom(
        this.http.get<PageDto<GardenSummaryDto>>(`${API}/gardens`, {
          params,
          withCredentials: true,
        }),
      );
      await this.cache.saveList(key, result);
      return result;
    } catch {
      return (
        (await this.cache.getList(key)) ?? { items: [], page, pageSize, totalCount: 0 }
      );
    }
  }

  async detail(id: string): Promise<GardenDetailDto | null> {
    try {
      const detail = await firstValueFrom(
        this.http.get<GardenDetailDto>(`${API}/gardens/${id}`, { withCredentials: true }),
      );
      await this.cache.saveDetail(detail);
      return detail;
    } catch (err) {
      if (isNotFound(err)) {
        await this.cache.deleteDetail(id);
        return null;
      }
      return this.cache.getDetail(id);
    }
  }

  async create(body: GardenCreateDto): Promise<GardenDetailDto> {
    this.assertOnline();
    try {
      const created = await firstValueFrom(
        this.http.post<GardenDetailDto>(`${API}/gardens`, body, { withCredentials: true }),
      );
      await this.cache.saveDetail(created);
      return created;
    } catch (err) {
      this.rethrowConnectivity(err);
    }
  }

  async patch(id: string, body: GardenPatchDto): Promise<GardenDetailDto> {
    this.assertOnline();
    try {
      const updated = await firstValueFrom(
        this.http.patch<GardenDetailDto>(`${API}/gardens/${id}`, body, {
          withCredentials: true,
        }),
      );
      await this.cache.saveDetail(updated);
      return updated;
    } catch (err) {
      this.rethrowConnectivity(err);
    }
  }

  async remove(id: string): Promise<void> {
    this.assertOnline();
    try {
      await firstValueFrom(
        this.http.delete(`${API}/gardens/${id}`, { withCredentials: true }),
      );
      await this.cache.deleteDetail(id);
    } catch (err) {
      this.rethrowConnectivity(err);
    }
  }

  async members(id: string): Promise<MemberDto[]> {
    const res = await firstValueFrom(
      this.http.get<{ members: MemberDto[] }>(`${API}/gardens/${id}/members`, {
        withCredentials: true,
      }),
    );
    return res.members;
  }

  async invite(id: string, body: GardenInviteDto): Promise<MemberDto> {
    this.assertOnline();
    try {
      return await firstValueFrom(
        this.http.post<MemberDto>(`${API}/gardens/${id}/members`, body, {
          withCredentials: true,
        }),
      );
    } catch (err) {
      this.rethrowConnectivity(err);
    }
  }

  async patchMember(id: string, userId: string, body: GardenMemberPatchDto): Promise<MemberDto> {
    this.assertOnline();
    try {
      return await firstValueFrom(
        this.http.patch<MemberDto>(`${API}/gardens/${id}/members/${userId}`, body, {
          withCredentials: true,
        }),
      );
    } catch (err) {
      this.rethrowConnectivity(err);
    }
  }

  async removeMember(id: string, userId: string): Promise<void> {
    this.assertOnline();
    try {
      await firstValueFrom(
        this.http.delete(`${API}/gardens/${id}/members/${userId}`, { withCredentials: true }),
      );
    } catch (err) {
      this.rethrowConnectivity(err);
    }
  }

  private assertOnline() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new OnlineRequiredError();
    }
  }

  private rethrowConnectivity(err: unknown): never {
    if (err instanceof OnlineRequiredError) throw err;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new OnlineRequiredError();
    }
    if (err instanceof HttpErrorResponse && (err.status === 0 || err.status >= 502)) {
      throw new OnlineRequiredError();
    }
    throw err;
  }
}

function isNotFound(err: unknown): boolean {
  return err instanceof HttpErrorResponse && err.status === 404;
}
