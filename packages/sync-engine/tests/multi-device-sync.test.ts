import { describe, expect, it } from 'bun:test';
import { ClipboardItem, DeviceMetadata, ProtocolMessage } from '@clipsync/shared-types';
import {
  InMemoryClipboardAdapter,
  SyncEngine,
  SyncTransport,
} from '../src/index.js';

class MockDirectTransport implements SyncTransport {
  public peer: MockDirectTransport | null = null;
  private messageHandler: ((message: ProtocolMessage) => void) | null = null;
  public sentMessages: ProtocolMessage[] = [];

  constructor(public readonly transportId: string) {}

  public async send(message: ProtocolMessage): Promise<void> {
    this.sentMessages.push(message);
    if (this.peer && this.peer.messageHandler) {
      // Direct delivery without timers
      this.peer.messageHandler(message);
    }
  }

  public onMessage(handler: (message: ProtocolMessage) => void): void {
    this.messageHandler = handler;
  }
}

describe('Multi-Device Clipboard Synchronization (macOS <-> Windows)', () => {
  const deviceMac: DeviceMetadata = {
    id: 'device-mac-1',
    name: "Rajan's MacBook Pro",
    platform: 'macos',
    appVersion: '0.1.0',
    capabilities: {
      backgroundClipboardMonitoring: true,
      osClipboardHook: true,
      hybridCapture: false,
      directFileAccess: true,
      browserRestricted: false,
    },
    status: 'online',
    trustLevel: 'paired',
    lastSeenAt: Date.now(),
    registeredAt: Date.now(),
  };

  const deviceWindows: DeviceMetadata = {
    id: 'device-win-1',
    name: "Rajan's ThinkPad",
    platform: 'windows',
    appVersion: '0.1.0',
    capabilities: {
      backgroundClipboardMonitoring: true,
      osClipboardHook: true,
      hybridCapture: false,
      directFileAccess: true,
      browserRestricted: false,
    },
    status: 'online',
    trustLevel: 'paired',
    lastSeenAt: Date.now(),
    registeredAt: Date.now(),
  };

  it('synchronizes text copied on macOS to Windows with echo suppression', async () => {
    const adapterMac = new InMemoryClipboardAdapter();
    const adapterWin = new InMemoryClipboardAdapter();

    const transportMac = new MockDirectTransport('transport-mac');
    const transportWin = new MockDirectTransport('transport-win');
    transportMac.peer = transportWin;
    transportWin.peer = transportMac;

    const { promise: winReceived, resolve: onWinReceived } = Promise.withResolvers<ClipboardItem>();

    const engineMac = new SyncEngine(adapterMac, transportMac, { localDevice: deviceMac });
    const engineWin = new SyncEngine(adapterWin, transportWin, { localDevice: deviceWindows }, {
      itemReceived: onWinReceived,
    });

    engineMac.start();
    engineWin.start();

    // User copies text on macOS
    adapterMac.simulateExternalCopy({
      content: 'Code snippet to sync across devices',
      contentType: 'text',
    });

    // Await the deterministic receive signal from Windows engine
    const receivedItem = await winReceived;
    expect(receivedItem.content).toBe('Code snippet to sync across devices');

    // Verify Windows updated its local clipboard
    const winClipboard = await adapterWin.read();
    expect(winClipboard).not.toBeNull();
    expect(winClipboard?.content).toBe('Code snippet to sync across devices');

    // CRITICAL: Verify Windows did NOT echo the write back to Mac!
    // transportWin should have only sent an ack, NOT a new clipboard_sync!
    const winSyncMessages = transportWin.sentMessages.filter((m) => m.type === 'clipboard_sync');
    expect(winSyncMessages).toHaveLength(0);

    const winAckMessages = transportWin.sentMessages.filter((m) => m.type === 'clipboard_ack');
    expect(winAckMessages.length).toBeGreaterThanOrEqual(1);

    engineMac.stop();
    engineWin.stop();
  });

  it('synchronizes bi-directionally from Windows to macOS', async () => {
    const adapterMac = new InMemoryClipboardAdapter();
    const adapterWin = new InMemoryClipboardAdapter();

    const transportMac = new MockDirectTransport('transport-mac');
    const transportWin = new MockDirectTransport('transport-win');
    transportMac.peer = transportWin;
    transportWin.peer = transportMac;

    const { promise: macReceived, resolve: onMacReceived } = Promise.withResolvers<ClipboardItem>();

    const engineMac = new SyncEngine(adapterMac, transportMac, { localDevice: deviceMac }, {
      itemReceived: onMacReceived,
    });
    const engineWin = new SyncEngine(adapterWin, transportWin, { localDevice: deviceWindows });

    engineMac.start();
    engineWin.start();

    // User copies a link on Windows
    adapterWin.simulateExternalCopy({
      content: 'https://clipsync.dev/getting-started',
      contentType: 'url',
    });

    // Await deterministic receive signal on macOS
    const receivedItem = await macReceived;
    expect(receivedItem.content).toBe('https://clipsync.dev/getting-started');

    // Verify macOS received the link in clipboard
    const macClipboard = await adapterMac.read();
    expect(macClipboard).not.toBeNull();
    expect(macClipboard?.content).toBe('https://clipsync.dev/getting-started');
    expect(macClipboard?.contentType).toBe('url');

    // Verify macOS did not echo back to Windows
    const macSyncMessages = transportMac.sentMessages.filter((m) => m.type === 'clipboard_sync');
    expect(macSyncMessages).toHaveLength(0);

    engineMac.stop();
    engineWin.stop();
  });

  it('halts synchronization when paused and resumes when resumed', async () => {
    const adapterMac = new InMemoryClipboardAdapter();
    const adapterWin = new InMemoryClipboardAdapter();

    const transportMac = new MockDirectTransport('transport-mac');
    const transportWin = new MockDirectTransport('transport-win');
    transportMac.peer = transportWin;
    transportWin.peer = transportMac;

    let receivedCount = 0;
    let resumeResolver: ((item: ClipboardItem) => void) | null = null;

    const engineMac = new SyncEngine(adapterMac, transportMac, { localDevice: deviceMac });
    const engineWin = new SyncEngine(adapterWin, transportWin, { localDevice: deviceWindows }, {
      itemReceived: (item) => {
        receivedCount += 1;
        if (resumeResolver) {
          resumeResolver(item);
        }
      },
    });

    engineMac.start();
    engineWin.start();

    // Pause synchronization on Mac
    engineMac.pause();
    expect(engineMac.getPaused()).toBe(true);

    // User copies on Mac while paused
    adapterMac.simulateExternalCopy({
      content: 'Should not sync while paused',
      contentType: 'text',
    });

    // Windows should not have received anything
    expect(receivedCount).toBe(0);
    const winClipboardBeforeResume = await adapterWin.read();
    expect(winClipboardBeforeResume).toBeNull();

    // Resume Mac
    const { promise: afterResumePromise, resolve: onAfterResume } = Promise.withResolvers<ClipboardItem>();
    resumeResolver = onAfterResume;

    engineMac.resume();
    expect(engineMac.getPaused()).toBe(false);

    // User copies new text on Mac after resume
    adapterMac.simulateExternalCopy({
      content: 'Syncing after resume',
      contentType: 'text',
    });

    await afterResumePromise;
    expect(receivedCount).toBe(1);

    const winClipboardAfterResume = await adapterWin.read();
    expect(winClipboardAfterResume?.content).toBe('Syncing after resume');

    engineMac.stop();
    engineWin.stop();
  });
});
