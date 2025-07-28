import { useRef, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity, Clock, Users, Zap, AlertTriangle } from 'lucide-react';
import { useSimulatorData } from '../hooks/useSimulator';
import type { Metrics } from '../hooks/useSimulator';

interface MetricsCardsProps {
  className?: string;
}

/** Keep a ring buffer of the last N metric snapshots to compute real trends */
function useTrendTracker(metrics: Metrics | null, windowSize = 10) {
  const historyRef = useRef<Metrics[]>([]);

  useEffect(() => {
    if (!metrics) return;
    const history = historyRef.current;
    history.push(metrics);
    if (history.length > windowSize) {
      history.shift();
    }
  }, [metrics, windowSize]);

  /** Get the % change between the oldest and newest snapshot for a given accessor */
  const getTrend = (accessor: (m: Metrics) => number): { change: string; positive: boolean } => {
    const history = historyRef.current;
    if (history.length < 2) {
      return { change: '--', positive: true };
    }
    const oldest = accessor(history[0]);
    const newest = accessor(history[history.length - 1]);

    if (oldest === 0 && newest === 0) return { change: '0%', positive: true };
    if (oldest === 0) return { change: '+100%', positive: true };

    const pctChange = ((newest - oldest) / Math.abs(oldest)) * 100;
    const sign = pctChange >= 0 ? '+' : '';
    return {
      change: `${sign}${pctChange.toFixed(1)}%`,
      positive: pctChange >= 0
    };
  };

  return getTrend;
}

export function MetricsCards({ className }: MetricsCardsProps) {
  const { metrics } = useSimulatorData();
  const getTrend = useTrendTracker(metrics);

  if (!metrics) {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 ${className || ''}`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-surface-100 rounded-xl p-6 border border-border-light animate-pulse">
            <div className="h-4 bg-surface-400 rounded mb-2"></div>
            <div className="h-8 bg-surface-400 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  const errorRate = metrics.totalRequests > 0
    ? ((metrics.totalErrors / metrics.totalRequests) * 100)
    : 0;

  const requestsTrend = getTrend(m => m.totalRequests);
  const responseTrend = getTrend(m => m.avgResponseTime);
  // For response time, lower is better — flip the "positive" interpretation
  responseTrend.positive = !responseTrend.positive;
  const errorTrend = getTrend(m => m.totalRequests > 0 ? (m.totalErrors / m.totalRequests) * 100 : 0);
  errorTrend.positive = !errorTrend.positive; // lower error rate is positive
  const throughputTrend = getTrend(m => m.throughput);
  const connectionsTrend = getTrend(m => m.activeConnections);

  const cards = [
    {
      title: 'Total Requests',
      value: metrics.totalRequests.toLocaleString(),
      trend: requestsTrend,
      icon: Activity,
      color: 'text-primary-400'
    },
    {
      title: 'Avg Response Time',
      value: `${metrics.avgResponseTime.toFixed(1)}ms`,
      trend: responseTrend,
      icon: Clock,
      color: 'text-info'
    },
    {
      title: 'Error Rate',
      value: `${errorRate.toFixed(2)}%`,
      trend: errorTrend,
      icon: AlertTriangle,
      color: errorRate < 1 ? 'text-success' : errorRate < 5 ? 'text-warning' : 'text-error'
    },
    {
      title: 'Throughput',
      value: `${metrics.throughput.toFixed(1)}/s`,
      trend: throughputTrend,
      icon: Zap,
      color: 'text-secondary'
    },
    {
      title: 'Active Connections',
      value: metrics.activeConnections.toString(),
      trend: connectionsTrend,
      icon: Users,
      color: 'text-primary-400'
    }
  ];

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6 ${className || ''}`}>
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div
            key={index}
            className="bg-surface-100 rounded-xl p-6 border border-border-light hover:border-border-medium transition-all shadow-sm hover:shadow-md group"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs text-text-dim uppercase tracking-wider font-medium">
                  {card.title}
                </p>
              </div>
              <Icon className={`w-5 h-5 ${card.color} opacity-70`} />
            </div>

            <div className="flex items-baseline space-x-2">
              <h3 className="text-3xl font-bold text-text-primary group-hover:text-text-secondary transition-colors">
                {card.value}
              </h3>
              {card.trend.change !== '--' && (
                <span className={`text-sm font-medium flex items-center ${
                  card.trend.positive ? 'text-success' : 'text-error'
                }`}>
                  {card.trend.positive ? (
                    <TrendingUp className="w-4 h-4 mr-1" />
                  ) : (
                    <TrendingDown className="w-4 h-4 mr-1" />
                  )}
                  {card.trend.change}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
