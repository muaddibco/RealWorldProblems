import { Injectable, signal } from '@angular/core';

export type PortalDataMode = 'mock' | 'live';

const STORAGE_KEY = 'rw-portal-data-mode';

@Injectable({ providedIn: 'root' })
export class PortalSettingsService {
  readonly mode = signal<PortalDataMode>(this.readMode());

  setMode(mode: PortalDataMode): void {
    this.mode.set(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }

  toggleMode(): void {
    this.setMode(this.mode() === 'mock' ? 'live' : 'mock');
  }

  private readMode(): PortalDataMode {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'live' ? 'live' : 'mock';
  }
}