import * as http from 'http';
import { EventEmitter } from 'events';
import {
  LiveModeConfig,
  WorkerProcess,
  LiveMetrics,
  CircuitBreakerState,
  Server,
  HealthStatus,
  HealthCheckResult,
  ProxyRequest,
} from '../types';
import { LoadBalancingAlgorithm, createLoadBalancer } from '../algorithms';
import { createLogger } from '../logger';
import { config } from '../config';
import { ProcessManager } from './process-manager';
import { CircuitBreaker } from './circuit-breaker';
import { MetricsCollector } from './metrics-collector';
import { LoadBalancerProxy } from './proxy';

const logger = createLogger('orchestrator');

/**
 * Main coordinator for live mode.
 * Owns: ProcessManager, health checking, LoadBalancerProxy, MetricsCollector,
 * and per-worker CircuitBreakers.
 */
class LiveOrchestrator extends EventEmitter {
  private liveConfig: LiveModeConfig;
  private processManager: ProcessManager;
  private proxy: LoadBalancerProxy;
  private metricsCollector: MetricsCollector;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  private healthMap: Map<string, HealthStatus> = new Map();
  private healthInterval: NodeJS.Timeout | null = null;

  private algorithm: LoadBalancingAlgorithm | null = null;
  private algorithmType: string = 'round-robin';
  private active: boolean = false;

  constructor(liveConfigParam: LiveModeConfig) {
    super();
    this.liveConfig = liveConfigParam;
    this.processManager = new ProcessManager();
    this.proxy = new LoadBalancerProxy(liveConfigParam.proxyPort);
    this.metricsCollector = new MetricsCollector(liveConfigParam.proxyPort);

    // Forward proxy request events to metrics collector
    this.proxy.on('request-completed', (request: ProxyRequest) => {
      this.metricsCollector.recordRequest(request);
      this.emit('request-completed', request);
    });

    this.proxy.on('proxy-error', (err: Error) => {
      logger.error('Proxy error', { error: err.message });
    });

    logger.info('Orchestrator created', {
      proxyPort: String(liveConfigParam.proxyPort),
      workerCount: String(liveConfigParam.workerCount),
    });
  }

  async start(): Promise<void> {
    if (this.active) {
      logger.warn('Already active');
      return;
    }

    logger.info('Starting live mode');

    // Spawn initial workers
    const basePort = this.liveConfig.workerBasePort;
    for (let i = 0; i < this.liveConfig.workerCount; i++) {
      const port = basePort + i;
      const name = `Worker-${i + 1}`;
      const worker = await this.processManager.spawnWorker(port, name);
      this.createCircuitBreaker(worker.id);
      this.healthMap.set(worker.id, 'unknown');
    }

    // Create the load balancing algorithm with Server wrappers
    const servers = this.buildServerList();
    this.algorithm = createLoadBalancer(this.algorithmType, servers, {
      algorithm: this.algorithmType as 'round-robin',
      servers,
      traffic: { rate: 0, pattern: 'steady', speed: 1 },
    });

    // Start health checking
    this.startHealthChecking();

    // Start proxy
    this.proxy.setCircuitBreakers(this.circuitBreakers);
    await this.proxy.start(this.algorithm, servers);

    this.active = true;
    logger.info('Live mode started', {
      workers: String(this.processManager.getWorkers().length),
      proxyPort: String(this.liveConfig.proxyPort),
    });
  }

  async stop(): Promise<void> {
    if (!this.active) {
      logger.warn('Not active');
      return;
    }

    logger.info('Stopping live mode');

    // Stop health checking
    this.stopHealthChecking();

    // Stop proxy
    await this.proxy.stop();

    // Kill all workers
    await this.processManager.killAll();
