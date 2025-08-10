import { describe, it, expect } from 'vitest';
import { config } from './config';

describe('config', () => {
  it('serverPort defaults to 3001', () => {
    expect(config.serverPort).toBe(3001);
  });

  it('live.proxyPort defaults to 8080', () => {
    expect(config.live.proxyPort).toBe(8080);
  });

  it('live.workerBasePort defaults to 4001', () => {
    expect(config.live.workerBasePort).toBe(4001);
  });

  it('live.workerCount defaults to 3', () => {
    expect(config.live.workerCount).toBe(3);
  });

  it('worker.maxWorkers is 10', () => {
    expect(config.worker.maxWorkers).toBe(10);
  });

  it('live.healthCheckInterval defaults to 2000', () => {
    expect(config.live.healthCheckInterval).toBe(2000);
  });

  it('live.circuitBreaker has correct defaults', () => {
    expect(config.live.circuitBreaker.failureThreshold).toBe(5);
    expect(config.live.circuitBreaker.resetTimeout).toBe(30000);
    expect(config.live.circuitBreaker.halfOpenMaxRequests).toBe(3);
  });

  it('simulation has correct defaults', () => {
    expect(config.simulation.defaultAlgorithm).toBe('round-robin');
    expect(config.simulation.defaultServerCount).toBe(3);
    expect(config.simulation.defaultTrafficRate).toBe(100);
    expect(config.simulation.maxServers).toBe(10);
    expect(config.simulation.maxTrafficRate).toBe(10000);
  });

  it('metrics broadcast interval is 1000ms', () => {
    expect(config.metrics.broadcastInterval).toBe(1000);
  });

  it('worker shutdown timeout is 5000ms', () => {
    expect(config.worker.shutdownTimeout).toBe(5000);
  });
});
