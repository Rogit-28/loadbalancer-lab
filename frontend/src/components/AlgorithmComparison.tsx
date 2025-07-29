import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Play, Loader2, Trophy, AlertTriangle, Download } from 'lucide-react';
import { useSimulator } from '../hooks/useSimulator';
import type { AlgorithmComparisonResult, ComparisonResponse } from '../hooks/useSimulator';

const ALGORITHMS = [
  { value: 'round-robin', label: 'Round Robin' },
  { value: 'weighted-round-robin', label: 'Weighted RR' },
  { value: 'least-connections', label: 'Least Conn' },
  { value: 'ip-hash', label: 'IP Hash' },
  { value: 'random', label: 'Random' },
] as const;

const CHART_COLORS = [
  'hsl(210, 100%, 60%)',
  'hsl(142, 76%, 45%)',
  'hsl(38, 92%, 50%)',
  'hsl(280, 70%, 60%)',
  'hsl(0, 84%, 60%)',
];

const ALGORITHM_LABELS: Record<string, string> = {
  'round-robin': 'Round Robin',
  'weighted-round-robin': 'Weighted RR',
  'least-connections': 'Least Conn',
  'ip-hash': 'IP Hash',
  'random': 'Random',
};

function MetricBar({ label, results, accessor, unit }: {
  label: string;
  results: AlgorithmComparisonResult[];
  accessor: (r: AlgorithmComparisonResult) => number;
  unit: string;
}) {
  const data = results.map((r, i) => ({
    algorithm: ALGORITHM_LABELS[r.algorithm] || r.algorithm,
    value: accessor(r),
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <div>
      <h4 className="text-sm font-medium text-text-secondary mb-2">{label}</h4>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 32%, 20%)" />
            <XAxis
              dataKey="algorithm"
              tick={{ fill: 'hsl(0, 0%, 60%)', fontSize: 11 }}
              axisLine={{ stroke: 'hsl(222, 32%, 25%)' }}
              tickLine={{ stroke: 'hsl(222, 32%, 25%)' }}
            />
            <YAxis
              tick={{ fill: 'hsl(0, 0%, 60%)', fontSize: 11 }}
              axisLine={{ stroke: 'hsl(222, 32%, 25%)' }}
              tickLine={{ stroke: 'hsl(222, 32%, 25%)' }}
              unit={unit}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(222, 32%, 14%)',
                border: '1px solid hsl(222, 32%, 25%)',
                borderRadius: '8px',
                color: 'hsl(0, 0%, 95%)',
                fontSize: '12px',
              }}
              formatter={(value: number) => [`${value.toFixed(1)}${unit}`, label]}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ResultsTable({ response }: { response: ComparisonResponse }) {
  const { results } = response;

  // Determine best (rank 1) for each metric
  const bestAvg = Math.min(...results.map(r => r.avgResponseTime));
  const bestP99 = Math.min(...results.map(r => r.p99ResponseTime));
  const bestError = Math.min(...results.map(r => r.errorRate));
  const bestStdDev = Math.min(...results.map(r => r.distributionStdDev));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-medium">
            <th className="text-left py-2 px-3 text-text-dim font-medium">#</th>
            <th className="text-left py-2 px-3 text-text-dim font-medium">Algorithm</th>
            <th className="text-right py-2 px-3 text-text-dim font-medium">Avg (ms)</th>
            <th className="text-right py-2 px-3 text-text-dim font-medium">P50 (ms)</th>
            <th className="text-right py-2 px-3 text-text-dim font-medium">P95 (ms)</th>
            <th className="text-right py-2 px-3 text-text-dim font-medium">P99 (ms)</th>
            <th className="text-right py-2 px-3 text-text-dim font-medium">Error %</th>
            <th className="text-right py-2 px-3 text-text-dim font-medium">Fairness (StdDev)</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <tr
              key={r.algorithm}
              className={`border-b border-border-light ${i === 0 ? 'bg-[hsl(142,50%,15%,0.15)]' : ''}`}
            >
              <td className="py-2 px-3">
                {i === 0 ? (
                  <Trophy className="w-4 h-4 text-[hsl(var(--warning-500))]" />
                ) : (
                  <span className="text-text-dim">{i + 1}</span>
                )}
              </td>
              <td className="py-2 px-3 font-medium text-text-primary">
                {ALGORITHM_LABELS[r.algorithm] || r.algorithm}
              </td>
              <td className={`py-2 px-3 text-right ${r.avgResponseTime === bestAvg ? 'text-[hsl(var(--success-500))] font-semibold' : 'text-text-secondary'}`}>
                {r.avgResponseTime.toFixed(1)}
              </td>
              <td className="py-2 px-3 text-right text-text-secondary">{r.p50ResponseTime}</td>
              <td className="py-2 px-3 text-right text-text-secondary">{r.p95ResponseTime}</td>
              <td className={`py-2 px-3 text-right ${r.p99ResponseTime === bestP99 ? 'text-[hsl(var(--success-500))] font-semibold' : 'text-text-secondary'}`}>
                {r.p99ResponseTime}
              </td>
              <td className={`py-2 px-3 text-right ${r.errorRate === bestError ? 'text-[hsl(var(--success-500))] font-semibold' : 'text-text-secondary'}`}>
                {r.errorRate.toFixed(2)}%
              </td>
              <td className={`py-2 px-3 text-right ${r.distributionStdDev === bestStdDev ? 'text-[hsl(var(--success-500))] font-semibold' : 'text-text-secondary'}`}>
                {r.distributionStdDev.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AlgorithmComparison() {
  const [selectedAlgorithms, setSelectedAlgorithms] = useState<Set<string>>(
    new Set(['round-robin', 'least-connections', 'random'])
  );
  const [requestCount, setRequestCount] = useState(500);

  const runComparison = useSimulator((s) => s.runComparison);
  const comparisonResult = useSimulator((s) => s.comparisonResult);
  const comparisonLoading = useSimulator((s) => s.comparisonLoading);
  const servers = useSimulator((s) => s.servers);

  const canRun = selectedAlgorithms.size >= 2 && servers.length > 0 && !comparisonLoading;

  const downloadComparisonCsv = () => {
    if (!comparisonResult) return;
    const headers = ['Rank', 'Algorithm', 'Avg (ms)', 'P50 (ms)', 'P95 (ms)', 'P99 (ms)', 'Error %', 'StdDev (fairness)'];
    const rows = comparisonResult.results.map((r, i) => [
      i + 1,
      ALGORITHM_LABELS[r.algorithm] || r.algorithm,
      r.avgResponseTime.toFixed(1),
      r.p50ResponseTime,
      r.p95ResponseTime,
      r.p99ResponseTime,
      r.errorRate.toFixed(2),
      r.distributionStdDev.toFixed(1),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `comparison-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleAlgorithm = (alg: string) => {
    setSelectedAlgorithms(prev => {
      const next = new Set(prev);
      if (next.has(alg)) {
        next.delete(alg);
      } else {
        next.add(alg);
      }
      return next;
    });
  };

  const handleRun = () => {
    if (!canRun) return;
    runComparison(Array.from(selectedAlgorithms), requestCount);
  };

  // Prepare distribution chart data
  const distributionData = useMemo(() => {
    if (!comparisonResult) return [];
    // For each server, show how many requests each algorithm sent to it
    const serverNames = comparisonResult.results[0]?.serverDistribution.map(s => s.serverName) || [];
    return serverNames.map((name) => {
      const row: Record<string, string | number> = { server: name };
      comparisonResult.results.forEach((r) => {
        const sd = r.serverDistribution.find(s => s.serverName === name);
        row[ALGORITHM_LABELS[r.algorithm] || r.algorithm] = sd?.requests || 0;
      });
      return row;
    });
  }, [comparisonResult]);

  return (
    <div className="card p-6">
      <h2 className="text-xl font-semibold text-text-primary mb-4">Algorithm Comparison</h2>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-6 mb-6">
        {/* Algorithm checkboxes */}
        <div className="flex-1 min-w-[280px]">
          <label className="block text-xs text-text-dim uppercase tracking-wider mb-2">
            Select Algorithms (min 2)
          </label>
          <div className="flex flex-wrap gap-2">
            {ALGORITHMS.map(({ value, label }) => {
              const checked = selectedAlgorithms.has(value);
              return (
                <button
                  key={value}
                  onClick={() => toggleAlgorithm(value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                    checked
                      ? 'bg-[hsl(210,100%,55%,0.15)] border-[hsl(210,100%,55%,0.4)] text-[hsl(210,100%,70%)]'
                      : 'bg-surface-200 border-border-light text-text-dim hover:text-text-secondary hover:border-border-medium'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Request count */}
        <div className="w-48">
          <label className="block text-xs text-text-dim uppercase tracking-wider mb-2">
            Requests per Algorithm
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={50}
              max={2000}
              step={50}
              value={requestCount}
              onChange={(e) => setRequestCount(Number(e.target.value))}
              className="flex-1 accent-[hsl(210,100%,55%)]"
            />
            <span className="text-sm text-text-secondary font-mono w-12 text-right">{requestCount}</span>
          </div>
        </div>

        {/* Run button */}
        <button
          onClick={handleRun}
          disabled={!canRun}
          className={`btn px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            canRun
              ? 'bg-[hsl(210,100%,55%)] text-white hover:bg-[hsl(210,100%,45%)]'
              : 'bg-surface-300 text-text-dim cursor-not-allowed'
          }`}
        >
          {comparisonLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          {comparisonLoading ? 'Running...' : 'Run Comparison'}
        </button>
      </div>

      {/* Warnings */}
      {servers.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-[hsl(var(--warning-500))] mb-4">
          <AlertTriangle className="w-4 h-4" />
          Add at least one server before running a comparison.
        </div>
      )}
      {selectedAlgorithms.size < 2 && (
        <div className="flex items-center gap-2 text-sm text-[hsl(var(--warning-500))] mb-4">
          <AlertTriangle className="w-4 h-4" />
          Select at least 2 algorithms to compare.
        </div>
      )}

      {/* Results */}
      {comparisonResult && !comparisonLoading && (
        <div className="space-y-6">
          {/* Summary info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs text-text-dim">
              <span>{comparisonResult.requestsPerAlgorithm} requests per algorithm</span>
              <span className="w-px h-3 bg-border-light" />
              <span>{comparisonResult.serverCount} servers</span>
              <span className="w-px h-3 bg-border-light" />
              <span>Sorted by avg response time (best first)</span>
            </div>
            <button
              onClick={downloadComparisonCsv}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-text-dim hover:text-text-secondary bg-surface-200 hover:bg-surface-300 transition-colors border border-border-light"
              title="Export as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          </div>

          {/* Results table */}
          <ResultsTable response={comparisonResult} />

          {/* Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <MetricBar
              label="Average Response Time"
              results={comparisonResult.results}
              accessor={(r) => r.avgResponseTime}
              unit="ms"
            />
            <MetricBar
              label="P99 Response Time"
              results={comparisonResult.results}
              accessor={(r) => r.p99ResponseTime}
              unit="ms"
            />
            <MetricBar
              label="Error Rate"
              results={comparisonResult.results}
              accessor={(r) => r.errorRate}
              unit="%"
            />
            <MetricBar
              label="Distribution Fairness (StdDev)"
              results={comparisonResult.results}
              accessor={(r) => r.distributionStdDev}
              unit=""
            />
          </div>

          {/* Server distribution grouped bar chart */}
          {distributionData.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-text-secondary mb-2">Request Distribution by Server</h4>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distributionData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 32%, 20%)" />
                    <XAxis
                      dataKey="server"
                      tick={{ fill: 'hsl(0, 0%, 60%)', fontSize: 11 }}
                      axisLine={{ stroke: 'hsl(222, 32%, 25%)' }}
                      tickLine={{ stroke: 'hsl(222, 32%, 25%)' }}
                    />
                    <YAxis
                      tick={{ fill: 'hsl(0, 0%, 60%)', fontSize: 11 }}
                      axisLine={{ stroke: 'hsl(222, 32%, 25%)' }}
                      tickLine={{ stroke: 'hsl(222, 32%, 25%)' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(222, 32%, 14%)',
                        border: '1px solid hsl(222, 32%, 25%)',
                        borderRadius: '8px',
                        color: 'hsl(0, 0%, 95%)',
                        fontSize: '12px',
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '11px', color: 'hsl(0, 0%, 60%)' }}
                    />
                    {comparisonResult.results.map((r, i) => (
                      <Bar
                        key={r.algorithm}
                        dataKey={ALGORITHM_LABELS[r.algorithm] || r.algorithm}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                        radius={[2, 2, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!comparisonResult && !comparisonLoading && (
        <div className="text-center py-8 text-text-dim text-sm">
          Select algorithms and click "Run Comparison" to see how they perform under identical conditions.
        </div>
      )}
    </div>
  );
}
