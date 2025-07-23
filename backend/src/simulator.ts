import { createServer, processRequest, resetIntervalCounters, resetServerMetrics } from './server';
import { LoadBalancingAlgorithm, createLoadBalancer } from './algorithms';
import { TrafficGenerator } from './traffic-generator';
import { Server, LoadBalancerConfig, SystemMetrics, RequestLogEntry, AlgorithmComparisonResult, ComparisonResponse } from './types';
import { EventEmitter } from 'events';

class LoadBalancerSimulator extends EventEmitter {
  private servers: Server[] = [];
  private algorithm: LoadBalancingAlgorithm | null = null;
  private trafficGenerator: TrafficGenerator;
  private config: LoadBalancerConfig;
  private isRunning: boolean = false;

  /** Ring buffer for the request activity log — keeps last 100 entries */
  private requestLog: RequestLogEntry[] = [];
  private readonly MAX_LOG_ENTRIES = 100;

  constructor(config: LoadBalancerConfig) {
    super();
    this.config = config;
    this.trafficGenerator = new TrafficGenerator();

    if (config.servers.length === 0) {
      this.initializeDefaultServers();
    } else {
      this.servers = [...config.servers];
    }

    this.algorithm = createLoadBalancer(config.algorithm, this.servers, config);

    this.setupTrafficGenerator();
  }

  private initializeDefaultServers(): void {
    for (let i = 1; i <= 3; i++) {
      this.servers.push(createServer(`Server-${i}`, Math.floor(Math.random() * 5) + 1, 100));
    }
  }

  private setupTrafficGenerator(): void {
    this.trafficGenerator.on('request', (request: { requestId: string; clientIp: string; timestamp: number }) => {
      if (!this.algorithm) return;
      this.processRequest(this.algorithm, request).catch((err) => {
        console.error('Error processing request:', err);
      });
    });
  }

  private async processRequest(
    algorithm: LoadBalancingAlgorithm,
    request: { requestId: string; clientIp: string; timestamp: number }
  ): Promise<void> {
    const server = algorithm.getNextServer(request.clientIp);
    if (!server) return;

    const result = await processRequest(server);

    // Add to request log
    const logEntry: RequestLogEntry = {
      id: request.requestId,
      timestamp: Date.now(),
      clientIp: request.clientIp,
      serverName: server.name,
      serverId: server.id,
      responseTime: result.responseTime,
      success: result.success,
      error: result.error,
    };

    this.requestLog.push(logEntry);
    if (this.requestLog.length > this.MAX_LOG_ENTRIES) {
      this.requestLog = this.requestLog.slice(-this.MAX_LOG_ENTRIES);
    }

    // Emit for real-time streaming
    this.emit('request-completed', logEntry);
  }

  updateConfig(config: Partial<LoadBalancerConfig>): void {
    if (config.algorithm && config.algorithm !== this.config.algorithm) {
      this.config.algorithm = config.algorithm;
      this.algorithm = createLoadBalancer(config.algorithm, this.servers, this.config);
    }

    if (config.servers) {
      this.servers = [...config.servers];
      this.algorithm?.updateServers(this.servers);
    }

    if (config.traffic) {
      if (config.traffic.rate !== undefined) {
        this.trafficGenerator.setRate(config.traffic.rate);
      }
      if (config.traffic.speed !== undefined) {
        this.trafficGenerator.setSpeed(config.traffic.speed);
      }
      if (config.traffic.pattern !== undefined) {
        this.trafficGenerator.setPattern(config.traffic.pattern);
      }
    }

    this.config = { ...this.config, ...config };
  }

  getServers(): Server[] {
    return [...this.servers];
  }

  addServer(server: Server): void {
    this.servers.push(server);
    this.algorithm?.updateServers(this.servers);
  }

  removeServer(serverId: string): void {
    this.servers = this.servers.filter(s => s.id !== serverId);
    this.algorithm?.updateServers(this.servers);
  }

  toggleServerHealth(serverId: string): void {
    const server = this.servers.find(s => s.id === serverId);
    if (server) {
      server.isHealthy = !server.isHealthy;
      this.algorithm?.updateServers(this.servers);
    }
  }

  start(): void {
    this.isRunning = true;
    this.trafficGenerator.start();
  }

  stop(): void {
    this.isRunning = false;
    this.trafficGenerator.stop();
    // Reset all server metrics for a clean next run
    this.servers.forEach(server => resetServerMetrics(server));
    this.requestLog = [];
  }

  /** Get the latest request log entries (for initial load) */
  getRequestLog(): RequestLogEntry[] {
    return [...this.requestLog];
  }

  /**
   * Run an isolated comparison of multiple algorithms.
   * For each algorithm, clones the current server set, creates a fresh algorithm
   * instance, and runs `requestCount` simulated requests through it synchronously
   * (using deterministic response-time math, no real async delays).
   * Returns results sorted by avg response time (best first).
   */
  async runComparison(
    algorithms: string[],
    requestCount: number = 500
  ): Promise<ComparisonResponse> {
    const VALID = ['round-robin', 'weighted-round-robin', 'least-connections', 'ip-hash', 'random'];
    const validAlgorithms = algorithms.filter(a => VALID.includes(a));
    if (validAlgorithms.length < 2) {
      throw new Error('At least 2 valid algorithms required for comparison');
    }

    const clampedCount = Math.max(50, Math.min(5000, requestCount));

    // Generate a fixed set of client IPs for consistency across algorithms
    const clientIps: string[] = [];
    for (let i = 0; i < clampedCount; i++) {
      const pool = [
        `192.168.1.${Math.floor(Math.random() * 255)}`,
        `10.0.0.${Math.floor(Math.random() * 255)}`,
        `172.16.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
      ];
      clientIps.push(pool[Math.floor(Math.random() * pool.length)]);
    }

    const results: AlgorithmComparisonResult[] = [];

    for (const algorithmName of validAlgorithms) {
      // Clone server configurations (fresh metrics for each algorithm)
      const clonedServers: Server[] = this.servers.map(s => ({
        ...s,
        id: s.id, // keep same IDs for distribution mapping
        metrics: {
          requestCount: 0,
          totalResponseTime: 0,
          errorCount: 0,
          activeConnections: 0,
          cpuUtilization: Math.random() * 10,
          memoryUtilization: Math.random() * 10,
          responseTimes: [],
          requestsThisInterval: 0,
        },
      }));

      const config: LoadBalancerConfig = {
        algorithm: algorithmName as LoadBalancerConfig['algorithm'],
        servers: clonedServers,
        traffic: { rate: 100, pattern: 'steady', speed: 1 },
      };

      const algorithm = createLoadBalancer(algorithmName, clonedServers, config);

      // Run all requests through this algorithm
      const responseTimes: number[] = [];
      let errors = 0;
      // Track per-server request counts
      const serverRequestCounts = new Map<string, number>();
      clonedServers.forEach(s => serverRequestCounts.set(s.id, 0));
