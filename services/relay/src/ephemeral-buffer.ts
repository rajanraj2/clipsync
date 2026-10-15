import { ProtocolMessage } from '@clipsync/shared-types';

interface BufferedItem {
  message: ProtocolMessage;
  bufferedAt: number;
}

export class EphemeralBuffer {
  private readonly bufferByDevice = new Map<string, BufferedItem[]>();

  constructor(
    private readonly ttlMs: number = 10 * 60 * 1000, // 10 minutes TTL
    private readonly maxItemsPerDevice: number = 100
  ) {}

  public bufferMessage(targetDeviceId: string, message: ProtocolMessage): boolean {
    this.cleanup(targetDeviceId);

    let items = this.bufferByDevice.get(targetDeviceId);
    if (!items) {
      items = [];
      this.bufferByDevice.set(targetDeviceId, items);
    }

    if (items.length >= this.maxItemsPerDevice) {
      // Drop oldest message when queue ceiling reached
      items.shift();
    }

    items.push({
      message,
      bufferedAt: Date.now(),
    });

    return true;
  }

  public popBufferedMessages(targetDeviceId: string): ProtocolMessage[] {
    this.cleanup(targetDeviceId);
    const items = this.bufferByDevice.get(targetDeviceId);
    if (!items || items.length === 0) {
      return [];
    }

    this.bufferByDevice.delete(targetDeviceId);
    return items.map((i) => i.message);
  }

  public getPendingCount(targetDeviceId: string): number {
    this.cleanup(targetDeviceId);
    return this.bufferByDevice.get(targetDeviceId)?.length ?? 0;
  }

  public getTotalBufferedCount(): number {
    let total = 0;
    for (const key of this.bufferByDevice.keys()) {
      total += this.getPendingCount(key);
    }
    return total;
  }

  private cleanup(targetDeviceId: string): void {
    const items = this.bufferByDevice.get(targetDeviceId);
    if (!items) return;

    const now = Date.now();
    const valid = items.filter((item) => now - item.bufferedAt <= this.ttlMs);

    if (valid.length === 0) {
      this.bufferByDevice.delete(targetDeviceId);
    } else {
      this.bufferByDevice.set(targetDeviceId, valid);
    }
  }
}
