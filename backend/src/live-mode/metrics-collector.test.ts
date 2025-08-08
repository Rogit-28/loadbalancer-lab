import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsCollector } from './metrics-collector';
import { CircuitBreaker } from './circuit-breaker';
import { ProxyRequest, WorkerProcess, HealthStatus } from '../types';

function makeRequest(overrides: Partial<ProxyRequest> = {}): ProxyRequest {
  return {
    id: 'req-1',
    method: 'GET',
    url: '/',
    clientIp: '127.0.0.1',
    targetWorkerId: 'w1',
    targetHost: 'localhost',
    targetPort: 4001,
    startTime: Date.now() - 100,
    endTime: Date.now(),
    responseTime: 100,
    statusCode: 200,
    success: true,
    ...overrides,
  };
}

function makeWorker(overrides: Partial<WorkerProcess> = {}): WorkerProcess {
  return {
    id: 'w1',
    name: 'Worker-1',
    host: 'localhost',
    port: 4001,
    pid: 1234,
    status: 'running',
    weight: 1,
    capacity: 100,
    startedAt: Date.now() - 60000,
    uptime: 60000,
    ...overrides,
  };
}

describe('MetricsCollector', () => {
  let collector: MetricsCollector;
  const emptyWorkers: WorkerProcess[] = [];
  const emptyHealth = new Map<string, HealthStatus>();
  const emptyBreakers = new Map<string, CircuitBreaker>();

  beforeEach(() => {
    collector = new MetricsCollector(8080);
  });

  it('should return zero metrics when no requests recorded', () => {
    const metrics = collector.getMetrics(emptyWorkers, emptyHealth, emptyBreakers);

    expect(metrics.totalProxiedRequests).toBe(0);
    expect(metrics.totalProxiedErrors).toBe(0);
    expect(metrics.avgProxyResponseTime).toBe(0);
    expect(metrics.p50ResponseTime).toBe(0);
    expect(metrics.p95ResponseTime).toBe(0);
    expect(metrics.p99ResponseTime).toBe(0);
    expect(metrics.activeConnections).toBe(0);
    expect(metrics.throughput).toBe(0);
    expect(metrics.proxyPort).toBe(8080);
  });

  it('should record requests and compute correct totals', () => {
    collector.recordRequest(makeRequest({ id: 'r1', success: true }));
    collector.recordRequest(makeRequest({ id: 'r2', success: true }));
    collector.recordRequest(makeRequest({ id: 'r3', success: false, statusCode: 500 }));

    const metrics = collector.getMetrics(emptyWorkers, emptyHealth, emptyBreakers);

    expect(metrics.totalProxiedRequests).toBe(3);
    expect(metrics.totalProxiedErrors).toBe(1);
  });

  it('should calculate correct percentiles (p50, p95, p99)', () => {
    // Record 100 requests with response times 1..100
    for (let i = 1; i <= 100; i++) {
      collector.recordRequest(
        makeRequest({
          id: `r${i}`,
          responseTime: i,
          endTime: Date.now(),
        })
      );
    }

    const metrics = collector.getMetrics(emptyWorkers, emptyHealth, emptyBreakers);

    // p50 of [1..100] → index ceil(100*0.5)-1 = 49 → value 50
    expect(metrics.p50ResponseTime).toBe(50);
    // p95 → index ceil(100*0.95)-1 = 94 → value 95
    expect(metrics.p95ResponseTime).toBe(95);
    // p99 → index ceil(100*0.99)-1 = 98 → value 99
    expect(metrics.p99ResponseTime).toBe(99);
  });

  it('should calculate throughput (requests completed in last second)', () => {
    const now = Date.now();
    // 3 requests completed within the last second
    collector.recordRequest(makeRequest({ id: 'r1', endTime: now - 500 }));
    collector.recordRequest(makeRequest({ id: 'r2', endTime: now - 200 }));
    collector.recordRequest(makeRequest({ id: 'r3', endTime: now - 100 }));
    // 1 request completed more than 1 second ago
    collector.recordRequest(makeRequest({ id: 'r4', endTime: now - 2000 }));

    const metrics = collector.getMetrics(emptyWorkers, emptyHealth, emptyBreakers);

    // Throughput counts completed requests in last second
    // The exact value depends on timing but we know r4 is old
    expect(metrics.throughput).toBeGreaterThanOrEqual(3);
  });

  it('should count active connections (requests with null endTime)', () => {
    collector.recordRequest(makeRequest({ id: 'r1', endTime: null, responseTime: null }));
    collector.recordRequest(makeRequest({ id: 'r2', endTime: null, responseTime: null }));
    collector.recordRequest(makeRequest({ id: 'r3', endTime: Date.now() }));

    const metrics = collector.getMetrics(emptyWorkers, emptyHealth, emptyBreakers);

    expect(metrics.activeConnections).toBe(2);
  });

  it('should compute correct per-worker breakdown', () => {
    const workers = [
      makeWorker({ id: 'w1', port: 4001 }),
      makeWorker({ id: 'w2', name: 'Worker-2', port: 4002 }),
    ];
    const healthMap = new Map<string, HealthStatus>([
      ['w1', 'healthy'],
      ['w2', 'degraded'],
    ]);
    const breakers = new Map<string, CircuitBreaker>([
      ['w1', new CircuitBreaker('w1', { failureThreshold: 5, resetTimeout: 30000, halfOpenMaxRequests: 3 })],
    ]);

    collector.recordRequest(makeRequest({ id: 'r1', targetWorkerId: 'w1', responseTime: 50, success: true }));
    collector.recordRequest(makeRequest({ id: 'r2', targetWorkerId: 'w1', responseTime: 150, success: true }));
    collector.recordRequest(makeRequest({ id: 'r3', targetWorkerId: 'w2', responseTime: 200, success: false }));
    collector.recordRequest(
      makeRequest({ id: 'r4', targetWorkerId: 'w2', endTime: null, responseTime: null, success: true })
    );

    const metrics = collector.getMetrics(workers, healthMap, breakers);

    // Worker w1: 2 requests, 0 errors, avg 100ms, 0 active
    expect(metrics.workers['w1'].requestCount).toBe(2);
    expect(metrics.workers['w1'].errorCount).toBe(0);
    expect(metrics.workers['w1'].avgResponseTime).toBe(100);
    expect(metrics.workers['w1'].activeConnections).toBe(0);
    expect(metrics.workers['w1'].health).toBe('healthy');
    expect(metrics.workers['w1'].circuitState).toBe('closed');

    // Worker w2: 2 requests, 1 error, 1 active connection
    expect(metrics.workers['w2'].requestCount).toBe(2);
    expect(metrics.workers['w2'].errorCount).toBe(1);
    expect(metrics.workers['w2'].activeConnections).toBe(1);
    expect(metrics.workers['w2'].health).toBe('degraded');
    // No breaker registered for w2, should default to 'closed'
    expect(metrics.workers['w2'].circuitState).toBe('closed');
  });

  it('should trim ring buffer at MAX_RING_BUFFER_SIZE (10000)', () => {
    // Record more than 10000 requests
    for (let i = 0; i < 10050; i++) {
      collector.recordRequest(
        makeRequest({ id: `r${i}`, responseTime: i, endTime: Date.now() })
      );
    }

    const metrics = collector.getMetrics(emptyWorkers, emptyHealth, emptyBreakers);

    // After trimming, should have exactly 10000 requests
    expect(metrics.totalProxiedRequests).toBe(10000);
  });

  it('should clear all data on reset()', () => {
    collector.recordRequest(makeRequest({ id: 'r1' }));
    collector.recordRequest(makeRequest({ id: 'r2' }));

    collector.reset();

    const metrics = collector.getMetrics(emptyWorkers, emptyHealth, emptyBreakers);
    expect(metrics.totalProxiedRequests).toBe(0);
    expect(metrics.totalProxiedErrors).toBe(0);
    expect(metrics.activeConnections).toBe(0);
  });
});
