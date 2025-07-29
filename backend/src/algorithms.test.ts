import { describe, it, expect } from 'vitest';
import { createLoadBalancer } from './algorithms';
import { createServer } from './server';
import type { LoadBalancerConfig } from './types';

function makeServers(count: number) {
  return Array.from({ length: count }, (_, i) =>
    createServer(`Server-${i + 1}`, i + 1, 100)
  );
}

function makeConfig(algorithm: string, servers: ReturnType<typeof makeServers>): LoadBalancerConfig {
  return {
    algorithm: algorithm as LoadBalancerConfig['algorithm'],
    servers,
    traffic: { rate: 100, pattern: 'steady', speed: 1 },
  };
}

describe('RoundRobinAlgorithm', () => {
  it('should cycle through healthy servers', () => {
    const servers = makeServers(3);
    const config = makeConfig('round-robin', servers);
    const alg = createLoadBalancer('round-robin', servers, config);

    const results = Array.from({ length: 6 }, () => alg.getNextServer()?.name);
    // Should cycle: 1, 2, 3, 1, 2, 3
    expect(results).toEqual([
      'Server-1', 'Server-2', 'Server-3',
      'Server-1', 'Server-2', 'Server-3',
    ]);
  });

  it('should skip unhealthy servers', () => {
    const servers = makeServers(3);
    servers[1].isHealthy = false;
    const config = makeConfig('round-robin', servers);
    const alg = createLoadBalancer('round-robin', servers, config);
    alg.updateServers(servers);

    const results = Array.from({ length: 4 }, () => alg.getNextServer()?.name);
    expect(results.every(n => n !== 'Server-2')).toBe(true);
  });

  it('should return null when all servers are unhealthy', () => {
    const servers = makeServers(2);
    servers.forEach(s => (s.isHealthy = false));
    const config = makeConfig('round-robin', servers);
    const alg = createLoadBalancer('round-robin', servers, config);
    alg.updateServers(servers);

    expect(alg.getNextServer()).toBeNull();
  });
});

describe('WeightedRoundRobinAlgorithm', () => {
  it('should distribute according to weights', () => {
    const servers = makeServers(2);
    servers[0].weight = 3;
    servers[1].weight = 1;
    const config = makeConfig('weighted-round-robin', servers);
    const alg = createLoadBalancer('weighted-round-robin', servers, config);

    const counts: Record<string, number> = {};
    for (let i = 0; i < 400; i++) {
      const s = alg.getNextServer();
      if (s) counts[s.name] = (counts[s.name] || 0) + 1;
    }
