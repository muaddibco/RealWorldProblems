import { inject, Injectable } from '@angular/core';
import { BatchRetryResponse, IssueDetails, IssueListResponse, PortalUser } from '../types/models';
import { HttpPortalApiService } from './http-portal-api.service';
import { MockPortalApiService } from './mock-portal-api.service';
import { PortalApiService } from './portal-api.service';
import { PortalSettingsService } from './portal-settings.service';

@Injectable({ providedIn: 'root' })
export class PortalApiFacade {
  private readonly settings = inject(PortalSettingsService);
  private readonly httpApi = inject(HttpPortalApiService);
  private readonly mockApi = inject(MockPortalApiService);

  private get activeApi(): PortalApiService {
    return this.settings.mode() === 'live' ? this.httpApi : this.mockApi;
  }

  getHealth(): Promise<{ ok: true }> {
    return this.activeApi.getHealth();
  }

  getMe(): Promise<{ ok: true; user: PortalUser }> {
    return this.activeApi.getMe();
  }

  listIssues(params: Record<string, string | number | boolean | undefined>): Promise<IssueListResponse> {
    return this.activeApi.listIssues(params);
  }

  getIssue(issueNumber: number): Promise<{ ok: true; issue: IssueDetails }> {
    return this.activeApi.getIssue(issueNumber);
  }

  retryIssue(issueNumber: number, reason: string): Promise<{ ok: boolean; issueNumber: number; message: string; stageLabel?: string; strategy?: string; retriedTooRecently?: boolean }> {
    return this.activeApi.retryIssue(issueNumber, reason);
  }

  retryBatch(issueNumbers: number[], reason: string): Promise<BatchRetryResponse> {
    return this.activeApi.retryBatch(issueNumbers, reason);
  }
}