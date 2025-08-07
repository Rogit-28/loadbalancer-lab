import express, { Application } from 'express';
import { createServer as createHttpServer, Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import cors from 'cors';
import { LoadBalancerSimulator } from './simulator';
import { createServer } from './server';
import { RequestLogEntry, SystemMode, ProxyRequest } from './types';
import { LiveOrchestrator } from './live-mode/orchestrator';

const VALID_ALGORITHMS = ['round-robin', 'weighted-round-robin', 'least-connections', 'ip-hash', 'random'] as const;
type ValidAlgorithm = typeof VALID_ALGORITHMS[number];

class WebSocketServer {
  private app: Application;
  private httpServer: HttpServer;
  private io: SocketServer;
  private simulator: LoadBalancerSimulator;
  private metricsInterval: NodeJS.Timeout | null = null;

  /** Throttled request log batch — emit at most every 250ms */
  private requestLogBuffer: RequestLogEntry[] = [];
  private requestLogInterval: NodeJS.Timeout | null = null;

  /** Live mode support */
  private orchestrator: LiveOrchestrator | null;
  private currentMode: SystemMode = 'simulation';
  private liveMetricsInterval: NodeJS.Timeout | null = null;
  private liveRequestLogBuffer: ProxyRequest[] = [];
  private liveRequestLogInterval: NodeJS.Timeout | null = null;

  constructor(orchestrator?: LiveOrchestrator) {
    this.orchestrator = orchestrator || null;

    this.app = express();
    this.app.use(cors());
    this.app.use(express.json());
    this.httpServer = createHttpServer(this.app);

    this.io = new SocketServer(this.httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    const defaultConfig = {
      algorithm: 'round-robin' as const,
      servers: [] as ReturnType<typeof createServer>[],
      traffic: {
        rate: 100,
        pattern: 'steady' as const,
        speed: 1
      }
    };

    this.simulator = new LoadBalancerSimulator(defaultConfig);
    this.setupRoutes();
    this.setupSocketHandlers();
    this.setupRequestLogStreaming();
    this.startMetricsBroadcast();

    if (this.orchestrator) {
      this.setupLiveEventStreaming();
    }
  }

  getApp(): Application {
    return this.app;
  }

  private setupRoutes(): void {
    this.app.get('/api/status', (_req, res) => {
      res.json({
        status: 'running',
        mode: this.currentMode,
        simulator: this.simulator.getStatus()
      });
    });
  }

  private setupRequestLogStreaming(): void {
    // Buffer request-completed events and emit in batches
    this.simulator.on('request-completed', (entry: RequestLogEntry) => {
      this.requestLogBuffer.push(entry);
    });

    // Flush buffer every 250ms — max ~20 entries per batch to avoid flooding
    this.requestLogInterval = setInterval(() => {
      if (this.requestLogBuffer.length === 0) return;
      const batch = this.requestLogBuffer.slice(-20);
      this.requestLogBuffer = [];
      this.io.emit('request-log', batch);
    }, 250);
  }

  private setupLiveEventStreaming(): void {
    if (!this.orchestrator) return;

    // Buffer live proxy requests for batched emission
    this.orchestrator.on('request-completed', (request: ProxyRequest) => {
      this.liveRequestLogBuffer.push(request);
    });

    // Flush live request buffer every 250ms (same cadence as simulation)
    this.liveRequestLogInterval = setInterval(() => {
      if (this.liveRequestLogBuffer.length === 0) return;
      const batch = this.liveRequestLogBuffer.slice(-20);
      this.liveRequestLogBuffer = [];
      this.io.emit('live-request-log', batch);
    }, 250);

    // Broadcast live metrics every 1000ms
    this.liveMetricsInterval = setInterval(() => {
      if (!this.orchestrator || !this.orchestrator.isActive()) return;
      const metrics = this.orchestrator.getMetrics();
      this.io.emit('live-metrics-update', metrics);
    }, 1000);

    // Forward worker change events
    this.orchestrator.on('worker-added', () => {
      if (!this.orchestrator) return;
      this.io.emit('live-workers-update', {
        workers: this.orchestrator.getWorkers(),
      });
    });

    this.orchestrator.on('worker-removed', () => {
      if (!this.orchestrator) return;
      this.io.emit('live-workers-update', {
        workers: this.orchestrator.getWorkers(),
      });
    });

    this.orchestrator.on('health-update', () => {
      if (!this.orchestrator) return;
      this.io.emit('live-workers-update', {
        workers: this.orchestrator.getWorkers(),
      });
    });
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log('Client connected:', socket.id);

      // ─── Simulation events (unchanged) ─────────────────────────────

      socket.on('get-config', () => {
        try {
          socket.emit('config-update', {
            algorithm: this.simulator.getStatus().algorithm,
            servers: this.simulator.getServers(),
            traffic: this.simulator.getStatus(),
            metrics: this.simulator.getMetrics()
          });
          // Also send recent request log
          socket.emit('request-log', this.simulator.getRequestLog().slice(-20));
        } catch (err) {
          console.error('Error handling get-config:', err);
          socket.emit('error', { message: 'Failed to get config' });
        }
      });

      socket.on('update-algorithm', (data: { algorithm: string }) => {
        try {
          if (!data || !VALID_ALGORITHMS.includes(data.algorithm as ValidAlgorithm)) {
            socket.emit('error', { message: `Invalid algorithm: ${data?.algorithm}. Must be one of: ${VALID_ALGORITHMS.join(', ')}` });
            return;
          }
          this.simulator.updateConfig({ algorithm: data.algorithm as ValidAlgorithm });
          this.emitConfigUpdate();
        } catch (err) {
          console.error('Error handling update-algorithm:', err);
          socket.emit('error', { message: 'Failed to update algorithm' });
        }
      });

      socket.on('update-traffic', (data: { rate?: number; pattern?: string; speed?: number }) => {
        try {
          const status = this.simulator.getStatus();
          const rate = typeof data.rate === 'number' ? Math.max(1, Math.min(10000, data.rate)) : status.rate;
          const speed = typeof data.speed === 'number' ? Math.max(0.1, Math.min(10, data.speed)) : status.speed;
          const validPatterns = ['steady', 'burst', 'spike'];
          const pattern = validPatterns.includes(data.pattern || '') 
            ? data.pattern as 'steady' | 'burst' | 'spike' 
            : status.pattern as 'steady' | 'burst' | 'spike';

          this.simulator.updateConfig({
            traffic: { rate, pattern, speed }
          });
          this.emitConfigUpdate();
        } catch (err) {
          console.error('Error handling update-traffic:', err);
          socket.emit('error', { message: 'Failed to update traffic' });
        }
      });

      socket.on('add-server', (data: { name?: string; weight?: number; capacity?: number }) => {
        try {
          const weight = typeof data.weight === 'number' ? Math.max(1, Math.min(10, data.weight)) : 1;
          const capacity = typeof data.capacity === 'number' ? Math.max(10, Math.min(1000, data.capacity)) : 100;
          const server = createServer(data.name, weight, capacity);
          this.simulator.addServer(server);
          this.emitConfigUpdate();
        } catch (err) {
          console.error('Error handling add-server:', err);
          socket.emit('error', { message: 'Failed to add server' });
        }
      });

      socket.on('remove-server', (data: { serverId: string }) => {
        try {
          if (!data?.serverId || typeof data.serverId !== 'string') {
            socket.emit('error', { message: 'Invalid serverId' });
            return;
          }
          this.simulator.removeServer(data.serverId);
          this.emitConfigUpdate();
        } catch (err) {
          console.error('Error handling remove-server:', err);
          socket.emit('error', { message: 'Failed to remove server' });
        }
      });

      socket.on('update-server', (data: { serverId: string; weight?: number; capacity?: number }) => {
        try {
          if (!data?.serverId || typeof data.serverId !== 'string') {
            socket.emit('error', { message: 'Invalid serverId' });
            return;
          }
          const servers = this.simulator.getServers().map(s => {
            if (s.id === data.serverId) {
              return {
                ...s,
                weight: typeof data.weight === 'number' ? Math.max(1, Math.min(10, data.weight)) : s.weight,
                capacity: typeof data.capacity === 'number' ? Math.max(10, Math.min(1000, data.capacity)) : s.capacity
              };
            }
            return s;
          });
          this.simulator.updateConfig({ servers });
          this.emitConfigUpdate();
        } catch (err) {
          console.error('Error handling update-server:', err);
          socket.emit('error', { message: 'Failed to update server' });
        }
      });

      socket.on('toggle-health', (data: { serverId: string }) => {
        try {
          if (!data?.serverId || typeof data.serverId !== 'string') {
            socket.emit('error', { message: 'Invalid serverId' });
            return;
          }
          this.simulator.toggleServerHealth(data.serverId);
          this.emitConfigUpdate();
        } catch (err) {
          console.error('Error handling toggle-health:', err);
          socket.emit('error', { message: 'Failed to toggle server health' });
        }
      });

      socket.on('start-simulation', () => {
        try {
          this.simulator.start();
          this.emitConfigUpdate();
        } catch (err) {
          console.error('Error handling start-simulation:', err);
          socket.emit('error', { message: 'Failed to start simulation' });
        }
      });

      socket.on('stop-simulation', () => {
        try {
          this.simulator.stop();
          this.emitConfigUpdate();
        } catch (err) {
          console.error('Error handling stop-simulation:', err);
          socket.emit('error', { message: 'Failed to stop simulation' });
        }
      });

      socket.on('run-comparison', async (data: { algorithms?: string[]; requestCount?: number }) => {
        try {
          if (!data?.algorithms || !Array.isArray(data.algorithms) || data.algorithms.length < 2) {
            socket.emit('error', { message: 'At least 2 algorithms required for comparison' });
            return;
          }

          // Validate all provided algorithms
          const validAlgorithms = data.algorithms.filter(a =>
            VALID_ALGORITHMS.includes(a as ValidAlgorithm)
          );
          if (validAlgorithms.length < 2) {
            socket.emit('error', { message: `Need at least 2 valid algorithms. Valid: ${VALID_ALGORITHMS.join(', ')}` });
            return;
          }

          const requestCount = typeof data.requestCount === 'number'
            ? Math.max(50, Math.min(5000, data.requestCount))
            : 500;

          const result = await this.simulator.runComparison(validAlgorithms, requestCount);
          socket.emit('comparison-result', result);
        } catch (err) {
          console.error('Error handling run-comparison:', err);
          socket.emit('error', { message: 'Failed to run comparison' });
        }
      });

      // ─── Mode switching events ────────────────────────────────────

      socket.on('get-mode', () => {
        try {
          socket.emit('mode-update', this.getModeStatus());
        } catch (err) {
          console.error('Error handling get-mode:', err);
          socket.emit('error', { message: 'Failed to get mode' });
        }
      });

      socket.on('switch-mode', (data: { mode: 'simulation' | 'live' }) => {
        try {
          if (!data?.mode || (data.mode !== 'simulation' && data.mode !== 'live')) {
            socket.emit('error', { message: 'Invalid mode. Must be "simulation" or "live"' });
            return;
          }

          if (data.mode === 'live' && !this.orchestrator) {
            socket.emit('error', { message: 'Live mode is not available' });
            return;
          }

          // Prevent switching while something is running
          const simRunning = this.simulator.getStatus().isRunning;
          const liveRunning = this.orchestrator?.isActive() || false;
          if (simRunning || liveRunning) {
            socket.emit('error', { message: 'Cannot switch modes while running. Stop current mode first.' });
            return;
          }

          this.currentMode = data.mode;
          this.io.emit('mode-update', this.getModeStatus());
        } catch (err) {
          console.error('Error handling switch-mode:', err);
          socket.emit('error', { message: 'Failed to switch mode' });
        }
      });

      // ─── Live mode events ─────────────────────────────────────────

      socket.on('live-start', async () => {
        try {
          if (!this.orchestrator) {
            socket.emit('error', { message: 'Live mode is not available' });
            return;
          }
          if (this.orchestrator.isActive()) {
            socket.emit('error', { message: 'Live mode is already running' });
            return;
          }
          await this.orchestrator.start();
          this.io.emit('mode-update', this.getModeStatus());
          this.io.emit('live-workers-update', {
            workers: this.orchestrator.getWorkers(),
          });
        } catch (err) {
          console.error('Error handling live-start:', err);
          socket.emit('error', { message: 'Failed to start live mode' });
        }
      });

      socket.on('live-stop', async () => {
        try {
          if (!this.orchestrator) {
            socket.emit('error', { message: 'Live mode is not available' });
            return;
          }
          if (!this.orchestrator.isActive()) {
            socket.emit('error', { message: 'Live mode is not running' });
            return;
          }
          await this.orchestrator.stop();
          this.io.emit('mode-update', this.getModeStatus());
        } catch (err) {
          console.error('Error handling live-stop:', err);
          socket.emit('error', { message: 'Failed to stop live mode' });
        }
      });

      socket.on('live-add-worker', async (data: { name: string; weight?: number; capacity?: number }) => {
        try {
          if (!this.orchestrator) {
            socket.emit('error', { message: 'Live mode is not available' });
            return;
          }
          if (!data?.name || typeof data.name !== 'string') {
            socket.emit('error', { message: 'Worker name is required' });
            return;
          }