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

      this.currentIndex = (this.currentIndex + 1) % availableServers.length;
    }
  }
}

class LeastConnectionsAlgorithm extends LoadBalancingAlgorithm {
  getNextServer(): Server | null {
    const availableServers = this.servers.filter(s => s.isHealthy);
    if (availableServers.length === 0) return null;
    
    return availableServers.reduce((prev, current) => {
      return prev.metrics.activeConnections < current.metrics.activeConnections ? prev : current;
    });
  }
}

class IpHashAlgorithm extends LoadBalancingAlgorithm {
  getNextServer(clientIp?: string): Server | null {
    if (!clientIp) return null;
    
    const availableServers = this.servers.filter(s => s.isHealthy);
    if (availableServers.length === 0) return null;
    
    const hash = this.hashCode(clientIp);
    const index = Math.abs(hash) % availableServers.length;
    
    return availableServers[index];
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }
}

class RandomAlgorithm extends LoadBalancingAlgorithm {
  getNextServer(): Server | null {
    const availableServers = this.servers.filter(s => s.isHealthy);
    if (availableServers.length === 0) return null;
    
    const index = Math.floor(Math.random() * availableServers.length);
    return availableServers[index];
  }
}

function createLoadBalancer(algorithmType: string, servers: Server[], config: LoadBalancerConfig): LoadBalancingAlgorithm {
  switch (algorithmType) {
    case 'round-robin':
      return new RoundRobinAlgorithm(servers, config);
    case 'weighted-round-robin':
      return new WeightedRoundRobinAlgorithm(servers, config);
    case 'least-connections':
      return new LeastConnectionsAlgorithm(servers, config);
    case 'ip-hash':
      return new IpHashAlgorithm(servers, config);
    case 'random':
      return new RandomAlgorithm(servers, config);
    default:
      throw new Error(`Unknown algorithm: ${algorithmType}`);
  }
}

export { LoadBalancingAlgorithm, createLoadBalancer };