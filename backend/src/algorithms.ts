import { Server, LoadBalancerConfig } from './types';

abstract class LoadBalancingAlgorithm {
  protected servers: Server[];
  protected config: LoadBalancerConfig;

  constructor(servers: Server[], config: LoadBalancerConfig) {
    this.servers = [...servers];
    this.config = { ...config };
  }

  updateServers(servers: Server[]): void {
    this.servers = [...servers];
  }

  abstract getNextServer(clientIp?: string): Server | null;
}

class RoundRobinAlgorithm extends LoadBalancingAlgorithm {
  private currentIndex: number = 0;

  getNextServer(): Server | null {
    const availableServers = this.servers.filter(s => s.isHealthy);
    if (availableServers.length === 0) return null;
    const server = availableServers[this.currentIndex % availableServers.length];
    this.currentIndex = (this.currentIndex + 1) % availableServers.length;
    return server;
  }
}

class WeightedRoundRobinAlgorithm extends LoadBalancingAlgorithm {
  private currentIndex: number = 0;
  private currentWeight: number = 0;
  private gcd: number = 1;
  private maxWeight: number = 0;
