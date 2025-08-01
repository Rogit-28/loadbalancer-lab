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

interface ServerMetrics {
  requestRate: number;
  avgResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  activeConnections: number;
  cpuUtilization: number;
  memoryUtilization: number;
  errorRate: number;
  requestDistribution: number;
}

interface SystemMetrics {
  timestamp: number;
  servers: {
    [serverId: string]: ServerMetrics;
  };
  totalRequests: number;
  totalErrors: number;
  avgResponseTime: number;
  /** System-wide percentiles aggregated from all servers' response times */
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  /** Aggregate requests per second across all servers */
  throughput: number;
  /** Total active connections across all servers */
  activeConnections: number;
}

/** A single request log entry for the live activity feed */
interface RequestLogEntry {
  id: string;
  timestamp: number;
  clientIp: string;
  serverName: string;
  serverId: string;
  responseTime: number;
  success: boolean;
  error?: string;
}

/** Result for a single algorithm in a comparison run */
interface AlgorithmComparisonResult {
  algorithm: string;
  totalRequests: number;
  avgResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  /** Standard deviation of request distribution across servers (lower = fairer) */
  distributionStdDev: number;
  /** Per-server request counts for distribution visualization */
  serverDistribution: { serverId: string; serverName: string; requests: number }[];
}

/** Full comparison response sent to the client */
interface ComparisonResponse {
  results: AlgorithmComparisonResult[];
  requestsPerAlgorithm: number;
  serverCount: number;
  timestamp: number;
}

// ─── Live Mode Types ─────────────────────────────────────────────────────────

type SystemMode = 'simulation' | 'live';

interface LiveModeConfig {
  proxyPort: number;
  workerBasePort: number;
  workerCount: number;
  healthCheckInterval: number;
  circuitBreaker: {
    failureThreshold: number;
    resetTimeout: number;
    halfOpenMaxRequests: number;
  };
}

type WorkerStatus = 'starting' | 'running' | 'stopping' | 'stopped' | 'errored';

interface WorkerProcess {
  id: string;
  name: string;
  host: string;
  port: number;
  pid: number | null;
  status: WorkerStatus;
  weight: number;
  capacity: number;
  startedAt: number | null;
  /** Cumulative uptime in ms (excludes downtime periods) */
  uptime: number;
}

type HealthStatus = 'healthy' | 'unhealthy' | 'degraded' | 'unknown';

interface HealthCheckResult {
  workerId: string;
  status: HealthStatus;
  responseTime: number;
  timestamp: number;
  statusCode: number | null;
  error?: string;
}

interface ProxyRequest {
  id: string;
  method: string;
  url: string;
  clientIp: string;
  targetWorkerId: string;
  targetHost: string;
  targetPort: number;
  startTime: number;
  endTime: number | null;
  responseTime: number | null;
  statusCode: number | null;
  success: boolean;
  error?: string;
}

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerState {
  workerId: string;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  lastStateChange: number;
  nextRetryTime: number | null;
}

interface LiveMetrics {
  timestamp: number;
  proxyPort: number;
  totalProxiedRequests: number;
  totalProxiedErrors: number;
  avgProxyResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  activeConnections: number;
  throughput: number;
  workers: {
    [workerId: string]: {
      status: WorkerStatus;
      health: HealthStatus;
      circuitState: CircuitState;
      requestCount: number;
      errorCount: number;
      avgResponseTime: number;
      activeConnections: number;
    };
  };
}

interface LiveModeState {
  mode: 'live';
  config: LiveModeConfig;
  isRunning: boolean;
  workers: WorkerProcess[];
  metrics: LiveMetrics | null;
  circuitBreakers: CircuitBreakerState[];
}

interface ModeStatus {
  currentMode: SystemMode;
  isRunning: boolean;
  canSwitch: boolean;
}

export {
  Server, TrafficConfig, LoadBalancerConfig, ServerMetrics, SystemMetrics,
  RequestLogEntry, AlgorithmComparisonResult, ComparisonResponse,
  // Live mode types
  SystemMode, LiveModeConfig, WorkerStatus, WorkerProcess,
  HealthStatus, HealthCheckResult, ProxyRequest,
  CircuitState, CircuitBreakerState, LiveMetrics, LiveModeState, ModeStatus
};
