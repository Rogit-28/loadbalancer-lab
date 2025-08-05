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

    // Clean up
    this.circuitBreakers.clear();
    this.healthMap.clear();
    this.metricsCollector.reset();
    this.algorithm = null;
    this.active = false;

    logger.info('Live mode stopped');
  }

  getMetrics(): LiveMetrics {
    return this.metricsCollector.getMetrics(
      this.processManager.getWorkers(),
      this.healthMap,
      this.circuitBreakers
    );
  }

  isActive(): boolean {
    return this.active;
  }

  async addWorker(
    name: string,
    weight?: number,
    capacity?: number
  ): Promise<WorkerProcess> {
    const workers = this.processManager.getWorkers();
    if (workers.length >= config.worker.maxWorkers) {
      throw new Error(
        `Maximum number of workers (${config.worker.maxWorkers}) reached`
      );
    }

    // Find the next available port
    const usedPorts = new Set(workers.map((w) => w.port));
    let port = this.liveConfig.workerBasePort;
    while (usedPorts.has(port)) {
      port++;
    }

    const worker = await this.processManager.spawnWorker(
      port,
      name,
      weight,
      capacity
    );
    this.createCircuitBreaker(worker.id);
    this.healthMap.set(worker.id, 'unknown');

    // Update algorithm servers
    this.refreshAlgorithmServers();

    this.emit('worker-added', worker);
    logger.info('Worker added', { id: worker.id, name, port });
    return worker;
  }

  async removeWorker(workerId: string): Promise<void> {
    await this.processManager.killWorker(workerId);
    this.circuitBreakers.delete(workerId);
    this.healthMap.delete(workerId);

    // Update algorithm servers
    this.refreshAlgorithmServers();

    this.emit('worker-removed', { workerId });
    logger.info('Worker removed', { workerId });
  }

  getWorkers(): WorkerProcess[] {
    return this.processManager.getWorkers();
  }

  updateAlgorithm(algorithmType: string): void {
    this.algorithmType = algorithmType;
    const servers = this.buildServerList();
    this.algorithm = createLoadBalancer(algorithmType, servers, {
      algorithm: algorithmType as 'round-robin',
      servers,
      traffic: { rate: 0, pattern: 'steady', speed: 1 },
    });
    this.proxy.updateAlgorithm(this.algorithm);
    logger.info('Algorithm updated', { algorithm: algorithmType });
  }

  getCircuitBreakers(): CircuitBreakerState[] {
    return Array.from(this.circuitBreakers.values()).map((cb) => cb.getState());
  }

  private createCircuitBreaker(workerId: string): void {
    const breaker = new CircuitBreaker(workerId, this.liveConfig.circuitBreaker);
    this.circuitBreakers.set(workerId, breaker);
  }

  private buildServerList(): Server[] {
    const workers = this.processManager.getWorkers();
    return workers.map((worker) => {
      const health = this.healthMap.get(worker.id) || 'unknown';
      const isHealthy = health === 'healthy' || health === 'unknown';
      return this.workerToServer(worker, isHealthy);
    });
  }

  private workerToServer(worker: WorkerProcess, isHealthy: boolean): Server {
    return {
      id: worker.id,
      name: worker.name,
      host: worker.host,
      port: worker.port,
      weight: worker.weight,
      capacity: worker.capacity,
      isHealthy,
      metrics: {
        requestCount: 0,
        totalResponseTime: 0,
        errorCount: 0,
        activeConnections: 0,
        cpuUtilization: 0,
        memoryUtilization: 0,
        responseTimes: [],
        requestsThisInterval: 0,
      },
      createdAt: worker.startedAt || Date.now(),
    };
  }

  private refreshAlgorithmServers(): void {
    const servers = this.buildServerList();
    if (this.algorithm) {
      this.algorithm.updateServers(servers);
    }
    this.proxy.updateServers(servers);
  }

  private startHealthChecking(): void {
    this.healthInterval = setInterval(() => {
      this.runHealthChecks();
    }, this.liveConfig.healthCheckInterval);
    // Run an initial health check immediately
    this.runHealthChecks();
  }

  private stopHealthChecking(): void {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }
  }

  private runHealthChecks(): void {
    const workers = this.processManager.getWorkers();
    for (const worker of workers) {
      if (worker.status !== 'running') continue;
      this.checkWorkerHealth(worker);
    }
  }

  private checkWorkerHealth(worker: WorkerProcess): void {
    const startTime = Date.now();
    const req = http.get(
      {
        hostname: worker.host,
        port: worker.port,
        path: '/health',
        timeout: 3000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on('end', () => {
          const responseTime = Date.now() - startTime;
          const statusCode = res.statusCode || 0;
          let status: HealthStatus = 'unhealthy';

          if (statusCode >= 200 && statusCode < 300) {
            status = 'healthy';
          } else if (statusCode >= 300 && statusCode < 500) {
            status = 'degraded';
          }

          const result: HealthCheckResult = {
            workerId: worker.id,
            status,
            responseTime,
            timestamp: Date.now(),
            statusCode,
          };

          const previousHealth = this.healthMap.get(worker.id);
          this.healthMap.set(worker.id, status);

          if (previousHealth !== status) {
            this.refreshAlgorithmServers();
            this.emit('health-update', result);
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      const result: HealthCheckResult = {
        workerId: worker.id,
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        statusCode: null,
        error: 'Health check timeout',
      };

      const previousHealth = this.healthMap.get(worker.id);
      this.healthMap.set(worker.id, 'unhealthy');

      if (previousHealth !== 'unhealthy') {
        this.refreshAlgorithmServers();
        this.emit('health-update', result);
      }
    });

    req.on('error', (err: Error) => {
      const result: HealthCheckResult = {
        workerId: worker.id,
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        statusCode: null,
        error: err.message,
      };

      const previousHealth = this.healthMap.get(worker.id);
      this.healthMap.set(worker.id, 'unhealthy');

      if (previousHealth !== 'unhealthy') {
        this.refreshAlgorithmServers();
        this.emit('health-update', result);
      }
    });
  }
}

export { LiveOrchestrator };
