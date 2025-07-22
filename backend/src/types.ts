interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  weight: number;
  capacity: number;
  isHealthy: boolean;
  metrics: {
    requestCount: number;
    totalResponseTime: number;
    errorCount: number;
    activeConnections: number;
    cpuUtilization: number;
    memoryUtilization: number;
    responseTimes: number[];
    /** Requests processed in the current metrics interval */
    requestsThisInterval: number;
  };
  createdAt: number;
}

interface TrafficConfig {
  rate: number;
  pattern: 'steady' | 'burst' | 'spike';
  speed: number;
}

interface LoadBalancerConfig {
  algorithm: 'round-robin' | 'weighted-round-robin' | 'least-connections' | 'ip-hash' | 'random';
  servers: Server[];
  traffic: TrafficConfig;
}
