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

  constructor(servers: Server[], config: LoadBalancerConfig) {
    super(servers, config);
    this.calculateWeights();
  }

  private calculateWeights(): void {
    this.maxWeight = Math.max(...this.servers.map(s => s.weight));
    this.gcd = this.servers.reduce((a, b) => this.gcdTwoNumbers(a, b.weight), this.servers[0]?.weight || 1);
  }

  private gcdTwoNumbers(a: number, b: number): number {
    return b === 0 ? a : this.gcdTwoNumbers(b, a % b);
  }

  updateServers(servers: Server[]): void {
    super.updateServers(servers);
    this.calculateWeights();
  }

  getNextServer(): Server | null {
    const availableServers = this.servers.filter(s => s.isHealthy);
    if (availableServers.length === 0) return null;

    while (true) {
      if (this.currentIndex === 0) {
        this.currentWeight = this.currentWeight - this.gcd;
        if (this.currentWeight <= 0) {
          this.currentWeight = this.maxWeight;
          if (this.currentWeight === 0) return null;
        }
      }

      const server = availableServers[this.currentIndex];
      if (server.weight >= this.currentWeight) {
        this.currentIndex = (this.currentIndex + 1) % availableServers.length;
        return server;
      }