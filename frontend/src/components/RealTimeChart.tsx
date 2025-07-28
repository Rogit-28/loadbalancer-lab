import { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Activity, Download } from 'lucide-react';
import { useSimulatorData } from '../hooks/useSimulator';

type ChartType = 'responseTime' | 'requestRate';

interface RealTimeChartProps {
  type: ChartType;
  title: string;
}

interface ChartDataPoint {
  time: string;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

export function RealTimeChart({ type, title }: RealTimeChartProps) {
  const { metrics } = useSimulatorData();
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const maxDataPoints = 30;

  useEffect(() => {
    if (!metrics) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString();

    let newDataPoint: ChartDataPoint;

    if (type === 'responseTime') {
      // Use system-wide percentiles directly from backend
      newDataPoint = {
        time: timeStr,
        avg: metrics.avgResponseTime,
        p50: metrics.p50ResponseTime,
        p95: metrics.p95ResponseTime,
        p99: metrics.p99ResponseTime,
      };
    } else {
      // Request rate — use system-wide throughput
      newDataPoint = {
        time: timeStr,
        avg: metrics.throughput,
        p50: 0,
        p95: 0,
        p99: 0,
      };
    }

    setChartData(prevData => {
      const updated = [...prevData, newDataPoint];
      return updated.length > maxDataPoints ? updated.slice(-maxDataPoints) : updated;
    });
  }, [metrics, type]);

  const downloadCsv = useCallback(() => {
    if (chartData.length === 0) return;

    const headers = type === 'responseTime'
      ? ['Time', 'Avg (ms)', 'P50 (ms)', 'P95 (ms)', 'P99 (ms)']
      : ['Time', 'Requests/sec'];

    const rows = chartData.map(d =>
      type === 'responseTime'
        ? [d.time, d.avg.toFixed(2), d.p50.toFixed(2), d.p95.toFixed(2), d.p99.toFixed(2)]
        : [d.time, d.avg.toFixed(1)]
    );

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${type}-data-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [chartData, type]);

  const formatYAxis = (value: number) => {
    if (type === 'responseTime') {
      return `${value.toFixed(0)}ms`;
    }
    return `${value.toFixed(0)} req/s`;
  };

  const formatTooltip = (value: number, name: string) => {
    if (type === 'responseTime') {
      return [`${value.toFixed(2)}ms`, name];
    }
    return [`${value.toFixed(1)} req/s`, name];
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
        {chartData.length > 0 && (
          <button
            onClick={downloadCsv}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-text-dim hover:text-text-secondary bg-surface-200 hover:bg-surface-300 transition-colors border border-border-light"
            title="Export as CSV"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
        )}
      </div>
      <div className="h-64">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            {type === 'responseTime' ? (
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 32%, 25%)" />
                <XAxis dataKey="time" tick={{ fontSize: 12, fill: 'hsl(0, 0%, 60%)' }} />
                <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 12, fill: 'hsl(0, 0%, 60%)' }} />
                <Tooltip
                  formatter={formatTooltip}
                  contentStyle={{ backgroundColor: 'hsl(222, 32%, 14%)', border: '1px solid hsl(222, 32%, 25%)', color: 'hsl(0, 0%, 95%)' }}
                  labelStyle={{ color: 'hsl(0, 0%, 75%)' }}
                />
                <Legend wrapperStyle={{ color: 'hsl(0, 0%, 75%)' }} />
                <Area
                  type="monotone"
                  dataKey="p99"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.1}
                  name="P99"
                />
                <Area
                  type="monotone"
                  dataKey="p95"
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  fillOpacity={0.12}
                  name="P95"
                />
                <Area
                  type="monotone"
                  dataKey="p50"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.15}
                  name="P50"
                />
                <Area
                  type="monotone"
                  dataKey="avg"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.2}
                  name="Avg"
                />
              </AreaChart>
            ) : (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 32%, 25%)" />
                <XAxis dataKey="time" tick={{ fontSize: 12, fill: 'hsl(0, 0%, 60%)' }} />
                <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 12, fill: 'hsl(0, 0%, 60%)' }} />
                <Tooltip
                  formatter={formatTooltip}
                  contentStyle={{ backgroundColor: 'hsl(222, 32%, 14%)', border: '1px solid hsl(222, 32%, 25%)', color: 'hsl(0, 0%, 95%)' }}
                  labelStyle={{ color: 'hsl(0, 0%, 75%)' }}
                />
                <Line
                  type="monotone"
                  dataKey="avg"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={false}
                  name="Requests/sec"
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-text-dim">
            <div className="text-center">
              <Activity className="w-12 h-12 mx-auto mb-3 text-text-dim" />
              <p>Start simulation to see real-time data</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
