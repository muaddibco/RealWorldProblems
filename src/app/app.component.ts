import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { PortalApiFacade } from './services/portal-api.facade';
import { PortalSettingsService } from './services/portal-settings.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <div class="page-shell">
      <header class="glass-panel app-shell-header">
        <div>
          <div class="eyebrow">Internal control plane</div>
          <a routerLink="/" class="app-title brand-link">RealWorldProblems Portal</a>
          <p class="muted">Track GitHub issue orchestration and safely reinvoke stuck processing.</p>
        </div>
        <div class="header-actions">
          <div class="mode-chip">
            <span class="tiny muted">Data mode</span>
            <button class="button mode-button" type="button" (click)="toggleMode()" [attr.title]="healthLabel()">
              <span class="health-dot" [class.ok]="lastHealthProbeOk() === true" [class.fail]="lastHealthProbeOk() === false" [attr.title]="healthLabel()" [attr.aria-label]="healthLabel()"></span>
              <span>{{ settings.mode() === 'live' ? 'Live API' : 'Mock data' }}</span>
            </button>
          </div>
          <a routerLink="/" class="button button-primary">Dashboard</a>
        </div>
      </header>

      <main class="app-body fade-in">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .app-shell-header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 24px 24px 20px;
      align-items: center;
      margin-bottom: 18px;
    }

    .brand-link {
      display: inline-block;
      font-size: 30px;
      line-height: 1;
      text-decoration: none;
      margin: 4px 0 10px;
    }

    .eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-size: 11px;
      color: var(--accent);
      margin-bottom: 6px;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .mode-chip {
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 10px 12px;
      border-radius: 16px;
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.03);
    }

    .mode-button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .health-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: rgba(180, 192, 214, 0.45);
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.22);
      flex: 0 0 auto;
    }

    .health-dot.ok {
      background: #6fe18c;
      box-shadow: 0 0 0 1px rgba(111, 225, 140, 0.4);
    }

    .health-dot.fail {
      background: #ff7f86;
      box-shadow: 0 0 0 1px rgba(255, 127, 134, 0.4);
    }

    .app-body {
      min-height: calc(100vh - 150px);
    }

    @media (max-width: 900px) {
      .app-shell-header {
        flex-direction: column;
        align-items: flex-start;
      }

      .header-actions {
        width: 100%;
        justify-content: space-between;
      }
    }
  `]
})
export class AppComponent {
  readonly settings = inject(PortalSettingsService);
  private readonly api = inject(PortalApiFacade);
  readonly lastHealthProbeOk = this.api.lastHealthProbeOk;

  constructor() {
    void this.api.probeHealth();
  }

  healthLabel(): string {
    const status = this.lastHealthProbeOk();
    if (status === true) {
      return 'API health check passed';
    }
    if (status === false) {
      return 'API health check failed';
    }
    return 'API health not checked yet';
  }

  async toggleMode(): Promise<void> {
    this.settings.toggleMode();
    await this.api.probeHealth();
  }
}