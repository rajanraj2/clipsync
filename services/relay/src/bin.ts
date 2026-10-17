import { StandaloneRelayService } from '../src/index.js';

const port = Number(process.env.PORT || 4001);
const service = new StandaloneRelayService({ port });

service.start().then((runningPort) => {
  console.log(`[ClipSync Relay] Running on port ${runningPort} (HTTP & WebSocket)`);
});

process.on('SIGINT', async () => {
  console.log('[ClipSync Relay] Shutting down...');
  await service.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[ClipSync Relay] Terminating...');
  await service.stop();
  process.exit(0);
});
