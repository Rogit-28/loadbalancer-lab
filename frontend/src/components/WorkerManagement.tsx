import { useState } from 'react';
import { Database, Plus, X, AlertCircle } from 'lucide-react';
import { useLiveMode } from '../hooks/useLiveMode';

export function WorkerManagement() {
  const { workers, addWorker, removeWorker: removeWorkerAction } = useLiveMode();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerWeight, setNewWorkerWeight] = useState(1);
  const [newWorkerCapacity, setNewWorkerCapacity] = useState(100);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const handleAddWorker = () => {
    const name = newWorkerName.trim() || `Worker-${workers.length + 1}`;
    addWorker(name, newWorkerWeight, newWorkerCapacity);
    setNewWorkerName('');
    setNewWorkerWeight(1);
    setNewWorkerCapacity(100);
    setShowAddForm(false);
  };

  const handleRemoveWorker = (workerId: string) => {
    removeWorkerAction(workerId);
    setConfirmRemoveId(null);
  };




  const getCircuitStateColor = (state: string) => {
    switch (state) {
      case 'closed':
        return 'text-success';
      case 'open':
        return 'text-error';
      case 'half-open':
        return 'text-warning';
      default:
        return 'text-text-dim';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-[hsl(var(--success-500))] text-white';
      case 'stopped':
        return 'bg-surface-300 text-text-secondary';
      case 'errored':
        return 'bg-[hsl(var(--error-500))] text-white';
      default:
        return 'bg-surface-300 text-text-secondary';
    }
  };

  return (
    <div className="lg:col-span-2 card p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-text-primary">
          <Database className="inline w-5 h-5 mr-2" />
          Workers
        </h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn btn-primary text-sm flex items-center"
        >
          {showAddForm ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
          {showAddForm ? 'Cancel' : 'Add Worker'}
        </button>
      </div>

      {/* Inline Add Worker Form */}
      {showAddForm && (
        <div className="mb-4 p-4 bg-surface-200 rounded-lg border border-border-light">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Name</label>
              <input
                type="text"
                value={newWorkerName}
                onChange={(e) => setNewWorkerName(e.target.value)}
                placeholder={`Worker-${workers.length + 1}`}
                className="w-full px-3 py-2 bg-surface-100 border border-border-light rounded-lg text-text-primary text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Weight: {newWorkerWeight}</label>
              <input
                type="range"
                min="1"
                max="10"
                value={newWorkerWeight}
                onChange={(e) => setNewWorkerWeight(Number(e.target.value))}
                className="w-full h-2 bg-surface-400 rounded-lg mt-2"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Capacity: {newWorkerCapacity}</label>
              <input
                type="range"
                min="50"
                max="200"
                step="10"
                value={newWorkerCapacity}
                onChange={(e) => setNewWorkerCapacity(Number(e.target.value))}
                className="w-full h-2 bg-surface-400 rounded-lg mt-2"
              />
            </div>
          </div>
          <button
            onClick={handleAddWorker}
            className="btn btn-primary text-sm w-full"
          >
            Add Worker
          </button>
        </div>
      )}

      <div className="space-y-3">
        {workers.length === 0 ? (
          <p className="text-text-dim text-center py-4">No workers configured</p>
        ) : (
          workers.map((worker) => (
            <div
              key={worker.id}
              className={`border rounded-lg p-4 transition-colors ${
                worker.health === 'healthy'
                  ? 'border-border-light bg-surface-100'
                  : 'border-[hsl(var(--error-500))] bg-[hsl(0,50%,12%)]'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-semibold text-text-primary">{worker.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadgeColor(worker.status)}`}>
                    {worker.status.replace(/-/g, ' ')}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    worker.health === 'healthy'
                      ? 'bg-[hsl(var(--success-500))] text-white'
                      : worker.health === 'unhealthy'
                      ? 'bg-[hsl(var(--error-500))] text-white'
                      : worker.health === 'degraded'
                      ? 'bg-[hsl(var(--warning-500))] text-white'
                      : 'bg-surface-400 text-text-secondary'
                  }`}>
                    {worker.health}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {confirmRemoveId === worker.id ? (
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-text-dim">Remove?</span>
                      <button
                        onClick={() => handleRemoveWorker(worker.id)}
                        className="text-xs px-2 py-1 rounded bg-[hsl(var(--error-500))] text-white hover:opacity-80"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmRemoveId(null)}
                        className="text-xs px-2 py-1 rounded bg-surface-300 text-text-secondary hover:bg-surface-400"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmRemoveId(worker.id)}
                      className="text-error hover:opacity-80 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div className="mb-3 p-2 bg-surface-200 rounded border border-border-light">
                <div className="flex items-center text-sm text-text-secondary space-x-3">
                  <span className="font-mono text-xs">{worker.host}:{worker.port}</span>
                  <span className="flex items-center">
                    <AlertCircle className={`w-4 h-4 mr-1 ${getCircuitStateColor(worker.circuitState)}`} />
                    <span className={`font-medium ${getCircuitStateColor(worker.circuitState)}`}>
                      {worker.circuitState === 'closed' ? 'OK' : worker.circuitState === 'open' ? 'TRIPPED' : 'TESTING'}
                    </span>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Weight: {worker.weight}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={worker.weight}
                    className="w-full h-2 bg-surface-400 rounded-lg"
                    readOnly
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Capacity: {worker.capacity}
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="200"
                    step="10"
                    value={worker.capacity}
                    className="w-full h-2 bg-surface-400 rounded-lg"
                    readOnly
                  />
                </div>
              </div>

              <div className="mt-3 flex items-center text-sm flex-wrap gap-3">
                <span className="text-text-tertiary">Requests: {worker.requestCount}</span>
                <span className="text-text-tertiary">Errors: {worker.errorCount}</span>
                <span className="text-text-tertiary">
                  Avg Response: {worker.avgResponseTime.toFixed(1)}ms
                </span>
                <span className="text-text-tertiary">
                  Active Connections: {worker.activeConnections}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
