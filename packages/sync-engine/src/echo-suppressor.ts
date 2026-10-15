export class EchoSuppressor {
  private readonly recentWrites = new Map<string, number>();
  private lastSentHash: string | null = null;

  constructor(private readonly windowMs: number = 3000) {}

  /**
   * Records a hash that was programmatically written to the local OS clipboard.
   * Subsequent change events matching this hash within the window will be suppressed.
   */
  public recordLocalWrite(hash: string, timestamp: number = Date.now()): void {
    this.cleanup(timestamp);
    this.recentWrites.set(hash, timestamp);
  }

  /**
   * Checks whether a clipboard event hash is an echo from a local sync write.
   * If an echo is detected, the entry is consumed and returns true.
   */
  public isEchoAndConsume(hash: string, currentTime: number = Date.now()): boolean {
    this.cleanup(currentTime);
    const writeTime = this.recentWrites.get(hash);

    if (writeTime !== undefined) {
      const elapsed = currentTime - writeTime;
      if (elapsed >= 0 && elapsed <= this.windowMs) {
        this.recentWrites.delete(hash);
        return true;
      }
    }

    return false;
  }

  /**
   * Checks whether this content is identical to the last sent item to prevent duplicates.
   */
  public isDuplicateOfLastSent(hash: string): boolean {
    return this.lastSentHash === hash;
  }

  /**
   * Records the hash of a successfully transmitted item.
   */
  public recordSent(hash: string): void {
    this.lastSentHash = hash;
  }

  /**
   * Cleans up expired write timestamps to prevent unbounded memory growth.
   */
  private cleanup(currentTime: number): void {
    for (const [hash, writeTime] of this.recentWrites.entries()) {
      if (currentTime - writeTime > this.windowMs) {
        this.recentWrites.delete(hash);
      }
    }
  }

  public clear(): void {
    this.recentWrites.clear();
    this.lastSentHash = null;
  }
}
