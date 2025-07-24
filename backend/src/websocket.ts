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