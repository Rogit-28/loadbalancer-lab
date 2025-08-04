import * as http from 'http';
import { EventEmitter } from 'events';
import { WorkerProcess, HealthCheckResult, HealthStatus } from '../types';
import { createLogger } from '../logger';

const logger = createLogger('health-checker');

/** Number of consecutive failures before a worker is considered unhealthy */
const UNHEALTHY_THRESHOLD = 3;

/**
 * Periodically pings worker /health endpoints via HTTP GET.
 * Tracks consecutive failures and emits events when workers become
 * unhealthy or recover.
 */
class HealthChecker extends EventEmitter {
  private interval: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private workers: WorkerProcess[] = [];
  private healthMap: Map<string, HealthCheckResult> = new Map();
  /** Tracks consecutive failure counts per worker */
  private failureStreaks: Map<string, number> = new Map();
  /** Tracks which workers have been flagged unhealthy (to detect recovery) */
  private unhealthySet: Set<string> = new Set();

  constructor(interval: number) {
    super();
    this.interval = interval;
  }

  start(workers: WorkerProcess[]): void {
    this.workers = [...workers];
    logger.info('Starting health checker', { workerCount: workers.length, interval: this.interval });

    // Run an initial check immediately
    this.runChecks();

    this.timer = setInterval(() => {
      this.runChecks();
    }, this.interval);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.info('Health checker stopped');
  }

  updateWorkers(workers: WorkerProcess[]): void {
    this.workers = [...workers];

    // Clean up entries for workers that no longer exist
    const currentIds = new Set(workers.map((w) => w.id));
    for (const id of this.healthMap.keys()) {
      if (!currentIds.has(id)) {
        this.healthMap.delete(id);
        this.failureStreaks.delete(id);
        this.unhealthySet.delete(id);
      }
    }
  }

  getHealthMap(): Map<string, HealthCheckResult> {
    return new Map(this.healthMap);
  }

  /** Perform a single health check against a worker's /health endpoint */
  checkWorker(worker: WorkerProcess): Promise<HealthCheckResult> {
    const startTime = Date.now();

    return new Promise<HealthCheckResult>((resolve) => {
      const req = http.get(
        {
          hostname: worker.host,
          port: worker.port,
          path: '/health',
          timeout: 5000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => {
            data += chunk.toString();
          });
          res.on('end', () => {
            const responseTime = Date.now() - startTime;
            const statusCode = res.statusCode ?? 0;
            let status: HealthStatus = 'unknown';

            if (statusCode >= 200 && statusCode < 300) {
              status = responseTime > 2000 ? 'degraded' : 'healthy';
            } else {
              status = 'unhealthy';
            }

            resolve({
              workerId: worker.id,
              status,
              responseTime,
              timestamp: Date.now(),
              statusCode,
            });
          });
        },
      );

      req.on('error', (err: Error) => {
        const responseTime = Date.now() - startTime;
        resolve({
          workerId: worker.id,
          status: 'unhealthy',
          responseTime,
          timestamp: Date.now(),
          statusCode: null,
          error: err.message,
        });
      });

      req.on('timeout', () => {
        req.destroy();
        const responseTime = Date.now() - startTime;
        resolve({
          workerId: worker.id,
          status: 'unhealthy',
          responseTime,
          timestamp: Date.now(),
          statusCode: null,
          error: 'Health check timed out',
        });
      });
    });
  }

  private async runChecks(): Promise<void> {
    const runningWorkers = this.workers.filter((w) => w.status === 'running');
    if (runningWorkers.length === 0) return;

    const results = await Promise.all(
      runningWorkers.map((worker) => this.checkWorker(worker)),
    );

    for (const result of results) {
      this.healthMap.set(result.workerId, result);

      const wasUnhealthy = this.unhealthySet.has(result.workerId);
      const currentStreak = this.failureStreaks.get(result.workerId) ?? 0;

      if (result.status === 'healthy' || result.status === 'degraded') {
        // Reset failure streak on success
        this.failureStreaks.set(result.workerId, 0);

        if (wasUnhealthy) {
          this.unhealthySet.delete(result.workerId);
          logger.info('Worker recovered', { workerId: result.workerId });
          this.emit('worker-recovered', result);
        }
      } else {
        // Increment failure streak
        const newStreak = currentStreak + 1;
        this.failureStreaks.set(result.workerId, newStreak);

        if (newStreak >= UNHEALTHY_THRESHOLD && !wasUnhealthy) {
          this.unhealthySet.add(result.workerId);
          logger.warn('Worker unhealthy', {
            workerId: result.workerId,
            consecutiveFailures: newStreak,
          });
          this.emit('worker-unhealthy', result);
        }
      }
    }

    this.emit('health-update', results);
  }
}

export { HealthChecker };
