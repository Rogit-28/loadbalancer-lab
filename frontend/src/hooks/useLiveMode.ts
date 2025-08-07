import type { Socket } from 'socket.io-client';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

export interface WorkerInfo {
  id: string;
  name: string;
  host: string;
  port: number;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'errored';
  weight: number;
  capacity: number;
  health: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  circuitState: 'closed' | 'open' | 'half-open';
  requestCount: number;
  errorCount: number;
  avgResponseTime: number;
  activeConnections: number;
}

export interface LiveMetrics {
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
  workers: Record<string, {
    status: string;
    health: string;
    circuitState: string;
    requestCount: number;
    errorCount: number;
    avgResponseTime: number;
    activeConnections: number;
  }>;
}

export interface LiveRequestLogEntry {
  id: string;
  method: string;
  url: string;
  clientIp: string;
  targetWorkerId: string;
  responseTime: number;
  statusCode: number;
  success: boolean;
}

export interface LiveModeState {
  currentMode: 'simulation' | 'live';
  isLiveRunning: boolean;
  canSwitch: boolean;
  workers: WorkerInfo[];
  liveMetrics: LiveMetrics | null;
  liveRequestLog: LiveRequestLogEntry[];
  algorithm: 'round-robin' | 'weighted-round-robin' | 'least-connections' | 'ip-hash' | 'random';
  socket: Socket | null;
}

interface LiveModeActions {
  setupLiveModeListeners: (socket: Socket) => void;
  removeLiveModeListeners: (socket: Socket) => void;
  switchMode: (mode: 'simulation' | 'live') => void;
  startLive: () => void;
  stopLive: () => void;
  addWorker: (name?: string, weight?: number, capacity?: number) => void;
  removeWorker: (workerId: string) => void;
  updateLiveAlgorithm: (algorithm: string) => void;
}

const useLiveModeStore = create<LiveModeState & LiveModeActions>((set, get) => ({
  currentMode: 'simulation',
  isLiveRunning: false,
  canSwitch: true,
  workers: [],
  liveMetrics: null,
  liveRequestLog: [],
  algorithm: 'round-robin',
  socket: null,

  setupLiveModeListeners: (socket: Socket) => {
    set({ socket });

    socket.on('mode-update', (data: any) => {
      set({
        currentMode: data.mode || 'simulation',
        canSwitch: data.canSwitch !== undefined ? data.canSwitch : true,
        algorithm: data.algorithm || 'round-robin'
      });
    });

    socket.on('live-metrics-update', (data: LiveMetrics) => {
      set({ liveMetrics: data });
    });

    socket.on('live-workers-update', (data: WorkerInfo[]) => {
      set({ workers: data });
    });

    socket.on('live-request-log', (batch: LiveRequestLogEntry[]) => {
      set(state => {
        const updated = [...state.liveRequestLog, ...batch];
        // Keep last 50 entries in the frontend
        return { liveRequestLog: updated.slice(-50) };
      });
    });
  },

  removeLiveModeListeners: (socket: Socket) => {
    socket.off('mode-update');
    socket.off('live-metrics-update');
    socket.off('live-workers-update');
    socket.off('live-request-log');
  },

  switchMode: (mode: 'simulation' | 'live') => {
    const { socket } = get();
    socket?.emit('switch-mode', { mode });
  },

  startLive: () => {
    const { socket } = get();
    socket?.emit('live-start');
    set({ isLiveRunning: true, liveRequestLog: [] });
  },

  stopLive: () => {
    const { socket } = get();
    socket?.emit('live-stop');
    set({ isLiveRunning: false });
  },

  addWorker: (name, weight = 1, capacity = 100) => {
    const { socket } = get();
    socket?.emit('live-add-worker', { name, weight, capacity });
  },

  removeWorker: (workerId: string) => {
    const { socket } = get();
    socket?.emit('live-remove-worker', { workerId });
  },

  updateLiveAlgorithm: (algorithm: string) => {
    const { socket } = get();
    socket?.emit('live-update-algorithm', { algorithm });
    set({ algorithm: algorithm as any });
  }
}));

export const useLiveMode = useLiveModeStore;

export const useLiveModeData = () => {
  return useLiveModeStore(
    useShallow((state) => ({
      currentMode: state.currentMode,
      isLiveRunning: state.isLiveRunning,
      canSwitch: state.canSwitch,
      workers: state.workers,
      liveMetrics: state.liveMetrics,
      liveRequestLog: state.liveRequestLog,
      algorithm: state.algorithm
    }))
  );
};
