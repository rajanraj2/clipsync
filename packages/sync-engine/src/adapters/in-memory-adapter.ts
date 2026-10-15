import { ClipboardAdapter, RawClipboardData } from '../types.js';

export class InMemoryClipboardAdapter implements ClipboardAdapter {
  public readonly platformName = 'in-memory';
  private currentData: RawClipboardData | null = null;
  private watcherCallback: ((data: RawClipboardData) => void) | null = null;
  private sequenceCounter = 0;

  public async read(): Promise<RawClipboardData | null> {
    return this.currentData ? { ...this.currentData } : null;
  }

  public async write(data: RawClipboardData): Promise<void> {
    this.sequenceCounter += 1;
    this.currentData = {
      ...data,
      sequenceNumber: this.sequenceCounter,
    };
    // Note: A real OS clipboard write triggers the OS pasteboard notification or polling loop
    if (this.watcherCallback) {
      this.watcherCallback(this.currentData);
    }
  }

  public startWatching(callback: (data: RawClipboardData) => void): void {
    this.watcherCallback = callback;
  }

  public stopWatching(): void {
    this.watcherCallback = null;
  }

  public isWatching(): boolean {
    return this.watcherCallback !== null;
  }

  /**
   * Helper for tests: simulates an external user action (e.g. Cmd+C in a text editor).
   */
  public simulateExternalCopy(data: Omit<RawClipboardData, 'sequenceNumber'>): void {
    this.sequenceCounter += 1;
    this.currentData = {
      ...data,
      sequenceNumber: this.sequenceCounter,
    };
    if (this.watcherCallback) {
      this.watcherCallback(this.currentData);
    }
  }

  public clear(): void {
    this.currentData = null;
  }
}
