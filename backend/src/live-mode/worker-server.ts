import * as http from 'http';
import express, { Request, Response } from 'express';
import { createLogger } from '../logger';

interface WorkerMetrics {
  requestCount: number;
  totalResponseTime: number;
  errorCount: number;
  startedAt: number;
  responseTimes: number[];
}

/**
 * Creates an Express app that simulates a real backend worker.
 * Tracks its own request metrics, responds with simulated latency,
 * and exposes /health and /metrics endpoints.
 */
function createWorkerApp(workerId: string): express.Application {
  const logger = createLogger('worker-server');
  const app = express();

  const metrics: WorkerMetrics = {
    requestCount: 0,
    totalResponseTime: 0,
    errorCount: 0,
    startedAt: Date.now(),
    responseTimes: [],
  };

  // Keep a rolling window of response times (last 1000)
  const RESPONSE_TIME_LIMIT = 1000;

  function getAvgResponseTime(): number {
    if (metrics.responseTimes.length === 0) return 0;
    const sum = metrics.responseTimes.reduce((a, b) => a + b, 0);
    return Math.round((sum / metrics.responseTimes.length) * 100) / 100;
  }

  /** Simulated latency: 50-200ms base, increasing with load */
  function calculateLatency(): number {
    // Base latency between 50-80ms
    const base = 50 + Math.random() * 30;
    // Load factor: as request count grows, add latency (caps at ~120ms extra)
    const loadFactor = Math.min(120, (metrics.requestCount / 500) * 50);
    // Random jitter +/- 20ms
    const jitter = (Math.random() - 0.5) * 40;
    return Math.max(10, Math.min(300, base + loadFactor + jitter));
  }

  /** Under heavy load (>1000 requests), small chance of simulated error */
  function shouldSimulateError(): boolean {
    if (metrics.requestCount < 200) return false;
    // Error probability scales from 0% at 200 requests to ~3% at 2000+
    const errorProbability = Math.min(0.03, (metrics.requestCount - 200) / 60000);
    return Math.random() < errorProbability;
  }

  // Health endpoint
  app.get('/health', (_req: Request, res: Response) => {
    const uptime = Date.now() - metrics.startedAt;
    res.json({
      status: 'healthy',
      uptime,
      requestCount: metrics.requestCount,
      avgResponseTime: getAvgResponseTime(),
      workerId,
    });
  });

  // Metrics endpoint
  app.get('/metrics', (_req: Request, res: Response) => {
    const uptime = Date.now() - metrics.startedAt;
    const sorted = [...metrics.responseTimes].sort((a, b) => a - b);
    const p50 = percentile(sorted, 0.5);
    const p95 = percentile(sorted, 0.95);
    const p99 = percentile(sorted, 0.99);

    res.json({
      workerId,
      uptime,
      requestCount: metrics.requestCount,
      errorCount: metrics.errorCount,
      totalResponseTime: metrics.totalResponseTime,
      avgResponseTime: getAvgResponseTime(),
      p50ResponseTime: p50,
      p95ResponseTime: p95,
      p99ResponseTime: p99,
      errorRate: metrics.requestCount > 0
        ? Math.round((metrics.errorCount / metrics.requestCount) * 10000) / 100
        : 0,
    });
  });

  // Catch-all route: responds to ANY method on ANY path
  app.all('*', (req: Request, res: Response) => {
    const latency = calculateLatency();
    const startTime = Date.now();

    setTimeout(() => {
      const responseTime = Date.now() - startTime;
      metrics.requestCount++;
      metrics.totalResponseTime += responseTime;
      metrics.responseTimes.push(responseTime);

      // Keep rolling window
      if (metrics.responseTimes.length > RESPONSE_TIME_LIMIT) {
        metrics.responseTimes = metrics.responseTimes.slice(-RESPONSE_TIME_LIMIT);
      }

      if (shouldSimulateError()) {
        metrics.errorCount++;
        logger.debug('Simulated error', { workerId, path: req.path });
        res.status(503).json({
          error: 'Service temporarily unavailable',
          workerId,
          timestamp: Date.now(),
        });
        return;
      }

      logger.debug('Request handled', { workerId, method: req.method, path: req.path, responseTime });
      res.json({
        message: 'OK',
        workerId,
        method: req.method,
        path: req.path,
        responseTime,
        timestamp: Date.now(),
      });
    }, latency);
  });

  return app;
}

/** Start an HTTP server running the worker Express app on the given port. */
function startWorkerServer(port: number, workerId: string): Promise<http.Server> {
  const logger = createLogger('worker-server');
  const app = createWorkerApp(workerId);

  return new Promise<http.Server>((resolve, reject) => {
    const server = app.listen(port, () => {
      logger.info('Worker server started', { workerId, port });
      resolve(server);
    });

    server.on('error', (err: Error) => {
      logger.error('Worker server failed to start', { workerId, port, error: err.message });
      reject(err);
    });
  });
}

function percentile(sortedArray: number[], p: number): number {
  if (sortedArray.length === 0) return 0;
  const index = Math.ceil(sortedArray.length * p) - 1;
  return sortedArray[Math.max(0, index)];
}

export { startWorkerServer, createWorkerApp };
