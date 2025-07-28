import { useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useSimulatorData } from '../hooks/useSimulator';
import { Database } from 'lucide-react';

const COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
];

export function ServerDistribution() {
  const { metrics, servers } = useSimulatorData();
  const [chartType, setChartType] = useState<'pie' | 'bar'>('pie');

  if (!metrics || servers.length === 0) {
    return (
      <div className="card p-8">
        <div className="text-center text-text-dim">
          <Database className="w-12 h-12 mx-auto mb-3 text-text-dim" />
          <p>No distribution data available.</p>
        </div>
      </div>
    );
  }

  const distributionData = servers.map((server) => {
    const serverMetrics = metrics.servers[server.id] || {
      requestDistribution: 0,
      activeConnections: 0,
      requestRate: 0,
      cpuUtilization: 0
    };
    
    return {
      name: server.name,
      value: serverMetrics.requestDistribution || 0,
      connections: serverMetrics.activeConnections || 0,
      requestRate: serverMetrics.requestRate || 0,
      cpu: serverMetrics.cpuUtilization || 0
    };
  });

  const activeConnectionsData = servers.map((server) => {
    const serverMetrics = metrics.servers[server.id] || { activeConnections: 0, cpuUtilization: 0, memoryUtilization: 0 };
    return {
      name: server.name,
      connections: serverMetrics.activeConnections || 0,
      cpu: serverMetrics.cpuUtilization || 0,
      memory: serverMetrics.memoryUtilization || 0
    };
  });

  return (
    <div className="card p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-text-primary">Server Distribution & Load</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setChartType('pie')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              chartType === 'pie'
                ? 'bg-[hsl(var(--primary-600))] text-white'
                : 'bg-surface-300 text-text-secondary hover:bg-surface-400'
            }`}
          >
            Pie
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              chartType === 'bar'
                ? 'bg-[hsl(var(--primary-600))] text-white'
                : 'bg-surface-300 text-text-secondary hover:bg-surface-400'
            }`}
          >
            Bar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-medium text-text-secondary mb-3">Request Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'pie' ? (
                <PieChart>
                  <Pie
                    data={distributionData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(1)}%`}
                  >
                    {distributionData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`${Number(value).toFixed(1)}%`, 'Distribution']}
                    contentStyle={{ backgroundColor: 'hsl(222, 32%, 14%)', border: '1px solid hsl(222, 32%, 25%)', color: 'hsl(0, 0%, 95%)' }}
                  />
                </PieChart>
              ) : (
                <BarChart data={distributionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 32%, 25%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(0, 0%, 60%)' }} />
                  <YAxis tickFormatter={(v: number) => `${v.toFixed(1)}%`} tick={{ fontSize: 12, fill: 'hsl(0, 0%, 60%)' }} />
                  <Tooltip 
                    formatter={(value: number) => [`${Number(value).toFixed(1)}%`, 'Distribution']}
                    contentStyle={{ backgroundColor: 'hsl(222, 32%, 14%)', border: '1px solid hsl(222, 32%, 25%)', color: 'hsl(0, 0%, 95%)' }}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium text-text-secondary mb-3">Server Load</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activeConnectionsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 32%, 25%)" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(0, 0%, 60%)' }} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(0, 0%, 60%)' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(222, 32%, 14%)', border: '1px solid hsl(222, 32%, 25%)', color: 'hsl(0, 0%, 95%)' }}
                />
                <Bar dataKey="connections" name="Active Connections" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cpu" name="CPU %" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex items-center space-x-4 text-sm text-text-tertiary">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-[#10b981] rounded mr-2"></div>
              Connections
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-[#f59e0b] rounded mr-2"></div>
              CPU %
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        {servers.map((server, index) => {
          const serverMetrics = metrics.servers[server.id] || { requestRate: 0, activeConnections: 0 };
          return (
            <div key={server.id} className="bg-surface-200 rounded-lg p-3">
              <div className="flex items-center mb-2">
                <div 
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                ></div>
                <span className="text-sm font-medium text-text-secondary">{server.name}</span>
              </div>
              <div className="text-xs text-text-tertiary">
                <div>{serverMetrics.requestRate.toFixed(1)} req/s</div>
                <div>{serverMetrics.activeConnections} conn</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
