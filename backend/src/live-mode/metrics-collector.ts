import { ProxyRequest, WorkerProcess, LiveMetrics, HealthStatus, CircuitState } from '../types';
import { createLogger } from '../logger';
import { CircuitBreaker } from './circuit-breaker';

const logger = createLogger('metrics-collector');

const MAX_RING_BUFFER_SIZE = 10000;

class MetricsCollector {
  private requests: ProxyRequest[] = [];
  private proxyPort: number;

  constructor(proxyPort: number) {
    this.proxyPort = proxyPort;
    logger.info('Metrics collector initialized', { proxyPort: String(proxyPort) });
  }

  recordRequest(request: ProxyRequest): void {
    this.requests.push(request);
    if (this.requests.length > MAX_RING_BUFFER_SIZE) {
      // Trim the oldest entries to keep size bounded
      this.requests = this.requests.slice(-MAX_RING_BUFFER_SIZE);
    }
  }

  getMetrics(
    workers: WorkerProcess[],
    healthMap: Map<string, HealthStatus>,
    circuitBreakers: Map<string, CircuitBreaker>
  ): LiveMetrics {
    const now = Date.now();
    const completedRequests = this.requests.filter(
      (r) => r.endTime !== null && r.responseTime !== null
    );

    const totalRequests = this.requests.length;
    const totalErrors = this.requests.filter((r) => !r.success).length;

    // Collect all response times from completed requests
    const responseTimes = completedRequests
      .map((r) => r.responseTime)
      .filter((t): t is number => t !== null);

    const sortedTimes = [...responseTimes].sort((a, b) => a - b);

    const avgResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
        : 0;

    // Throughput: requests completed in the last second
    const oneSecondAgo = now - 1000;
    const throughput = completedRequests.filter(
      (r) => r.endTime !== null && r.endTime >= oneSecondAgo
    ).length;

    // Active connections: requests that started but haven't completed
    const activeConnections = this.requests.filter(
      (r) => r.endTime === null
    ).length;

    // Per-worker breakdown
    const workerMetrics: LiveMetrics['workers'] = {};
    for (const worker of workers) {
      const workerRequests = this.requests.filter(
        (r) => r.targetWorkerId === worker.id
      );
      const workerCompleted = workerRequests.filter(
        (r) => r.endTime !== null && r.responseTime !== null
      );
      const workerResponseTimes = workerCompleted
        .map((r) => r.responseTime)
        .filter((t): t is number => t !== null);

      const workerAvgResponseTime =
        workerResponseTimes.length > 0
          ? workerResponseTimes.reduce((sum, t) => sum + t, 0) /
            workerResponseTimes.length
          : 0;

      const workerActiveConnections = workerRequests.filter(
        (r) => r.endTime === null
      ).length;

      const health = healthMap.get(worker.id) || 'unknown';
      const breaker = circuitBreakers.get(worker.id);
      const circuitState: CircuitState = breaker
        ? breaker.getState().state
        : 'closed';

      workerMetrics[worker.id] = {
        status: worker.status,
        health,
        circuitState,
        requestCount: workerRequests.length,
        errorCount: workerRequests.filter((r) => !r.success).length,
        avgResponseTime: Math.round(workerAvgResponseTime * 100) / 100,
        activeConnections: workerActiveConnections,
      };
    }

    return {
      timestamp: now,
      proxyPort: this.proxyPort,
      totalProxiedRequests: totalRequests,
      totalProxiedErrors: totalErrors,
      avgProxyResponseTime:
        Math.round(avgResponseTime * 100) / 100,
      p50ResponseTime: this.calculatePercentile(sortedTimes, 0.5),
      p95ResponseTime: this.calculatePercentile(sortedTimes, 0.95),
      p99ResponseTime: this.calculatePercentile(sortedTimes, 0.99),
      activeConnections,
      throughput,
      workers: workerMetrics,
    };
  }

  reset(): void {
    this.requests = [];
    logger.info('Metrics collector reset');
  }

  private calculatePercentile(
    sortedArray: number[],
    percentile: number
  ): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil(sortedArray.length * percentile) - 1;
    return sortedArray[Math.max(0, index)];
  }
}

export { MetricsCollector };
