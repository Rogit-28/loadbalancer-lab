import { useState } from 'react';
import { Database, Plus, X, Heart, HeartOff } from 'lucide-react';
import { useSimulator } from '../hooks/useSimulator';

export function ServerList() {
  const { servers, addServer, removeServer: removeServerAction, updateServer, toggleServerHealth } = useSimulator();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [newServerWeight, setNewServerWeight] = useState(1);
  const [newServerCapacity, setNewServerCapacity] = useState(100);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const handleAddServer = () => {
    const name = newServerName.trim() || `Server-${servers.length + 1}`;
    addServer(name, newServerWeight, newServerCapacity);
    setNewServerName('');
    setNewServerWeight(1);
    setNewServerCapacity(100);
    setShowAddForm(false);
  };

  const handleRemoveServer = (serverId: string) => {
    removeServerAction(serverId);
    setConfirmRemoveId(null);
  };

  const updateServerWeight = (serverId: string, weight: number) => {
    updateServer(serverId, { weight });
  };

  const updateServerCapacity = (serverId: string, capacity: number) => {
    updateServer(serverId, { capacity });
  };

  return (
    <div className="lg:col-span-2 card p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-text-primary">
          <Database className="inline w-5 h-5 mr-2" />
          Servers
        </h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn btn-primary text-sm flex items-center"
        >
          {showAddForm ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
          {showAddForm ? 'Cancel' : 'Add Server'}
        </button>
      </div>

      {/* Inline Add Server Form */}
      {showAddForm && (
        <div className="mb-4 p-4 bg-surface-200 rounded-lg border border-border-light">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Name</label>
              <input
                type="text"
                value={newServerName}
                onChange={(e) => setNewServerName(e.target.value)}
                placeholder={`Server-${servers.length + 1}`}
                className="w-full px-3 py-2 bg-surface-100 border border-border-light rounded-lg text-text-primary text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Weight: {newServerWeight}</label>
              <input
                type="range"
                min="1"
                max="10"
                value={newServerWeight}
                onChange={(e) => setNewServerWeight(Number(e.target.value))}
                className="w-full h-2 bg-surface-400 rounded-lg mt-2"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Capacity: {newServerCapacity}</label>
              <input
                type="range"
                min="50"
                max="200"
                step="10"
                value={newServerCapacity}
                onChange={(e) => setNewServerCapacity(Number(e.target.value))}
                className="w-full h-2 bg-surface-400 rounded-lg mt-2"
              />
            </div>
          </div>
          <button
            onClick={handleAddServer}
            className="btn btn-primary text-sm w-full"
          >
            Add Server
          </button>
        </div>
      )}

      <div className="space-y-3">
        {servers.length === 0 ? (
          <p className="text-text-dim text-center py-4">No servers configured</p>
        ) : (
          servers.map((server) => (
            <div
              key={server.id}
              className={`border rounded-lg p-4 transition-colors ${
                server.isHealthy
                  ? 'border-border-light bg-surface-100'
                  : 'border-[hsl(var(--error-500))] bg-[hsl(0,50%,12%)]'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-semibold text-text-primary">{server.name}</h3>
                  {!server.isHealthy && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[hsl(var(--error-500))] text-white font-medium">
                      Unhealthy
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => toggleServerHealth(server.id)}
                    className={`p-1.5 rounded transition-colors ${
                      server.isHealthy
                        ? 'text-success hover:bg-surface-300'
                        : 'text-error hover:bg-surface-300'
                    }`}
                    title={server.isHealthy ? 'Mark unhealthy' : 'Mark healthy'}
                  >
                    {server.isHealthy ? <Heart className="w-4 h-4" /> : <HeartOff className="w-4 h-4" />}
                  </button>

                  {confirmRemoveId === server.id ? (
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-text-dim">Remove?</span>
                      <button
                        onClick={() => handleRemoveServer(server.id)}
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
                      onClick={() => setConfirmRemoveId(server.id)}
                      className="text-error hover:opacity-80 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Weight: {server.weight}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={server.weight}
                    onChange={(e) => updateServerWeight(server.id, Number(e.target.value))}
                    className="w-full h-2 bg-surface-400 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Capacity: {server.capacity}
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="200"
                    step="10"
                    value={server.capacity}
                    onChange={(e) => updateServerCapacity(server.id, Number(e.target.value))}
                    className="w-full h-2 bg-surface-400 rounded-lg"
                  />
                </div>
              </div>

              <div className="mt-3 flex items-center text-sm flex-wrap gap-3">
                <span className="text-text-tertiary">Connections: {server.metrics.activeConnections}</span>
                <span className="text-text-tertiary">Requests: {server.metrics.requestCount}</span>
                <span className="text-text-tertiary">
                  CPU: {server.metrics.cpuUtilization.toFixed(1)}%
                </span>
                <span className="text-text-tertiary">
                  Memory: {server.metrics.memoryUtilization.toFixed(1)}%
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
