import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BatchRetryResponse, CacheRefreshResponse, IssueDetails, IssueListResponse, PortalUser } from '../types/models';
import { PortalApiService } from './portal-api.service';

@Injectable({ providedIn: 'root' })
export class HttpPortalApiService extends PortalApiService {
  constructor(private readonly http: HttpClient) {
    super();
  }

  getHealth(): Promise<{ ok: true }> {
    return firstValueFrom(this.http.get<{ ok: true }>('/api/health'));
  }

  getMe(): Promise<{ ok: true; user: PortalUser }> {
    return firstValueFrom(this.http.get<{ ok: true; user: PortalUser }>('/api/me'));
  }

  listIssues(params: Record<string, string | number | boolean | undefined>): Promise<IssueListResponse> {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') {
        continue;
      }
      httpParams = httpParams.set(key, String(value));
    }
    return firstValueFrom(this.http.get<IssueListResponse>('/api/issues', { params: httpParams }));
  }

  getIssue(issueNumber: number): Promise<{ ok: true; issue: IssueDetails }> {
    return firstValueFrom(this.http.get<{ ok: true; issue: IssueDetails }>(`/api/issues/${issueNumber}`));
  }

  retryIssue(issueNumber: number, reason: string): Promise<{ ok: boolean; issueNumber: number; message: string; stageLabel?: string; strategy?: string }> {
    return firstValueFrom(this.http.post<{ ok: boolean; issueNumber: number; message: string; stageLabel?: string; strategy?: string }>(`/api/issues/${issueNumber}/retry`, { reason }));
  }

  retryBatch(issueNumbers: number[], reason: string): Promise<BatchRetryResponse> {
    return firstValueFrom(this.http.post<BatchRetryResponse>('/api/issues/retry-batch', { issueNumbers, reason }));
  }

  refreshCache(): Promise<CacheRefreshResponse> {
    return firstValueFrom(this.http.post<CacheRefreshResponse>('/api/cache/refresh', {}));
  }
}