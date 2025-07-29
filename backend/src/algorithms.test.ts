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

    // Server-1 (weight 3) should get roughly 3x the requests of Server-2 (weight 1)
    const ratio = (counts['Server-1'] || 0) / (counts['Server-2'] || 1);
    expect(ratio).toBeGreaterThan(2);
    expect(ratio).toBeLessThan(4);
  });
});

describe('LeastConnectionsAlgorithm', () => {
  it('should pick server with fewest active connections', () => {
    const servers = makeServers(3);
    servers[0].metrics.activeConnections = 10;
    servers[1].metrics.activeConnections = 2;
    servers[2].metrics.activeConnections = 5;
    const config = makeConfig('least-connections', servers);
    const alg = createLoadBalancer('least-connections', servers, config);

    const picked = alg.getNextServer();
    expect(picked?.name).toBe('Server-2');
  });
});

describe('IpHashAlgorithm', () => {
  it('should consistently route the same IP to the same server', () => {
    const servers = makeServers(3);
    const config = makeConfig('ip-hash', servers);
    const alg = createLoadBalancer('ip-hash', servers, config);

    const ip = '192.168.1.42';
    const first = alg.getNextServer(ip);
    const second = alg.getNextServer(ip);
    const third = alg.getNextServer(ip);

    expect(first?.id).toBe(second?.id);
    expect(second?.id).toBe(third?.id);
  });

  it('should return null without clientIp', () => {
    const servers = makeServers(3);
    const config = makeConfig('ip-hash', servers);
    const alg = createLoadBalancer('ip-hash', servers, config);

    expect(alg.getNextServer()).toBeNull();
  });
});

describe('RandomAlgorithm', () => {
  it('should distribute across all healthy servers', () => {
    const servers = makeServers(3);
    const config = makeConfig('random', servers);
    const alg = createLoadBalancer('random', servers, config);

    const counts: Record<string, number> = {};
    for (let i = 0; i < 300; i++) {
      const s = alg.getNextServer();
      if (s) counts[s.name] = (counts[s.name] || 0) + 1;
    }

    // All 3 servers should have received at least some requests
    expect(Object.keys(counts).length).toBe(3);
    Object.values(counts).forEach(c => {
      expect(c).toBeGreaterThan(30); // at least ~10% each
    });
  });
});

describe('createLoadBalancer', () => {
  it('should throw on unknown algorithm', () => {
    const servers = makeServers(1);
    const config = makeConfig('unknown', servers);
    expect(() => createLoadBalancer('unknown', servers, config)).toThrow('Unknown algorithm');
  });
});
