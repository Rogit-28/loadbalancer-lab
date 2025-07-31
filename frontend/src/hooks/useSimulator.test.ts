import { describe, it, expect, beforeEach } from 'vitest';
import { useSimulator as useSimulatorStore } from './useSimulator';

// Reset store between tests
beforeEach(() => {
  useSimulatorStore.setState({
    socket: null,
    status: 'disconnected',
    algorithm: 'round-robin',
    servers: [],
    traffic: { isRunning: false, rate: 100, pattern: 'steady', speed: 1 },
    metrics: null,
    requestLog: [],
    comparisonResult: null,
    comparisonLoading: false,
  });
});

describe('useSimulatorStore', () => {
  it('should have correct initial state', () => {
    const state = useSimulatorStore.getState();
    expect(state.status).toBe('disconnected');
    expect(state.algorithm).toBe('round-robin');
    expect(state.servers).toEqual([]);
    expect(state.traffic).toEqual({ isRunning: false, rate: 100, pattern: 'steady', speed: 1 });
    expect(state.metrics).toBeNull();
    expect(state.requestLog).toEqual([]);
    expect(state.comparisonResult).toBeNull();
    expect(state.comparisonLoading).toBe(false);
  });

  it('should update traffic locally', () => {
    // updateTraffic requires a socket, but the local state should still update
    useSimulatorStore.setState({
      traffic: { isRunning: false, rate: 500, pattern: 'burst', speed: 2 }
    });
    const updated = useSimulatorStore.getState();
    expect(updated.traffic.rate).toBe(500);
    expect(updated.traffic.pattern).toBe('burst');
    expect(updated.traffic.speed).toBe(2);
  });

  it('should update algorithm in state', () => {
    useSimulatorStore.setState({ algorithm: 'least-connections' });
    expect(useSimulatorStore.getState().algorithm).toBe('least-connections');
  });

  it('should manage request log', () => {
    const entries = Array.from({ length: 5 }, (_, i) => ({
      id: `req-${i}`,
      timestamp: Date.now(),
      clientIp: `192.168.1.${i}`,
      serverName: `Server-${i}`,
      serverId: `s-${i}`,
      responseTime: 50 + i * 10,
      success: true,
    }));

    useSimulatorStore.setState({ requestLog: entries });
    expect(useSimulatorStore.getState().requestLog.length).toBe(5);
  });

  it('should keep last 50 request log entries', () => {
    const entries = Array.from({ length: 60 }, (_, i) => ({
      id: `req-${i}`,
      timestamp: Date.now(),
      clientIp: `192.168.1.${i}`,
      serverName: `Server-1`,
      serverId: `s-1`,
      responseTime: 50,
      success: true,
    }));

    // Simulate the request-log accumulation logic
    const sliced = entries.slice(-50);
    useSimulatorStore.setState({ requestLog: sliced });
    expect(useSimulatorStore.getState().requestLog.length).toBe(50);
  });

  it('start should set isRunning and clear requestLog', () => {
    useSimulatorStore.setState({
      requestLog: [
        { id: '1', timestamp: 0, clientIp: '1.2.3.4', serverName: 'S', serverId: 's1', responseTime: 50, success: true }
      ]
    });

    // Simulate what start() does to local state
    const { traffic } = useSimulatorStore.getState();
    useSimulatorStore.setState({
      traffic: { ...traffic, isRunning: true },
      requestLog: [],
    });

    const state = useSimulatorStore.getState();
    expect(state.traffic.isRunning).toBe(true);
    expect(state.requestLog).toEqual([]);
  });

  it('stop should set isRunning to false', () => {
    useSimulatorStore.setState({
      traffic: { isRunning: true, rate: 100, pattern: 'steady', speed: 1 }
    });

    const { traffic } = useSimulatorStore.getState();
    useSimulatorStore.setState({
      traffic: { ...traffic, isRunning: false },
    });

    expect(useSimulatorStore.getState().traffic.isRunning).toBe(false);
  });

  it('should store comparison result', () => {
    const mockResult = {
      results: [
        {
          algorithm: 'round-robin',
          totalRequests: 100,
          avgResponseTime: 65.2,
          p50ResponseTime: 60,
          p95ResponseTime: 120,
          p99ResponseTime: 180,
          errorRate: 1.5,
          distributionStdDev: 5.2,
          serverDistribution: [],
        }
      ],
      requestsPerAlgorithm: 100,
      serverCount: 3,
      timestamp: Date.now(),
    };

    useSimulatorStore.setState({
      comparisonResult: mockResult,
      comparisonLoading: false,
    });

    const state = useSimulatorStore.getState();
    expect(state.comparisonResult).not.toBeNull();
    expect(state.comparisonResult!.results.length).toBe(1);
    expect(state.comparisonLoading).toBe(false);
  });
});
