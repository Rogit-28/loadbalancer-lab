import { LiveModeConfig } from './types';

/** Centralized configuration for the LoadBalancer system */
const config = {
  /** Backend WebSocket/API server port */
  serverPort: parseInt(process.env.PORT || '3001', 10),

  /** Live mode defaults */
  live: {
    proxyPort: parseInt(process.env.PROXY_PORT || '8080', 10),
    workerBasePort: parseInt(process.env.WORKER_BASE_PORT || '4001', 10),
    workerCount: parseInt(process.env.WORKER_COUNT || '3', 10),
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '2000', 10),
    circuitBreaker: {
      failureThreshold: parseInt(process.env.CB_FAILURE_THRESHOLD || '5', 10),
      resetTimeout: parseInt(process.env.CB_RESET_TIMEOUT || '30000', 10),
      halfOpenMaxRequests: parseInt(process.env.CB_HALF_OPEN_MAX || '3', 10),
    },
  } satisfies LiveModeConfig,

  /** Simulation mode defaults */
  simulation: {
    defaultAlgorithm: 'round-robin' as const,
    defaultServerCount: 3,
    defaultTrafficRate: 100,
    defaultTrafficPattern: 'steady' as const,
    defaultSpeed: 1,
    maxServers: 10,
    maxTrafficRate: 10000,
  },

  /** Metrics broadcast settings */
  metrics: {
    broadcastInterval: 1000,
    requestLogBatchInterval: 250,
    requestLogMaxBatch: 20,
    requestLogMaxEntries: 100,
    responseTimeHistoryLimit: 1000,
  },

  /** Worker server settings */
  worker: {
    shutdownTimeout: 5000,
    startupTimeout: 10000,
    maxWorkers: 10,
    defaultWeight: 1,
    defaultCapacity: 100,
  },
} as const;

export { config };
