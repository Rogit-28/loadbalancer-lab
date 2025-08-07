import { Play, Pause, Activity, Server, Zap } from 'lucide-react';
import { useLiveMode } from '../hooks/useLiveMode';

const ALGORITHMS = [
  'round-robin',
  'weighted-round-robin',
  'least-connections',
  'ip-hash',
  'random'
];

export function LiveModeStatus() {
  const { isLiveRunning, startLive, stopLive, liveMetrics, workers, algorithm, updateLiveAlgorithm } = useLiveMode();

  const handleToggle = () => {
    if (isLiveRunning) {
      stopLive();
    } else {
      startLive();
    }
  };

  const statusColor = isLiveRunning ? 'text-success' : 'text-error';
  const statusBgColor = isLiveRunning ? 'bg-[hsl(142,50%,15%)]' : 'bg-surface-200';
  const borderColor = isLiveRunning ? 'border-[hsl(var(--success-500))]' : 'border-border-light';

  const proxyPort = liveMetrics?.proxyPort || '8080';

  return (
    <div className={`card p-6 border ${borderColor}`}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-text-primary">Live Mode Status</h2>
        <button
          onClick={handleToggle}
          className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white transition-colors ${
            isLiveRunning
              ? 'bg-[hsl(var(--error-500))] hover:opacity-80'
              : 'bg-[hsl(var(--success-500))] hover:opacity-80'
          }`}
        >
          {isLiveRunning ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
          {isLiveRunning ? 'Stop' : 'Start'}
        </button>
      </div>

      <div className="space-y-4">
        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusBgColor} ${statusColor}`}>
          <Activity className="w-4 h-4 mr-2" />
          {isLiveRunning ? 'Running' : 'Stopped'}
        </div>

        <div className="flex items-center text-text-secondary">
          <Zap className="w-4 h-4 mr-2 text-text-dim" />
          <span className="font-medium mr-2">Proxy Port:</span>
          <span className="font-mono">:{proxyPort}</span>
        </div>

        <div className="flex items-center text-text-secondary">
          <Server className="w-4 h-4 mr-2 text-text-dim" />
          <span className="font-medium mr-2">Workers:</span>
          <span>{workers.length}</span>
        </div>

        <div className="pt-2 border-t border-border-light">
          <label className="block text-xs font-medium text-text-secondary mb-2">Algorithm</label>
          <div className="flex flex-wrap gap-2">
            {ALGORITHMS.map((alg) => (
              <button
                key={alg}
                onClick={() => updateLiveAlgorithm(alg)}
                className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
                  algorithm === alg
                    ? 'bg-primary-500 text-white'
                    : 'bg-surface-200 text-text-secondary hover:bg-surface-300'
                }`}
              >
                {alg.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()).substring(0, 15)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
