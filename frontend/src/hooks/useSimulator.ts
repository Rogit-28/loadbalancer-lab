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

  connect: (url = BACKEND_URL) => {
    if (get().socket) return;
    const socket = io(url, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000
    });

    set({ status: 'connecting' });

    socket.on('connect', () => {
      console.log('Connected to server');
      set({ status: 'connected' });
      socket.emit('get-config');
      socket.emit('get-mode');
      // Setup live mode listeners
      useLiveMode.getState().setupLiveModeListeners(socket);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      set({ status: 'disconnected' });
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      set({ status: 'error' });
    });

    socket.on('config-update', (data: any) => {
      set({
        algorithm: data.algorithm || 'round-robin',
        servers: data.servers || [],
        traffic: { ...get().traffic, ...data.traffic }
      });
    });

    socket.on('metrics-update', (data: Metrics) => {
      set({ metrics: data });
    });

    socket.on('request-log', (batch: RequestLogEntry[]) => {
      set(state => {
        const updated = [...state.requestLog, ...batch];
        // Keep last 50 entries in the frontend
        return { requestLog: updated.slice(-50) };
      });
    });

    socket.on('error', (data: { message: string }) => {
      console.error('Server error:', data.message);
    });

    socket.on('comparison-result', (data: ComparisonResponse) => {
      set({ comparisonResult: data, comparisonLoading: false });
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      useLiveMode.getState().removeLiveModeListeners(socket);
      socket.removeAllListeners();
      socket.disconnect();
      set({ socket: null, status: 'disconnected' });
    }
  },

  updateAlgorithm: (algorithm) => {
    const { socket } = get();
    socket?.emit('update-algorithm', { algorithm });
  },

  updateTraffic: (config) => {
    const { socket, traffic } = get();
    const updated = { ...traffic, ...config };
    set({ traffic: updated });
    socket?.emit('update-traffic', updated);
  },

  addServer: (name, weight = 1, capacity = 100) => {
    const { socket } = get();
    socket?.emit('add-server', { name, weight, capacity });
  },

  removeServer: (serverId) => {
    const { socket } = get();
    socket?.emit('remove-server', { serverId });
  },

  updateServer: (serverId, updates) => {
    const { socket } = get();
    socket?.emit('update-server', { serverId, ...updates });
  },

  toggleServerHealth: (serverId) => {
    const { socket } = get();
    socket?.emit('toggle-health', { serverId });
  },

  runComparison: (algorithms, requestCount = 500) => {
    const { socket } = get();
    if (!socket) return;
    set({ comparisonLoading: true, comparisonResult: null });
    socket.emit('run-comparison', { algorithms, requestCount });
  },

  start: () => {
    const { socket, traffic } = get();
    const updated = { ...traffic, isRunning: true };
    set({ traffic: updated, requestLog: [] });
    socket?.emit('start-simulation');
  },

  stop: () => {
    const { socket, traffic } = get();
    const updated = { ...traffic, isRunning: false };
    set({ traffic: updated });
    socket?.emit('stop-simulation');
  }
}));

export const useSimulator = useSimulatorStore;

export const useSimulatorData = () => {
  return useSimulatorStore(
    useShallow((state) => ({
      status: state.status,
      algorithm: state.algorithm,
      servers: state.servers,
      traffic: state.traffic,
      metrics: state.metrics,
      requestLog: state.requestLog,
      comparisonResult: state.comparisonResult,
      comparisonLoading: state.comparisonLoading,
    }))
  );
};
