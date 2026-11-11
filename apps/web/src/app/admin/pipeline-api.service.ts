import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  PipelineRunDetailDto,
  PipelineRunListDto,
  PipelineRunSourceDto,
  PipelineRunSummaryDto,
} from '@open-garden/shared-types';

const API = '/api';

@Injectable({ providedIn: 'root' })
export class PipelineApiService {
  private readonly http = inject(HttpClient);

  start() {
    return firstValueFrom(
      this.http.post<PipelineRunSummaryDto & { sources: PipelineRunSourceDto[] }>(
        `${API}/admin/pipeline/runs`,
        {},
        { withCredentials: true },
      ),
    );
  }

  list(page = 1, pageSize = 20) {
    const params = new HttpParams().set('page', String(page)).set('pageSize', String(pageSize));
    return firstValueFrom(
      this.http.get<PipelineRunListDto>(`${API}/admin/pipeline/runs`, {
        params,
        withCredentials: true,
      }),
    );
  }

  get(id: string) {
    return firstValueFrom(
      this.http.get<PipelineRunDetailDto>(`${API}/admin/pipeline/runs/${id}`, {
        withCredentials: true,
      }),
    );
  }
}
