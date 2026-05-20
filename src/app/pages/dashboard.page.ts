import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PortalApiFacade } from '../services/portal-api.facade';
import { PortalSettingsService } from '../services/portal-settings.service';
import { BatchRetryResult, IssueCard } from '../types/models';

type DashboardStatusFilter = 'all' | 'active' | 'processing' | 'cooldown' | 'stuck' | 'blocked' | 'orchestration_failed' | 'archived' | 'completed' | 'selected' | 'invalid';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="grid-auto dashboard-grid">
      <div class="surface-panel dashboard-controls">
        <div class="controls-row">
          <div>
            <div class="section-title">Filters</div>
            <div class="muted tiny">Default view excludes terminal and needs-info issues.</div>
          </div>
          <div class="controls-actions">
            <div class="view-toggle">
              <button class="button" type="button" [class.button-primary]="viewMode() === 'default'" (click)="setViewMode('default')">Default non-terminal</button>
              <button class="button" type="button" [class.button-primary]="viewMode() === 'all'" (click)="setViewMode('all')">All</button>
            </div>
            <button class="button" type="button" (click)="reload()" [disabled]="loading()">Refresh</button>
            <button class="button button-primary" type="button" (click)="retrySelected()" [disabled]="!hasSelectedRetryable()">Retry selected</button>
            <button class="button button-primary" type="button" (click)="retryAllShown()" [disabled]="!hasShownRetryable()">Retry all shown</button>
          </div>
        </div>

        <div class="filters-grid">
          <label>
            <span>Status</span>
            <select class="select" [value]="statusFilter()" (change)="setStatusFilter(($any($event.target).value))">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="processing">Processing</option>
              <option value="cooldown">Cooldown</option>
              <option value="stuck">Stuck</option>
              <option value="orchestration_failed">Orchestration failed</option>
              <option value="blocked">Blocked</option>
              <option value="completed">Completed</option>
              <option value="selected">Selected</option>
              <option value="archived">Archived</option>
              <option value="invalid">Invalid</option>
            </select>
          </label>

          <label>
            <span>Stage</span>
            <select class="select" [value]="stageFilter()" (change)="setStageFilter(($any($event.target).value))">
              <option value="all">All stages</option>
              @for (stage of stageOptions; track stage.value) {
                <option [value]="stage.value">{{ stage.label }}</option>
              }
            </select>
          </label>

          <label>
            <span>Orchestration status</span>
            <select class="select" [value]="orchestrationFilter()" (change)="setOrchestrationFilter(($any($event.target).value))">
              <option value="all">All orchestration states</option>
              @for (option of orchestrationOptions; track option) {
                <option [value]="option">{{ option }}</option>
              }
            </select>
          </label>

          <label class="search-label">
            <span>Search</span>
            <input class="input" [value]="search()" (input)="setSearch(($any($event.target).value))" placeholder="Issue number, title, label, agent...">
          </label>
        </div>
      </div>

      <div class="surface-panel summary-grid">
        @for (card of summaryCards(); track card.label) {
          <div class="summary-card">
            <div class="summary-value">{{ card.value }}</div>
            <div class="summary-label">{{ card.label }}</div>
          </div>
        }
      </div>

      @if (error()) {
        <div class="surface-panel error-banner">{{ error() }}</div>
      }

      @if (batchResults().length > 0) {
        <div class="surface-panel batch-results">
          <div class="section-title">Latest batch retry results</div>
          <div class="batch-list">
            @for (result of batchResults(); track result.issueNumber) {
              <div class="batch-item" [class.ok]="result.ok" [class.fail]="!result.ok">
                <strong>#{{ result.issueNumber }}</strong>
                <span>{{ result.message }}</span>
              </div>
            }
          </div>
        </div>
      }

      <div class="surface-panel table-panel">
        <div class="table-header">
          <div>
            <div class="section-title">Issues</div>
            <div class="muted tiny">{{ filteredIssues().length }} shown of {{ issues().length }} loaded</div>
          </div>
          <div class="muted tiny">Mode: {{ settings.mode() === 'live' ? 'Live API' : 'Mock data' }}</div>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th><input type="checkbox" [checked]="allShownSelected()" (change)="toggleSelectAllShown($any($event.target).checked)"></th>
                <th>Issue</th>
                <th>Stage</th>
                <th>Agent</th>
                <th>Lifecycle Status</th>
                <th>Orchestration Status</th>
                <th>Status Reason</th>
                <th>Updated</th>
                <th>Age</th>
                <th>Labels Summary</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @if (loading()) {
                <tr>
                  <td colspan="11" class="table-state-cell">
                    <div class="table-loading">
                      <span class="table-spinner" aria-hidden="true"></span>
                      <span>Loading issues…</span>
                    </div>
                  </td>
                </tr>
              } @else if (filteredIssues().length === 0) {
                <tr>
                  <td colspan="11" class="table-state-cell muted">No issues match the current filters.</td>
                </tr>
              } @else {
                @for (issue of filteredIssues(); track issue.number) {
                  <tr [class.selected-row]="selectedIssueNumbers().has(issue.number)">
                    <td><input type="checkbox" [checked]="selectedIssueNumbers().has(issue.number)" (change)="toggleIssueSelection(issue.number, $any($event.target).checked)"></td>
                    <td>
                      <div class="issue-title">#{{ issue.number }} {{ issue.title }}</div>
                      <div class="muted tiny">{{ issue.state }}</div>
                    </td>
                    <td><span class="pill">{{ issue.stageName ?? 'No stage' }}</span></td>
                    <td>{{ issue.agentName ?? '—' }}</td>
                    <td><span class="pill status-{{ issue.lifecycleStatus }}">{{ issue.lifecycleStatus }}</span></td>
                    <td><span class="pill status-{{ issue.orchestrationStatus }}">{{ issue.orchestrationStatus }}</span></td>
                    <td>
                      <div class="reason-cell">
                        <span>{{ issue.lifecycleStatusReason }}</span>
                        @if (issue.retryBlockedReason) {
                          <span class="muted tiny">{{ issue.retryBlockedReason }}</span>
                        }
                      </div>
                    </td>
                    <td>{{ issue.updatedAt | date:'medium' }}</td>
                    <td>{{ issue.ageMinutes }}m</td>
                    <td>{{ labelsSummary(issue.labels) }}</td>
                    <td>
                      <div class="action-menu-container" (click)="$event.stopPropagation()">
                        <button class="button action-menu-trigger" type="button" [attr.aria-label]="'Actions for issue #' + issue.number" [attr.aria-expanded]="activeActionMenuIssueNumber() === issue.number" (click)="toggleActionMenu(issue.number)">...</button>
                        @if (activeActionMenuIssueNumber() === issue.number) {
                          <div class="action-menu">
                            <a class="button" [href]="issue.htmlUrl" target="_blank" rel="noreferrer" (click)="closeActionMenu()">Open</a>
                            <a class="button" [routerLink]="['/issues', issue.number]" (click)="closeActionMenu()">View details</a>
                            <button class="button button-primary" type="button" [disabled]="!issue.retryAllowed" (click)="closeActionMenu(); retryOne(issue.number)">Retry</button>
                          </div>
                        }
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .dashboard-grid {
      grid-template-columns: 1fr;
    }

    .dashboard-controls {
      padding: 18px;
    }

    .controls-row,
    .table-header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: center;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .controls-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .view-toggle {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 6px;
      border-radius: 14px;
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.03);
    }

    .filters-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
    }

    .filters-grid label {
      display: grid;
      gap: 6px;
      color: var(--muted-strong);
      font-size: 13px;
    }

    .summary-grid {
      padding: 16px;
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 12px;
    }

    .summary-card {
      padding: 16px;
      border-radius: 18px;
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.04);
    }

    .summary-value {
      font-size: 28px;
      font-weight: 700;
      line-height: 1;
      margin-bottom: 8px;
    }

    .summary-label {
      color: var(--muted);
      font-size: 13px;
    }

    .error-banner,
    .batch-results,
    .table-panel {
      padding: 18px;
    }

    .batch-list {
      display: grid;
      gap: 10px;
      margin-top: 12px;
    }

    .batch-item {
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid var(--border);
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .batch-item.ok {
      border-color: rgba(123, 227, 142, 0.35);
    }

    .batch-item.fail {
      border-color: rgba(255, 127, 134, 0.35);
    }

    .table-wrap {
      overflow: auto;
    }

    .table-state-cell {
      text-align: center;
      padding: 24px 12px;
    }

    .table-loading {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: var(--muted-strong);
      font-size: 14px;
      font-weight: 500;
    }

    .table-spinner {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.25);
      border-top-color: var(--accent);
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 1280px;
    }

    th, td {
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding: 14px 10px;
      vertical-align: top;
      text-align: left;
    }

    th {
      color: var(--muted-strong);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      position: sticky;
      top: 0;
      background: rgba(12, 23, 41, 0.96);
      z-index: 1;
    }

    .issue-title {
      font-weight: 600;
    }

    .reason-cell {
      display: grid;
      gap: 6px;
      max-width: 420px;
    }

    .action-menu-container {
      position: relative;
      display: inline-block;
    }

    .action-menu-trigger {
      min-width: 40px;
      padding-left: 10px;
      padding-right: 10px;
      letter-spacing: 1px;
    }

    .action-menu {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      min-width: 150px;
      padding: 8px;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: rgba(8, 16, 28, 0.98);
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
      display: grid;
      gap: 8px;
      z-index: 12;
    }

    .selected-row {
      background: rgba(97, 214, 199, 0.06);
    }

    @media (max-width: 1280px) {
      .filters-grid,
      .summary-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 760px) {
      .filters-grid,
      .summary-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class DashboardPageComponent implements OnDestroy {
  private readonly api = inject(PortalApiFacade);
  readonly settings = inject(PortalSettingsService);
  private lastLoadErrorPopupMessage: string | null = null;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly issues = signal<IssueCard[]>([]);
  readonly batchResults = signal<BatchRetryResult[]>([]);
  readonly activeActionMenuIssueNumber = signal<number | null>(null);
  readonly selectedIssueNumbers = signal<Set<number>>(new Set());
  readonly viewMode = signal<'default' | 'all'>('default');
  readonly statusFilter = signal<DashboardStatusFilter>('all');
  readonly stageFilter = signal<string>('all');
  readonly orchestrationFilter = signal<string>('all');
  readonly search = signal('');

  private readonly reloadDebounceMs = 350;
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;

  readonly orchestrationOptions = ['not_started', 'queued', 'running', 'continued_as_new', 'completed', 'failed', 'cancelled', 'terminated', 'cooldown_active', 'blocked_or_noop', 'no_eligible_stage', 'not_claimed', 'stale', 'unknown'];
  readonly stageOptions = [
    { value: 'stage/0-intake', label: 'stage/0-intake · Intake' },
    { value: 'stage/1-normalized', label: 'stage/1-normalized · Normalized' },
    { value: 'stage/2-deduped', label: 'stage/2-deduped · Deduped' },
    { value: 'stage/3-scored', label: 'stage/3-scored · Ready for Scoring' },
    { value: 'stage/4-solution', label: 'stage/4-solution · Ready for Solution Hypothesis' },
    { value: 'stage/ai-defensibility', label: 'stage/ai-defensibility · AI Defensibility' },
    { value: 'stage/5-competitors', label: 'stage/5-competitors · Ready for Competitor Scan' },
    { value: 'stage/6-shortlist', label: 'stage/6-shortlist · Shortlist' },
    { value: 'stage/7-validation', label: 'stage/7-validation · Validation' },
    { value: 'stage/7.1-validated', label: 'stage/7.1-validated · Validated' },
    { value: 'stage/8-selected', label: 'stage/8-selected · Selected' },
    { value: 'stage/9-archived', label: 'stage/9-archived · Archived' }
  ];

  readonly filteredIssues = computed(() => {
    const status = this.statusFilter();
    const stage = this.stageFilter();
    const orchestration = this.orchestrationFilter();
    const search = this.search().trim().toLowerCase();

    return this.issues().filter((issue) => {
      if (status !== 'all') {
        if (status === 'stuck' && !issue.isStuck) {
          return false;
        }
        if (status !== 'stuck' && issue.lifecycleStatus !== status) {
          return false;
        }
      }
      if (stage !== 'all' && issue.stageLabel !== stage) {
        return false;
      }
      if (orchestration !== 'all' && issue.orchestrationStatus !== orchestration) {
        return false;
      }
      if (search) {
        const haystack = [issue.number, issue.title, issue.stageLabel, issue.stageName, issue.agentName, issue.lifecycleStatus, issue.orchestrationStatus, issue.labels.join(' ')].join(' ').toLowerCase();
        if (!haystack.includes(search)) {
          return false;
        }
      }
      return true;
    });
  });

  readonly summaryCards = computed(() => {
    const issues = this.filteredIssues();
    return [
      { label: 'Total issues in current result set', value: issues.length },
      { label: 'Active', value: issues.filter((issue) => issue.lifecycleStatus === 'active').length },
      { label: 'Processing', value: issues.filter((issue) => issue.isProcessing).length },
      { label: 'Cooldown', value: issues.filter((issue) => issue.lifecycleStatus === 'cooldown').length },
      { label: 'Stuck', value: issues.filter((issue) => issue.isStuck).length },
      { label: 'Orchestration failed', value: issues.filter((issue) => issue.lifecycleStatus === 'orchestration_failed').length },
      { label: 'Blocked', value: issues.filter((issue) => issue.lifecycleStatus === 'blocked').length },
      { label: 'Completed', value: issues.filter((issue) => issue.lifecycleStatus === 'completed').length },
      { label: 'Selected', value: issues.filter((issue) => issue.lifecycleStatus === 'selected').length },
      { label: 'Archived', value: issues.filter((issue) => issue.lifecycleStatus === 'archived').length },
      { label: 'Invalid', value: issues.filter((issue) => issue.lifecycleStatus === 'invalid').length }
    ];
  });

  readonly allShownSelected = computed(() => {
    const shown = this.filteredIssues();
    return shown.length > 0 && shown.every((issue) => this.selectedIssueNumbers().has(issue.number));
  });

  constructor() {
    void this.reload();
  }

  ngOnDestroy(): void {
    if (this.reloadTimer !== null) {
      clearTimeout(this.reloadTimer);
      this.reloadTimer = null;
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeActionMenu();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeActionMenu();
  }

  toggleActionMenu(issueNumber: number): void {
    this.activeActionMenuIssueNumber.set(this.activeActionMenuIssueNumber() === issueNumber ? null : issueNumber);
  }

  closeActionMenu(): void {
    if (this.activeActionMenuIssueNumber() !== null) {
      this.activeActionMenuIssueNumber.set(null);
    }
  }

  private scheduleReload(): void {
    if (this.reloadTimer !== null) {
      clearTimeout(this.reloadTimer);
    }

    this.reloadTimer = setTimeout(() => {
      this.reloadTimer = null;
      void this.reload();
    }, this.reloadDebounceMs);
  }

  async reload(): Promise<void> {
    if (this.reloadTimer !== null) {
      clearTimeout(this.reloadTimer);
      this.reloadTimer = null;
    }

    this.loading.set(true);
    this.error.set(null);
    try {
      await this.api.getHealth();
      const response = await this.api.listIssues({
        defaultView: this.viewMode() === 'default',
        status: this.statusFilter(),
        orchestrationStatus: this.orchestrationFilter(),
        stage: this.stageFilter(),
        q: this.search(),
        limit: 250
      });
      this.issues.set(response.issues);
      this.selectedIssueNumbers.set(new Set());
      this.lastLoadErrorPopupMessage = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load issues';
      this.error.set(message);
      if (this.lastLoadErrorPopupMessage !== message) {
        this.lastLoadErrorPopupMessage = message;
        window.alert(message);
      }
    } finally {
      this.loading.set(false);
    }
  }

  setStatusFilter(value: string): void {
    this.statusFilter.set(value as DashboardStatusFilter);
    this.scheduleReload();
  }

  setViewMode(value: 'default' | 'all'): void {
    this.viewMode.set(value);
    this.scheduleReload();
  }

  setStageFilter(value: string): void {
    this.stageFilter.set(value);
    this.scheduleReload();
  }

  setOrchestrationFilter(value: string): void {
    this.orchestrationFilter.set(value);
    this.scheduleReload();
  }

  setSearch(value: string): void {
    this.search.set(value);
    this.scheduleReload();
  }

  toggleIssueSelection(issueNumber: number, checked: boolean): void {
    const next = new Set(this.selectedIssueNumbers());
    if (checked) {
      next.add(issueNumber);
    } else {
      next.delete(issueNumber);
    }
    this.selectedIssueNumbers.set(next);
  }

  toggleSelectAllShown(checked: boolean): void {
    const next = new Set(this.selectedIssueNumbers());
    for (const issue of this.filteredIssues()) {
      if (checked) {
        next.add(issue.number);
      } else {
        next.delete(issue.number);
      }
    }
    this.selectedIssueNumbers.set(next);
  }

  hasSelectedRetryable(): boolean {
    return this.filteredIssues().some((issue) => this.selectedIssueNumbers().has(issue.number) && issue.retryAllowed);
  }

  hasShownRetryable(): boolean {
    return this.filteredIssues().some((issue) => issue.retryAllowed);
  }

  async retryOne(issueNumber: number): Promise<void> {
    const issue = this.filteredIssues().find((item) => item.number === issueNumber);
    if (!issue || !issue.retryAllowed) {
      return;
    }

    const confirmed = window.confirm(`You are about to re-trigger processing for issue #${issue.number}.\n\nThe backend will either remove status/orchestration-failed or remove and re-add the current stage label, depending on the issue state.\n\nThe portal will not directly dispatch the stage workflow. rw-orchestrator will handle workflow dispatch.`);
    if (!confirmed) {
      return;
    }

    const result = await this.api.retryIssue(issue.number, 'manual retry from portal');
    this.batchResults.set([result.ok ? { issueNumber: result.issueNumber, ok: true, stageLabel: result.stageLabel, strategy: result.strategy as any, message: result.message } : { issueNumber: result.issueNumber, ok: false, message: result.message, retriedTooRecently: result.retriedTooRecently }]);
    await this.reload();
  }

  async retrySelected(): Promise<void> {
    const issueNumbers = this.filteredIssues().filter((issue) => this.selectedIssueNumbers().has(issue.number) && issue.retryAllowed).map((issue) => issue.number);
    if (issueNumbers.length === 0) {
      return;
    }
    const confirmed = window.confirm(`You are about to request retry for ${issueNumbers.length} issues.\n\nEach issue will be re-read and validated by the backend. Terminal, blocked, invalid, actively processing, or recently retried issues will be skipped.`);
    if (!confirmed) {
      return;
    }
    const result = await this.api.retryBatch(issueNumbers, 'manual bulk retry from portal');
    this.batchResults.set(result.results);
    await this.reload();
  }

  async retryAllShown(): Promise<void> {
    const issueNumbers = this.filteredIssues().filter((issue) => issue.retryAllowed).map((issue) => issue.number);
    if (issueNumbers.length === 0) {
      return;
    }
    const confirmed = window.confirm(`You are about to request retry for ${issueNumbers.length} issues.\n\nEach issue will be re-read and validated by the backend. Terminal, blocked, invalid, actively processing, or recently retried issues will be skipped.`);
    if (!confirmed) {
      return;
    }
    const result = await this.api.retryBatch(issueNumbers, 'manual bulk retry from portal');
    this.batchResults.set(result.results);
    await this.reload();
  }

  labelsSummary(labels: string[]): string {
    const filtered = labels.filter((label) => !label.startsWith('rw/')).slice(0, 5);
    return filtered.join(', ');
  }
}