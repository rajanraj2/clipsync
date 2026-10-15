import { createHash, randomUUID } from 'node:crypto';
import {
  ProtocolMessage,
  TransferChunk,
  TransferItem,
} from '@clipsync/shared-types';
import { createProtocolMessage } from '@clipsync/protocol-schema';
import { BlobStore } from '@clipsync/storage';
import { SyncTransport } from './types.js';

export interface TransferEngineOptions {
  localDeviceId: string;
  blobStore: BlobStore;
  transport?: SyncTransport;
  chunkSizeBytes?: number; // Default 64 KB
}

interface InboundSession {
  transferItem: TransferItem;
  totalChunks: number;
  receivedChunks: Map<number, Buffer>;
  receivedBytes: number;
}

export type TransferEventHandler = {
  onProgress?: (transferId: string, progress: number, bytesTransferred: number) => void;
  onCompleted?: (transfer: TransferItem, blobHash: string) => void;
  onFailed?: (transferId: string, error: string) => void;
};

export class TransferEngine {
  private readonly localDeviceId: string;
  private readonly blobStore: BlobStore;
  private readonly transport?: SyncTransport;
  private readonly chunkSizeBytes: number;
  private readonly inboundSessions = new Map<string, InboundSession>();
  private readonly activeTransfers = new Map<string, TransferItem>();
  private readonly eventHandlers: TransferEventHandler;

  constructor(options: TransferEngineOptions, handlers: TransferEventHandler = {}) {
    this.localDeviceId = options.localDeviceId;
    this.blobStore = options.blobStore;
    this.transport = options.transport;
    this.chunkSizeBytes = options.chunkSizeBytes ?? 64 * 1024;
    this.eventHandlers = handlers;
  }

  public async initiateFileTransfer(
    file: { name: string; data: Buffer; mimeType: string },
    targetDeviceIds: string[]
  ): Promise<TransferItem> {
    const transferId = `xfer-${randomUUID()}`;
    const fileSizeBytes = file.data.length;
    const now = Date.now();

    const transferItem: TransferItem = {
      id: transferId,
      sourceDeviceId: this.localDeviceId,
      targetDeviceIds,
      fileName: file.name,
      fileSizeBytes,
      mimeType: file.mimeType,
      status: 'in_progress',
      bytesTransferred: 0,
      progress: 0.0,
      createdAt: now,
      updatedAt: now,
    };

    this.activeTransfers.set(transferId, transferItem);

    // Save locally to blob store
    this.blobStore.saveBlob(file.data, file.mimeType, file.name);

    if (!this.transport) {
      transferItem.status = 'completed';
      transferItem.progress = 1.0;
      transferItem.bytesTransferred = fileSizeBytes;
      return transferItem;
    }

    // 1. Send transfer_offer
    const offerMsg = createProtocolMessage<TransferItem, 'transfer_offer'>({
      type: 'transfer_offer',
      senderDeviceId: this.localDeviceId,
      targetDeviceId: null,
      payload: transferItem,
    });
    await this.transport.send(offerMsg);

    // 2. Chunk and send
    const totalChunks = Math.ceil(fileSizeBytes / this.chunkSizeBytes);

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * this.chunkSizeBytes;
      const end = Math.min(start + this.chunkSizeBytes, fileSizeBytes);
      const chunkBuffer = file.data.subarray(start, end);

      const checksum = createHash('sha256').update(chunkBuffer).digest('hex');
      const base64Data = chunkBuffer.toString('base64');

      const chunkMsg = createProtocolMessage<TransferChunk, 'transfer_chunk'>({
        type: 'transfer_chunk',
        senderDeviceId: this.localDeviceId,
        targetDeviceId: null,
        payload: {
          transferId,
          chunkIndex,
          totalChunks,
          data: base64Data,
          checksum,
        },
      });

      await this.transport.send(chunkMsg);

      transferItem.bytesTransferred = end;
      transferItem.progress = end / fileSizeBytes;
      transferItem.updatedAt = Date.now();

      this.eventHandlers.onProgress?.(transferId, transferItem.progress, transferItem.bytesTransferred);
    }

    // 3. Send transfer_complete
    transferItem.status = 'completed';
    const completeMsg = createProtocolMessage<TransferItem, 'transfer_complete'>({
      type: 'transfer_complete',
      senderDeviceId: this.localDeviceId,
      targetDeviceId: null,
      payload: transferItem,
    });
    await this.transport.send(completeMsg);

    return transferItem;
  }

  public async handleInboundMessage(message: ProtocolMessage): Promise<void> {
    if (message.senderDeviceId === this.localDeviceId) {
      return;
    }

    if (message.type === 'transfer_offer') {
      const item = message.payload;
      const totalChunks = Math.ceil(item.fileSizeBytes / this.chunkSizeBytes);

      this.inboundSessions.set(item.id, {
        transferItem: item,
        totalChunks,
        receivedChunks: new Map(),
        receivedBytes: 0,
      });
      this.activeTransfers.set(item.id, item);
    } else if (message.type === 'transfer_chunk') {
      const chunk = message.payload;
      const session = this.inboundSessions.get(chunk.transferId);
      if (!session) {
        return;
      }

      const chunkBuffer = Buffer.from(chunk.data, 'base64');
      const calculatedChecksum = createHash('sha256').update(chunkBuffer).digest('hex');

      if (calculatedChecksum !== chunk.checksum) {
        this.eventHandlers.onFailed?.(chunk.transferId, `Corrupted chunk at index ${chunk.chunkIndex}`);
        return;
      }

      session.receivedChunks.set(chunk.chunkIndex, chunkBuffer);
      session.receivedBytes += chunkBuffer.length;

      const progress = session.receivedBytes / session.transferItem.fileSizeBytes;
      this.eventHandlers.onProgress?.(chunk.transferId, progress, session.receivedBytes);

      // Check if all chunks received
      if (session.receivedChunks.size === session.totalChunks) {
        const assembledBuffers: Buffer[] = [];
        for (let i = 0; i < session.totalChunks; i++) {
          const part = session.receivedChunks.get(i);
          if (part) {
            assembledBuffers.push(part);
          }
        }

        const completeBuffer = Buffer.concat(assembledBuffers);
        const meta = this.blobStore.saveBlob(
          completeBuffer,
          session.transferItem.mimeType,
          session.transferItem.fileName
        );

        session.transferItem.status = 'completed';
        session.transferItem.bytesTransferred = completeBuffer.length;
        session.transferItem.progress = 1.0;

        this.inboundSessions.delete(chunk.transferId);
        this.eventHandlers.onCompleted?.(session.transferItem, meta.hash);
      }
    } else if (message.type === 'transfer_cancel') {
      const item = message.payload;
      this.inboundSessions.delete(item.id);
      const active = this.activeTransfers.get(item.id);
      if (active) {
        active.status = 'cancelled';
      }
    }
  }

  public getTransfer(id: string): TransferItem | null {
    return this.activeTransfers.get(id) ?? null;
  }

  public getAllTransfers(): TransferItem[] {
    return Array.from(this.activeTransfers.values());
  }
}
