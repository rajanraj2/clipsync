import { describe, expect, it } from 'bun:test';
import { ProtocolMessage, TransferItem } from '@clipsync/shared-types';
import { BlobStore, NodeSqliteDriver } from '@clipsync/storage';
import { SyncTransport, TransferEngine } from '../src/index.js';

class MockDirectTransport implements SyncTransport {
  public peer: MockDirectTransport | null = null;
  private messageHandler: ((message: ProtocolMessage) => void) | null = null;
  public sentMessages: ProtocolMessage[] = [];

  constructor(public readonly transportId: string) {}

  public async send(message: ProtocolMessage): Promise<void> {
    this.sentMessages.push(message);
    if (this.peer && this.peer.messageHandler) {
      this.peer.messageHandler(message);
    }
  }

  public onMessage(handler: (message: ProtocolMessage) => void): void {
    this.messageHandler = handler;
  }
}

describe('Chunked Transfer Engine (Images & Files)', () => {
  it('chunks, streams, and reassembles a large file across peers with checksum verification', async () => {
    const driverA = new NodeSqliteDriver(':memory:');
    const driverB = new NodeSqliteDriver(':memory:');
    const blobStoreA = new BlobStore(driverA);
    const blobStoreB = new BlobStore(driverB);

    const transportA = new MockDirectTransport('transport-a');
    const transportB = new MockDirectTransport('transport-b');
    transportA.peer = transportB;
    transportB.peer = transportA;

    const { promise: completedPromise, resolve: onCompleted } = Promise.withResolvers<{
      transfer: TransferItem;
      blobHash: string;
    }>();

    const progressUpdates: number[] = [];

    const engineA = new TransferEngine({
      localDeviceId: 'device-sender',
      blobStore: blobStoreA,
      transport: transportA,
      chunkSizeBytes: 32 * 1024, // 32 KB chunk size
    });

    const engineB = new TransferEngine(
      {
        localDeviceId: 'device-receiver',
        blobStore: blobStoreB,
        transport: transportB,
        chunkSizeBytes: 32 * 1024,
      },
      {
        onProgress: (_id, progress) => {
          progressUpdates.push(progress);
        },
        onCompleted: (transfer, blobHash) => {
          onCompleted({ transfer, blobHash });
        },
      }
    );

    transportB.onMessage((msg) => {
      void engineB.handleInboundMessage(msg);
    });

    // Create a 100 KB payload
    const originalBuffer = Buffer.alloc(100 * 1024);
    for (let i = 0; i < originalBuffer.length; i++) {
      originalBuffer[i] = i % 256;
    }

    // Initiate transfer from Device A to Device B
    const transfer = await engineA.initiateFileTransfer(
      {
        name: 'sample-image.png',
        data: originalBuffer,
        mimeType: 'image/png',
      },
      ['device-receiver']
    );

    expect(transfer.status).toBe('completed');
    expect(transfer.progress).toBe(1.0);
    expect(transfer.bytesTransferred).toBe(originalBuffer.length);

    // Wait for Device B to reassemble
    const completedResult = await completedPromise;
    expect(completedResult.transfer.fileName).toBe('sample-image.png');
    expect(completedResult.transfer.fileSizeBytes).toBe(originalBuffer.length);

    // Verify blob in Device B's store is identical to original
    const storedOnB = blobStoreB.getBlob(completedResult.blobHash);
    expect(storedOnB).not.toBeNull();
    expect(storedOnB?.data).toEqual(originalBuffer);
    expect(storedOnB?.mimeType).toBe('image/png');

    // Verify chunk progress sequence
    expect(progressUpdates.length).toBeGreaterThanOrEqual(4);
    expect(progressUpdates[progressUpdates.length - 1]).toBe(1.0);
  });
});
