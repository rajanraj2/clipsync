import { randomUUID } from 'node:crypto';
import { TransferItem } from '@clipsync/shared-types';

export class TransferManager {
  private readonly transfers = new Map<string, TransferItem>();

  public createTransfer(options: {
    sourceDeviceId: string;
    targetDeviceIds: string[];
    fileName: string;
    fileSizeBytes: number;
    mimeType: string;
  }): TransferItem {
    const now = Date.now();
    const item: TransferItem = {
      id: `xfer-${randomUUID()}`,
      sourceDeviceId: options.sourceDeviceId,
      targetDeviceIds: options.targetDeviceIds,
      fileName: options.fileName,
      fileSizeBytes: options.fileSizeBytes,
      mimeType: options.mimeType,
      status: 'pending',
      bytesTransferred: 0,
      progress: 0.0,
      createdAt: now,
      updatedAt: now,
    };

    this.transfers.set(item.id, item);
    return item;
  }

  public getTransfer(id: string): TransferItem | null {
    return this.transfers.get(id) ?? null;
  }

  public getAllTransfers(): TransferItem[] {
    return Array.from(this.transfers.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public updateProgress(id: string, bytesTransferred: number): TransferItem | null {
    const item = this.transfers.get(id);
    if (!item) {
      return null;
    }

    const progress = Math.min(1.0, bytesTransferred / Math.max(1, item.fileSizeBytes));
    const status = progress >= 1.0 ? 'completed' : 'in_progress';

    const updated: TransferItem = {
      ...item,
      bytesTransferred,
      progress,
      status,
      updatedAt: Date.now(),
    };

    this.transfers.set(id, updated);
    return updated;
  }

  public cancelTransfer(id: string): TransferItem | null {
    const item = this.transfers.get(id);
    if (!item) {
      return null;
    }

    const updated: TransferItem = {
      ...item,
      status: 'cancelled',
      updatedAt: Date.now(),
    };

    this.transfers.set(id, updated);
    return updated;
  }
}
