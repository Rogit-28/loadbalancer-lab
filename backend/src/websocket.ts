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
