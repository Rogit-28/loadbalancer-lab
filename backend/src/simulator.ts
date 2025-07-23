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

      for (let i = 0; i < clampedCount; i++) {
        const server = algorithm.getNextServer(clientIps[i]);
        if (!server) continue;

        // Simulate response time deterministically (same formula as server.ts processRequest)
        const loadRatio = server.metrics.requestCount / server.capacity;
        const overloadFactor = Math.max(0, (loadRatio - 0.7) * 3);
        const baseTime = 50 + (server.metrics.activeConnections * 10);
        const loadPenalty = loadRatio * 100;
        const randomVariation = (Math.random() - 0.5) * 50;
        let responseTime = Math.max(10, baseTime + loadPenalty + randomVariation);
        responseTime = Math.min(1000, responseTime);

        // Simulate success/failure
        const successProbability = 0.98 - (overloadFactor * 0.1);
        const success = Math.random() < successProbability;

        // Update server metrics (so subsequent requests see load)
        server.metrics.requestCount++;
        server.metrics.totalResponseTime += responseTime;
        server.metrics.responseTimes.push(Math.floor(responseTime));
        if (!success) server.metrics.errorCount++;

        // Simulate CPU/memory drift
        const cpuIncrease = Math.random() * overloadFactor * 5;
        server.metrics.cpuUtilization = Math.min(100, server.metrics.cpuUtilization + cpuIncrease) * 0.95;
        server.metrics.memoryUtilization = Math.min(100, server.metrics.memoryUtilization + Math.random() * 2) * 0.99;

        responseTimes.push(Math.floor(responseTime));
        if (!success) errors++;
        serverRequestCounts.set(server.id, (serverRequestCounts.get(server.id) || 0) + 1);
      }

      // Compute percentiles
      const sorted = [...responseTimes].sort((a, b) => a - b);
      const p50 = this.calculatePercentile(sorted, 0.5);
      const p95 = this.calculatePercentile(sorted, 0.95);
      const p99 = this.calculatePercentile(sorted, 0.99);
      const avg = responseTimes.length > 0
        ? responseTimes.reduce((s, t) => s + t, 0) / responseTimes.length
        : 0;

      // Compute distribution fairness (std dev of request counts)
      const counts = Array.from(serverRequestCounts.values());
      const meanCount = counts.reduce((s, c) => s + c, 0) / counts.length;
      const variance = counts.reduce((s, c) => s + Math.pow(c - meanCount, 2), 0) / counts.length;
      const stdDev = Math.sqrt(variance);

      const serverDistribution = clonedServers.map(s => ({
        serverId: s.id,
        serverName: s.name,
        requests: serverRequestCounts.get(s.id) || 0,
      }));

      results.push({
        algorithm: algorithmName,
        totalRequests: responseTimes.length,
        avgResponseTime: Math.round(avg * 100) / 100,
        p50ResponseTime: p50,
        p95ResponseTime: p95,
        p99ResponseTime: p99,
        errorRate: responseTimes.length > 0
          ? Math.round((errors / responseTimes.length) * 10000) / 100
          : 0,
        distributionStdDev: Math.round(stdDev * 100) / 100,
        serverDistribution,
      });
    }

    // Sort by avg response time (best first)
    results.sort((a, b) => a.avgResponseTime - b.avgResponseTime);

    return {
      results,
      requestsPerAlgorithm: clampedCount,
      serverCount: this.servers.length,
      timestamp: Date.now(),
    };
  }

  getMetrics(): SystemMetrics {
    const now = Date.now();

    // Collect all response times for system-wide percentiles
    const allResponseTimes: number[] = [];

    let totalResponseTime = 0;
    let totalRequestsForAvg = 0;
    let totalRequests = 0;
    let totalErrors = 0;
    let totalThroughput = 0;
    let totalActiveConnections = 0;

    const serverMetrics: SystemMetrics['servers'] = {};

    this.servers.forEach(server => {
      const responseTimes = server.metrics.responseTimes;
      const requestCount = responseTimes.length;

      // Accumulate for system-wide percentiles
      allResponseTimes.push(...responseTimes);

      const avgResponseTime = requestCount > 0
        ? responseTimes.reduce((sum, t) => sum + t, 0) / requestCount
        : 0;

      const sortedTimes = [...responseTimes].sort((a, b) => a - b);
      const p50 = this.calculatePercentile(sortedTimes, 0.5);
      const p95 = this.calculatePercentile(sortedTimes, 0.95);
      const p99 = this.calculatePercentile(sortedTimes, 0.99);

      const errorRate = server.metrics.requestCount > 0
        ? (server.metrics.errorCount / server.metrics.requestCount) * 100
        : 0;

      const allServerRequests = this.servers.reduce((sum, s) => sum + s.metrics.responseTimes.length, 0);
      const requestDistribution = allServerRequests > 0
        ? (requestCount / allServerRequests) * 100
        : 0;

      // Actual requests per second = requests processed since last interval
      const requestRate = server.metrics.requestsThisInterval;

      // Auto-degrade health: CPU > 90% for sustained load
      if (server.metrics.cpuUtilization > 90 && server.isHealthy) {
        // 10% chance per metrics tick to mark unhealthy when overloaded
        if (Math.random() < 0.1) {
          server.isHealthy = false;
          this.algorithm?.updateServers(this.servers);
        }
      }
      // Auto-recover: CPU < 50% when unhealthy
      if (server.metrics.cpuUtilization < 50 && !server.isHealthy) {
        if (Math.random() < 0.2) {
          server.isHealthy = true;
          this.algorithm?.updateServers(this.servers);
        }
      }

      serverMetrics[server.id] = {
        requestRate,
        avgResponseTime,
        p50ResponseTime: p50,
        p95ResponseTime: p95,
        p99ResponseTime: p99,
        activeConnections: server.metrics.activeConnections,
        cpuUtilization: server.metrics.cpuUtilization,
        memoryUtilization: server.metrics.memoryUtilization,
        errorRate,
        requestDistribution,
      };

      totalRequests += server.metrics.requestCount;
      totalErrors += server.metrics.errorCount;
      totalResponseTime += server.metrics.totalResponseTime;
      totalRequestsForAvg += server.metrics.requestCount;
      totalThroughput += requestRate;
      totalActiveConnections += server.metrics.activeConnections;
    });

    // System-wide percentiles from ALL response times
    const sortedAll = allResponseTimes.sort((a, b) => a - b);

    // Reset per-interval counters after reading them
    this.servers.forEach(server => resetIntervalCounters(server));

    return {
      timestamp: now,
      servers: serverMetrics,
      totalRequests,
      totalErrors,
      avgResponseTime: totalRequestsForAvg > 0
        ? totalResponseTime / totalRequestsForAvg
        : 0,
      p50ResponseTime: this.calculatePercentile(sortedAll, 0.5),
      p95ResponseTime: this.calculatePercentile(sortedAll, 0.95),
      p99ResponseTime: this.calculatePercentile(sortedAll, 0.99),
      throughput: totalThroughput,
      activeConnections: totalActiveConnections,
    };
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil(sortedArray.length * percentile) - 1;
    return sortedArray[Math.max(0, index)];
  }

  getStatus() {
    const trafficStatus = this.trafficGenerator.getStatus();
    const { isRunning, pattern, rate, speed } = trafficStatus;
    return {
      algorithm: this.config.algorithm,
      serverCount: this.servers.length,
      isRunning,
      pattern,
      rate,
      speed
    };
  }
}

export { LoadBalancerSimulator };
