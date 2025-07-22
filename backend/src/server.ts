import { Server } from './types';

const BASE_RESPONSE_TIME = 50;
const PROCESSING_TIME_PER_REQUEST = 10;
const MAX_RESPONSE_TIME = 1000;
const SUCCESS_RATE_BASE = 0.98;

function generateServerId(): string {
  return `server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function createServer(name?: string, weight: number = 1, capacity: number = 100): Server {
  return {
    id: generateServerId(),
    name: name || `Server-${Math.floor(Math.random() * 1000)}`,
    host: 'localhost',
    port: 3000 + Math.floor(Math.random() * 1000),
    weight,
    capacity,
    isHealthy: true,
    metrics: {
      requestCount: 0,
      totalResponseTime: 0,
      errorCount: 0,
      activeConnections: 0,
      cpuUtilization: Math.random() * 10,
      memoryUtilization: Math.random() * 10,
      responseTimes: [],
      requestsThisInterval: 0,
    },
    createdAt: Date.now(),
  };
}

async function processRequest(server: Server): Promise<{ success: boolean; responseTime: number; error?: string }> {
  server.metrics.activeConnections++;

  const loadRatio = server.metrics.requestCount / server.capacity;
  const overloadFactor = Math.max(0, (loadRatio - 0.7) * 3);

  const baseTime = BASE_RESPONSE_TIME + (server.metrics.activeConnections * PROCESSING_TIME_PER_REQUEST);
  const loadPenalty = loadRatio * 100;
  const randomVariation = (Math.random() - 0.5) * 50;

  let responseTime = Math.max(10, baseTime + loadPenalty + randomVariation);
  responseTime = Math.min(MAX_RESPONSE_TIME, responseTime);

  await new Promise(resolve => setTimeout(resolve, responseTime / 10));

  server.metrics.activeConnections--;

  server.metrics.requestCount++;
  server.metrics.requestsThisInterval++;
  server.metrics.totalResponseTime += responseTime;

  if (server.metrics.responseTimes.length > 1000) {
    server.metrics.responseTimes.shift();
  }
  server.metrics.responseTimes.push(Math.floor(responseTime));

  const cpuIncrease = Math.random() * overloadFactor * 5;
  server.metrics.cpuUtilization = Math.min(100, server.metrics.cpuUtilization + cpuIncrease);
  server.metrics.cpuUtilization *= 0.95;

  const memoryIncrease = Math.random() * 2;
  server.metrics.memoryUtilization = Math.min(100, server.metrics.memoryUtilization + memoryIncrease);
  server.metrics.memoryUtilization *= 0.99;

  const successProbability = SUCCESS_RATE_BASE - (overloadFactor * 0.1);
  const success = Math.random() < successProbability;

  if (!success) {
    server.metrics.errorCount++;
  }

  await new Promise(resolve => setTimeout(resolve, 10));

  return {
    success,
    responseTime: Math.floor(responseTime),
    error: success ? undefined : 'Internal Service Error'
  };
}

/** Reset per-interval counters (called each metrics broadcast) */
function resetIntervalCounters(server: Server): void {
  server.metrics.requestsThisInterval = 0;
}

/** Full reset of all metrics (called on simulation stop) */
function resetServerMetrics(server: Server): void {
  server.metrics.requestCount = 0;
  server.metrics.totalResponseTime = 0;
  server.metrics.errorCount = 0;
  server.metrics.responseTimes = [];
  server.metrics.requestsThisInterval = 0;
  // Keep activeConnections — in-flight requests will decrement naturally
  // Reset CPU/memory to baseline
  server.metrics.cpuUtilization = Math.random() * 10;
  server.metrics.memoryUtilization = Math.random() * 10;
}

export { createServer, processRequest, generateServerId, resetIntervalCounters, resetServerMetrics };
