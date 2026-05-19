import { Injectable } from '@angular/core';
import { BatchRetryResponse, IssueCard, IssueDetails, IssueListResponse, PortalUser } from '../types/models';

@Injectable({ providedIn: 'root' })
export abstract class PortalApiService {
  abstract getHealth(): Promise<{ ok: true }>;
  abstract getMe(): Promise<{ ok: true; user: PortalUser }>;
  abstract listIssues(params: Record<string, string | number | boolean | undefined>): Promise<IssueListResponse>;
  abstract getIssue(issueNumber: number): Promise<{ ok: true; issue: IssueDetails }>;
  abstract retryIssue(issueNumber: number, reason: string): Promise<{ ok: boolean; issueNumber: number; message: string; stageLabel?: string; strategy?: string; retriedTooRecently?: boolean }>;
  abstract retryBatch(issueNumbers: number[], reason: string): Promise<BatchRetryResponse>;
}