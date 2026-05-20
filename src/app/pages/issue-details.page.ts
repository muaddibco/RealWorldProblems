import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PortalApiFacade } from '../services/portal-api.facade';
import { IssueDetails } from '../types/models';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="surface-panel details-page">
      @if (loading()) {
        <div class="muted">Loading issue details…</div>
      } @else if (error()) {
        <div class="error-text">{{ error() }}</div>
      } @else if (issue()) {
        <div class="details-header">
          <div>
            <div class="section-title">Issue #{{ issue()!.number }}</div>
            <h1 class="details-title">{{ issue()!.title }}</h1>
            <div class="muted">{{ issue()!.htmlUrl }}</div>
          </div>
          <div class="details-actions">
            <a class="button" routerLink="/">Back to dashboard</a>
            <a class="button" [href]="issue()!.htmlUrl" target="_blank" rel="noreferrer">Open in GitHub</a>
            <button class="button button-primary" type="button" (click)="retry()">Retry issue</button>
          </div>
        </div>

        <div class="details-grid">
          <div class="details-card">
            <div class="pill-row">
              <span class="pill status-{{ issue()!.lifecycleStatus }}">{{ issue()!.lifecycleStatus }}</span>
              <span class="pill status-{{ issue()!.orchestrationStatus }}">{{ issue()!.orchestrationStatus }}</span>
            </div>
            <p><strong>Lifecycle:</strong> {{ issue()!.lifecycleStatusReason }}</p>
            <p><strong>Orchestration:</strong> {{ issue()!.orchestrationStatusReason }}</p>
            <p><strong>Durable instance:</strong> {{ issue()!.orchestrationInstanceId }}</p>
            <p><strong>Runtime status:</strong> {{ issue()!.durableRuntimeStatus ?? 'unknown' }}</p>
            <p><strong>Output status:</strong> {{ issue()!.orchestratorOutputStatus ?? 'unknown' }}</p>
            <p><strong>Updated:</strong> {{ issue()!.updatedAt | date:'medium' }}</p>
            <p><strong>Age:</strong> {{ issue()!.ageMinutes }} minutes</p>
          </div>

          <div class="details-card">
            <div class="section-title">Labels</div>
            <div class="pill-cloud">
              @for (label of issue()!.labels; track label) {
                <span class="pill">{{ label }}</span>
              }
            </div>
          </div>

          <div class="details-card">
            <div class="section-title">Body preview</div>
            <pre class="body-preview">{{ issue()!.body ?? 'No body' }}</pre>
          </div>

          <div class="details-card">
            <div class="section-title">Recent comments</div>
            <div class="comment-list">
              @for (comment of issue()!.recentComments; track comment.createdAt) {
                <div class="comment-item">
                  <div class="muted tiny">{{ comment.author }} · {{ comment.createdAt | date:'medium' }}</div>
                  <div>{{ comment.body }}</div>
                </div>
              }
            </div>
          </div>
        </div>
      }
    </section>
  `,
  styles: [`
    .details-page {
      padding: 20px;
    }

    .details-header {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: flex-start;
      margin-bottom: 18px;
      flex-wrap: wrap;
    }

    .details-title {
      margin: 10px 0 6px;
      font-size: 34px;
      line-height: 1.05;
      font-family: 'Space Grotesk', sans-serif;
    }

    .details-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .details-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }

    .details-card {
      padding: 16px;
      border-radius: 18px;
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.04);
    }

    .pill-row,
    .pill-cloud {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .body-preview {
      margin: 0;
      white-space: pre-wrap;
      color: var(--muted-strong);
      font-family: inherit;
    }

    .comment-list {
      display: grid;
      gap: 10px;
    }

    .comment-item {
      padding: 12px;
      border-radius: 14px;
      border: 1px solid var(--border);
      background: rgba(0, 0, 0, 0.12);
    }

    .error-text {
      color: var(--danger);
    }

    @media (max-width: 900px) {
      .details-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class IssueDetailsPageComponent {
  private readonly api = inject(PortalApiFacade);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly issue = signal<IssueDetails | null>(null);

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const issueNumber = Number(this.route.snapshot.paramMap.get('number'));
      const response = await this.api.getIssue(issueNumber);
      this.issue.set(response.issue);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Failed to load issue');
    } finally {
      this.loading.set(false);
    }
  }

  async retry(): Promise<void> {
    const current = this.issue();
    if (!current) {
      return;
    }

    const confirmed = window.confirm(`You are about to re-trigger processing for issue #${current.number}.\n\nIf an orchestration is queued or running, the backend will terminate it first. If lifecycle is processing, rw/processing will be removed before retry.\n\nThe backend will then either remove status/orchestration-failed or remove and re-add the current stage label, depending on the issue state.\n\nThe portal will not directly dispatch the stage workflow. rw-orchestrator will handle workflow dispatch.`);
    if (!confirmed) {
      return;
    }

    const result = await this.api.retryIssue(current.number, 'manual retry from portal');
    if (!result.ok) {
      window.alert(result.message);
      return;
    }

    await this.load();
  }
}