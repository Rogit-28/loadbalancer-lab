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