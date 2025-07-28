import { useEffect, useRef } from 'react';
import { AlgorithmSelector } from './components/AlgorithmSelector';
import { ServerList } from './components/ServerList';
import { TrafficControls } from './components/TrafficControls';
import { SimulationStatus } from './components/SimulationStatus';
import { MetricsCards } from './components/MetricsCards';
import { ServerDistribution } from './components/ServerDistribution';
import { RealTimeChart } from './components/RealTimeChart';
import { RequestLog } from './components/RequestLog';
import { AlgorithmComparison } from './components/AlgorithmComparison';
import { useSimulator } from './hooks/useSimulator';
import { ModeToggle } from './components/ModeToggle';
import { LiveModeStatus } from './components/LiveModeStatus';
import { WorkerManagement } from './components/WorkerManagement';
import { useLiveMode } from './hooks/useLiveMode';

function ConnectionIndicator() {
  const status = useSimulator((s) => s.status);

  const dotColor = {
    connected: 'bg-[hsl(var(--success-500))]',
    connecting: 'bg-[hsl(var(--warning-500))] animate-pulse',
    disconnected: 'bg-[hsl(var(--error-500))]',
    error: 'bg-[hsl(var(--error-500))]',
  }[status];

  const label = {
    connected: 'Connected',
    connecting: 'Connecting...',
    disconnected: 'Disconnected',
    error: 'Error',
  }[status];

  return (
    <div className="flex items-center space-x-2">
      <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
      <span className="text-xs text-text-dim uppercase tracking-wider">{label}</span>
    </div>
  );
}

function App() {
  const connect = useSimulator((s) => s.connect);
  const disconnect = useSimulator((s) => s.disconnect);
  const connectRef = useRef(connect);
  const disconnectRef = useRef(disconnect);
  const currentMode = useLiveMode((s) => s.currentMode);

  useEffect(() => {
    connectRef.current = connect;
    disconnectRef.current = disconnect;
  }, [connect, disconnect]);

  useEffect(() => {
    connectRef.current();
    return () => {
      disconnectRef.current();
    };
  }, []);

  return (
    <div className="min-h-screen bg-surface-50 p-6 overflow-auto">
      <header className="mb-8 border-b border-border-medium pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-text-primary mb-2 tracking-tight">
              LoadBalancer<span className="text-primary-500">Lab</span>
            </h1>
            <p className="text-text-tertiary max-w-2xl">
              Interactive educational tool for understanding distributed systems load balancing - simulation and live proxy modes
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <div className="px-4 py-2 bg-surface-100 rounded-lg border border-border-light">
              <span className="text-xs text-text-dim uppercase tracking-wider">Backend</span>
              <div className="text-sm text-text-secondary">localhost:3001</div>
              <ConnectionIndicator />
            </div>
          </div>
        </div>
      </header>

      <ModeToggle />
