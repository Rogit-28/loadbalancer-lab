import { WebSocketServer } from './websocket';
import { LiveOrchestrator } from './live-mode/orchestrator';
import { createLiveApiRoutes } from './live-mode/api-routes';
import { config } from './config';

function start() {
  const PORT = config.serverPort;

  // Create the live mode orchestrator
  const orchestrator = new LiveOrchestrator(config.live);

  // Pass orchestrator to WebSocketServer for dual-mode support
  const server = new WebSocketServer(orchestrator);

  // Mount live API routes on the Express app
  const app = server.getApp();
  app.use('/api/live', createLiveApiRoutes(orchestrator));

  server.start(PORT);
  console.log(`LoadBalancerSim server started on port ${PORT}`);
