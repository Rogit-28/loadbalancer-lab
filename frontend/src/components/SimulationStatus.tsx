import { Play, Pause, Activity, Server } from 'lucide-react';
import { useSimulator } from '../hooks/useSimulator';

export function SimulationStatus() {
  const { status, traffic, algorithm, servers, start, stop } = useSimulator();

  const isRunning = traffic.isRunning;

  const handleToggle = () => {
    if (isRunning) {
      stop();
    } else {
      start();
    }
  };

  const statusColor = isRunning ? 'text-success' : 'text-error';
  const statusBgColor = isRunning ? 'bg-[hsl(142,50%,15%)]' : 'bg-surface-200';
  const borderColor = isRunning ? 'border-[hsl(var(--success-500))]' : 'border-border-light';

  return (
    <div className={`card p-6 border ${borderColor}`}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-text-primary">Simulation Status</h2>
        <button
          onClick={handleToggle}
          className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white transition-colors ${
            isRunning
              ? 'bg-[hsl(var(--error-500))] hover:opacity-80'
              : 'bg-[hsl(var(--success-500))] hover:opacity-80'
          }`}
        >
          {isRunning ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
          {isRunning ? 'Stop' : 'Start'}
        </button>
      </div>

      <div className="space-y-3">
        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusBgColor} ${statusColor}`}>
          <Activity className="w-4 h-4 mr-2" />
          {isRunning ? 'Running' : 'Stopped'}
        </div>

        <div className="flex items-center text-text-secondary">
          <span className="font-medium mr-2">Algorithm:</span>
          <span className="capitalize">{algorithm.replace(/-/g, ' ')}</span>
        </div>

        <div className="flex items-center text-text-secondary">
          <Server className="w-4 h-4 mr-2 text-text-dim" />
          <span className="font-medium mr-2">Servers:</span>
          <span>{servers.length}</span>
        </div>

        <div className="flex items-center text-text-secondary">
          <Activity className="w-4 h-4 mr-2 text-text-dim" />
          <span className="font-medium mr-2">Connection:</span>
          <span className="capitalize">{status}</span>
        </div>
      </div>
    </div>
  );
}
