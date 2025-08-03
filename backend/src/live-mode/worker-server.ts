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
