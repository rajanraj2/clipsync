import { createServer, Server as HttpServer } from 'node:http';
import { HistoryStore, NodeSqliteDriver, SettingsStore } from '@clipsync/storage';
import { DeviceRegistry } from './device-registry.js';
import { TransferManager } from './transfer-manager.js';
import { ApiRouter, ApiServerContext } from './router.js';

export interface ClipSyncApiServerOptions {
  port?: number;
  dbPath?: string;
  context?: Partial<ApiServerContext>;
}

export class ClipSyncApiServer {
  public readonly router: ApiRouter;
  public readonly context: ApiServerContext;
  private server: HttpServer | null = null;
  private readonly port: number;

  constructor(options: ClipSyncApiServerOptions = {}) {
    this.port = options.port ?? 4000;

    const driver = new NodeSqliteDriver(options.dbPath ?? ':memory:');
    const historyStore = options.context?.historyStore ?? new HistoryStore(driver);
    const settingsStore = options.context?.settingsStore ?? new SettingsStore(driver);
    const deviceRegistry = options.context?.deviceRegistry ?? new DeviceRegistry();
    const transferManager = options.context?.transferManager ?? new TransferManager();

    this.context = {
      historyStore,
      settingsStore,
      deviceRegistry,
      transferManager,
      defaultUserId: options.context?.defaultUserId ?? 'default-user',
    };

    this.router = new ApiRouter(this.context);
  }

  public async start(): Promise<number> {
    const { promise, resolve } = Promise.withResolvers<number>();

    this.server = createServer(async (req, res) => {
      const url = `http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`;

      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

      const webRequest = new Request(url, {
        method: req.method,
        headers: req.headers as HeadersInit,
        body: ['GET', 'HEAD'].includes(req.method ?? '') ? undefined : body,
      });

      const webResponse = await this.router.handleRequest(webRequest);

      res.statusCode = webResponse.status;
      webResponse.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });

      const responseBody = await webResponse.arrayBuffer();
      res.end(Buffer.from(responseBody));
    });

    this.server.listen(this.port, () => {
      resolve(this.port);
    });

    return promise;
  }

  public async stop(): Promise<void> {
    if (!this.server) {
      return;
    }
    const { promise, resolve } = Promise.withResolvers<void>();
    this.server.close(() => {
      this.server = null;
      resolve();
    });
    return promise;
  }
}
