import { describe, it, expect } from 'vitest';
import { LoadBalancerSimulator } from './simulator';
import { createServer } from './server';
import type { LoadBalancerConfig } from './types';

function makeDefaultConfig(): LoadBalancerConfig {
  return {
    algorithm: 'round-robin',
    servers: [],
    traffic: { rate: 100, pattern: 'steady', speed: 1 },
  };
}

describe('LoadBalancerSimulator', () => {
  it('should initialize with default servers when none provided', () => {
    const sim = new LoadBalancerSimulator(makeDefaultConfig());
    expect(sim.getServers().length).toBe(3);
  });

  it('should add and remove servers', () => {
    const sim = new LoadBalancerSimulator(makeDefaultConfig());
    const initialCount = sim.getServers().length;

    const newServer = createServer('Test-Server', 2, 200);
    sim.addServer(newServer);
    expect(sim.getServers().length).toBe(initialCount + 1);

    sim.removeServer(newServer.id);
    expect(sim.getServers().length).toBe(initialCount);
  });

  it('should toggle server health', () => {
    const sim = new LoadBalancerSimulator(makeDefaultConfig());
    const servers = sim.getServers();
    const serverId = servers[0].id;

    expect(servers[0].isHealthy).toBe(true);
    sim.toggleServerHealth(serverId);
    expect(sim.getServers().find(s => s.id === serverId)?.isHealthy).toBe(false);
    sim.toggleServerHealth(serverId);
    expect(sim.getServers().find(s => s.id === serverId)?.isHealthy).toBe(true);
  });

  it('should update algorithm', () => {
    const sim = new LoadBalancerSimulator(makeDefaultConfig());
    expect(sim.getStatus().algorithm).toBe('round-robin');

    sim.updateConfig({ algorithm: 'least-connections' });
    expect(sim.getStatus().algorithm).toBe('least-connections');
  });

  it('should start and stop', () => {
    const sim = new LoadBalancerSimulator(makeDefaultConfig());
    sim.start();
    expect(sim.getStatus().isRunning).toBe(true);
    sim.stop();
    expect(sim.getStatus().isRunning).toBe(false);
  });

  it('should return system metrics', () => {
    const sim = new LoadBalancerSimulator(makeDefaultConfig());
    const metrics = sim.getMetrics();

    expect(metrics).toHaveProperty('timestamp');
    expect(metrics).toHaveProperty('servers');
    expect(metrics).toHaveProperty('totalRequests');
    expect(metrics).toHaveProperty('totalErrors');
    expect(metrics).toHaveProperty('avgResponseTime');
    expect(metrics).toHaveProperty('p50ResponseTime');
    expect(metrics).toHaveProperty('p95ResponseTime');
    expect(metrics).toHaveProperty('p99ResponseTime');
    expect(metrics).toHaveProperty('throughput');
    expect(metrics).toHaveProperty('activeConnections');
  });

  it('should have empty request log initially', () => {
    const sim = new LoadBalancerSimulator(makeDefaultConfig());
    expect(sim.getRequestLog()).toEqual([]);
  });
});

describe('LoadBalancerSimulator.runComparison', () => {
  it('should reject fewer than 2 algorithms', async () => {
    const sim = new LoadBalancerSimulator(makeDefaultConfig());
    await expect(sim.runComparison(['round-robin'])).rejects.toThrow('At least 2 valid algorithms');
  });

  it('should reject invalid algorithms', async () => {
    const sim = new LoadBalancerSimulator(makeDefaultConfig());
    await expect(sim.runComparison(['fake-algo', 'another-fake'])).rejects.toThrow('At least 2 valid algorithms');
  });

  it('should run comparison with valid algorithms', async () => {
    const sim = new LoadBalancerSimulator(makeDefaultConfig());
    const result = await sim.runComparison(['round-robin', 'random', 'least-connections'], 100);

    expect(result.results.length).toBe(3);
    expect(result.requestsPerAlgorithm).toBe(100);
    expect(result.serverCount).toBe(3);
    expect(result.timestamp).toBeGreaterThan(0);

    result.results.forEach(r => {
      expect(r.totalRequests).toBe(100);
      expect(r.avgResponseTime).toBeGreaterThan(0);
      expect(r.p50ResponseTime).toBeGreaterThan(0);
      expect(r.p95ResponseTime).toBeGreaterThan(0);
      expect(r.p99ResponseTime).toBeGreaterThan(0);
      expect(r.errorRate).toBeGreaterThanOrEqual(0);
      expect(r.distributionStdDev).toBeGreaterThanOrEqual(0);
      expect(r.serverDistribution.length).toBe(3);
    });
  });

  it('should sort results by avg response time', async () => {
    const sim = new LoadBalancerSimulator(makeDefaultConfig());
    const result = await sim.runComparison(['round-robin', 'random', 'least-connections'], 200);

    for (let i = 1; i < result.results.length; i++) {
      expect(result.results[i].avgResponseTime).toBeGreaterThanOrEqual(result.results[i - 1].avgResponseTime);
    }
  });

  it('should clamp request count', async () => {
    const sim = new LoadBalancerSimulator(makeDefaultConfig());
    const result = await sim.runComparison(['round-robin', 'random'], 10); // below min of 50
    expect(result.requestsPerAlgorithm).toBe(50);
  });

  it('should not interfere with main simulation state', async () => {
    const sim = new LoadBalancerSimulator(makeDefaultConfig());
    const serversBefore = sim.getServers().map(s => ({ ...s.metrics }));

    await sim.runComparison(['round-robin', 'random'], 100);

    const serversAfter = sim.getServers();
    serversAfter.forEach((s, i) => {
      expect(s.metrics.requestCount).toBe(serversBefore[i].requestCount);
    });
  });
});
