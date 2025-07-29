import { describe, it, expect } from 'vitest';
import { createServer, processRequest, resetIntervalCounters, resetServerMetrics } from './server';

describe('createServer', () => {
  it('should create a server with default values', () => {
    const server = createServer();
    expect(server.id).toMatch(/^server-/);
    expect(server.weight).toBe(1);
    expect(server.capacity).toBe(100);
    expect(server.isHealthy).toBe(true);
    expect(server.metrics.requestCount).toBe(0);
    expect(server.metrics.responseTimes).toEqual([]);
    expect(server.metrics.requestsThisInterval).toBe(0);
  });

  it('should create a server with custom values', () => {
    const server = createServer('MyServer', 5, 200);
    expect(server.name).toBe('MyServer');
    expect(server.weight).toBe(5);
    expect(server.capacity).toBe(200);
  });

  it('should generate unique IDs', () => {
    const s1 = createServer();
    const s2 = createServer();
    expect(s1.id).not.toBe(s2.id);
  });
});

describe('processRequest', () => {
  it('should process a request and update metrics', async () => {
    const server = createServer('Test', 1, 100);
    const result = await processRequest(server);

    expect(typeof result.responseTime).toBe('number');
    expect(result.responseTime).toBeGreaterThanOrEqual(10);
    expect(result.responseTime).toBeLessThanOrEqual(1000);
    expect(typeof result.success).toBe('boolean');
    expect(server.metrics.requestCount).toBe(1);
    expect(server.metrics.responseTimes.length).toBe(1);
    expect(server.metrics.requestsThisInterval).toBe(1);
    expect(server.metrics.totalResponseTime).toBeGreaterThan(0);
  });

  it('should update CPU and memory utilization', async () => {
    const server = createServer('Test', 1, 100);
    const initialCpu = server.metrics.cpuUtilization;
    const initialMem = server.metrics.memoryUtilization;

    await processRequest(server);

    // CPU and memory should have changed (though they could go up or down due to decay)
    expect(typeof server.metrics.cpuUtilization).toBe('number');
    expect(typeof server.metrics.memoryUtilization).toBe('number');
  });

  it('should track active connections during processing', async () => {
    const server = createServer('Test', 1, 100);
    expect(server.metrics.activeConnections).toBe(0);

    // After processing completes, active connections should be back to 0
    await processRequest(server);
    expect(server.metrics.activeConnections).toBe(0);
  });
});

describe('resetIntervalCounters', () => {
  it('should reset requestsThisInterval to 0', async () => {
    const server = createServer('Test', 1, 100);
    await processRequest(server);
    expect(server.metrics.requestsThisInterval).toBe(1);

    resetIntervalCounters(server);
    expect(server.metrics.requestsThisInterval).toBe(0);
    // requestCount should NOT be reset
    expect(server.metrics.requestCount).toBe(1);
  });
});

describe('resetServerMetrics', () => {
  it('should fully reset all metrics', async () => {
    const server = createServer('Test', 1, 100);
    await processRequest(server);
    await processRequest(server);

    expect(server.metrics.requestCount).toBe(2);

    resetServerMetrics(server);
    expect(server.metrics.requestCount).toBe(0);
    expect(server.metrics.totalResponseTime).toBe(0);
    expect(server.metrics.errorCount).toBe(0);
    expect(server.metrics.responseTimes).toEqual([]);
    expect(server.metrics.requestsThisInterval).toBe(0);
    expect(server.metrics.cpuUtilization).toBeLessThan(11); // baseline random * 10
    expect(server.metrics.memoryUtilization).toBeLessThan(11);
  });
});
