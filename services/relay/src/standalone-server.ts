import { createServer, IncomingMessage, Server as HttpServer } from 'node:http';
import { ProtocolMessage } from '@clipsync/shared-types';
import { EncryptedRelayServer } from './relay-server.js';
import { WebSocket, WebSocketServer } from 'ws';

export interface StandaloneRelayOptions {
  port?: number;
  host?: string;
  heartbeatIntervalMs?: number;
}

export class StandaloneRelayService {
  public readonly relayCore: EncryptedRelayServer;
  private readonly port: number;
  private readonly host: string;
  private readonly heartbeatIntervalMs: number;
  private httpServer: HttpServer | null = null;
  private wss: WebSocketServer | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(options: StandaloneRelayOptions = {}) {
    this.port = options.port ?? Number(process.env.PORT || 4001);
    this.host = options.host ?? '0.0.0.0';
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 30_000;
    this.relayCore = new EncryptedRelayServer();
  }

  public async start(): Promise<number> {
    const { promise, resolve, reject } = Promise.withResolvers<number>();

    this.httpServer = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

      // Basic CORS and Security Headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }

      if (url.pathname === '/health' || url.pathname === '/') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            status: 'online',
            service: 'ClipSync Encrypted Relay',
            protocolVersion: '2.0',
            stats: this.relayCore.getStats(),
            timestamp: Date.now(),
          })
        );
        return;
      }

      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Endpoint not found' }));
    });

    this.wss = new WebSocketServer({ server: this.httpServer });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    // Start keep-alive ping intervals
    this.heartbeatTimer = setInterval(() => {
      if (!this.wss) return;
      for (const client of this.wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.ping();
        }
      }
    }, this.heartbeatIntervalMs);

    this.httpServer.on('error', reject);

    this.httpServer.listen(this.port, this.host, () => {
      resolve(this.port);
    });

    return promise;
  }

  public async stop(): Promise<void> {
    clearInterval(this.heartbeatTimer as NodeJS.Timeout);
    this.heartbeatTimer = null;

    if (this.wss) {
      for (const client of this.wss.clients) {
        client.terminate();
      }
      this.wss.close();
      this.wss = null;
    }

    if (this.httpServer) {
      const { promise, resolve } = Promise.withResolvers<void>();
      this.httpServer.close(() => {
        this.httpServer = null;
        resolve();
      });
      return promise;
    }
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const deviceId = url.searchParams.get('deviceId');
    const clusterId = url.searchParams.get('clusterId') ?? 'default-cluster';

    if (!deviceId) {
      ws.close(1008, 'Missing required deviceId parameter');
      return;
    }

    // Register with in-memory relay routing core
    this.relayCore.registerDevice(deviceId, clusterId, (msg: ProtocolMessage) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    });

    ws.on('message', (data: Buffer | string) => {
      try {
        const raw = typeof data === 'string' ? data : data.toString('utf8');
        const parsed = JSON.parse(raw) as ProtocolMessage;
        this.relayCore.forwardMessage(clusterId, parsed);
      } catch (err) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              error: 'Invalid packet envelope',
              details: err instanceof Error ? err.message : String(err),
            })
          );
        }
      }
    });

    ws.on('close', () => {
      this.relayCore.unregisterDevice(deviceId);
    });

    ws.on('error', () => {
      this.relayCore.unregisterDevice(deviceId);
    });
  }
}
