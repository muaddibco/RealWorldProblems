import { inject, Injectable, signal } from '@angular/core';
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

  readonly lastHealthProbeOk = signal<boolean | null>(null);

  private get activeApi(): PortalApiService {
    return this.settings.mode() === 'live' ? this.httpApi : this.mockApi;
  }

  async getHealth(): Promise<{ ok: true }> {
    try {
      const response = await this.activeApi.getHealth();
      this.lastHealthProbeOk.set(true);
      return response;
    } catch (error) {
      this.lastHealthProbeOk.set(false);
      throw error;
    }
  }

  async probeHealth(): Promise<void> {
    try {
      await this.getHealth();
    } catch {
      // Only the last probe status is needed by the UI indicator.
    }
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

  retryIssue(issueNumber: number, reason: string): Promise<{ ok: boolean; issueNumber: number; message: string; stageLabel?: string; strategy?: string }> {
    return this.activeApi.retryIssue(issueNumber, reason);
  }

  retryBatch(issueNumbers: number[], reason: string): Promise<BatchRetryResponse> {
    return this.activeApi.retryBatch(issueNumbers, reason);
  }
}