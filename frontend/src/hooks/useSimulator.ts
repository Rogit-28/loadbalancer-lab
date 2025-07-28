import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import { useLiveMode } from './useLiveMode';

export interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  weight: number;
  capacity: number;
  isHealthy: boolean;
  createdAt: number;
  metrics: {
    requestCount: number;
    totalResponseTime: number;
    errorCount: number;
    activeConnections: number;
    cpuUtilization: number;
    memoryUtilization: number;
    responseTimes: number[];
    requestsThisInterval: number;
  };
}

export interface ServerMetrics {
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

export interface Metrics {
  timestamp: number;
  servers: Record<string, ServerMetrics>;
  totalRequests: number;
  totalErrors: number;
  avgResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number;
  activeConnections: number;
}

export interface RequestLogEntry {
  id: string;
  timestamp: number;
  clientIp: string;
  serverName: string;
  serverId: string;
  responseTime: number;
  success: boolean;
  error?: string;
}

export interface AlgorithmComparisonResult {
  algorithm: string;
  totalRequests: number;
  avgResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  distributionStdDev: number;
  serverDistribution: { serverId: string; serverName: string; requests: number }[];
}

export interface ComparisonResponse {
  results: AlgorithmComparisonResult[];
  requestsPerAlgorithm: number;
  serverCount: number;
  timestamp: number;
}

export interface SimulationConfig {
  algorithm: 'round-robin' | 'weighted-round-robin' | 'least-connections' | 'ip-hash' | 'random';
  servers: Server[];
  traffic: {
    isRunning: boolean;
    rate: number;
    pattern: 'steady' | 'burst' | 'spike';
    speed: number;
  };
}

interface SimulatorState extends SimulationConfig {
  socket: Socket | null;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  metrics: Metrics | null;
  requestLog: RequestLogEntry[];
  comparisonResult: ComparisonResponse | null;
  comparisonLoading: boolean;
}

interface SimulatorActions {
  connect: (url?: string) => void;
  disconnect: () => void;
  updateAlgorithm: (algorithm: SimulationConfig['algorithm']) => void;
  updateTraffic: (config: Partial<SimulationConfig['traffic']>) => void;
  addServer: (name?: string, weight?: number, capacity?: number) => void;
  removeServer: (serverId: string) => void;
  updateServer: (serverId: string, updates: Partial<Server>) => void;
  toggleServerHealth: (serverId: string) => void;
  runComparison: (algorithms: string[], requestCount?: number) => void;
  start: () => void;
  stop: () => void;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const useSimulatorStore = create<SimulatorState & SimulatorActions>((set, get) => ({
  socket: null,
  status: 'disconnected',
  algorithm: 'round-robin',
  servers: [],
  traffic: {
    isRunning: false,
    rate: 100,
    pattern: 'steady',
    speed: 1
  },
  metrics: null,
  requestLog: [],
  comparisonResult: null,
  comparisonLoading: false,
