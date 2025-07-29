import { useSimulatorData } from '../hooks/useSimulator';
import { CheckCircle, XCircle, ScrollText } from 'lucide-react';

export function RequestLog() {
  const { requestLog } = useSimulatorData();

  return (
    <div className="bg-surface-200 rounded-xl p-6 h-full border border-border-light flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-text-primary flex items-center">
          <ScrollText className="w-5 h-5 mr-2 text-text-dim" />
          Request Log
        </h3>
        <span className="text-xs text-text-dim">
          {requestLog.length} entries
        </span>
      </div>

      {requestLog.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-text-dim text-sm">
          <div className="text-center">
            <ScrollText className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>Start simulation to see requests</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0 max-h-80 scrollbar-thin">
          {[...requestLog].reverse().map((entry) => (
            <div
              key={entry.id}
              className={`flex items-center justify-between px-3 py-2 rounded text-xs font-mono ${
                entry.success
                  ? 'bg-surface-100 border-l-2 border-[hsl(var(--success-500))]'
                  : 'bg-[hsl(0,50%,12%)] border-l-2 border-[hsl(var(--error-500))]'
              }`}
            >
              <div className="flex items-center space-x-2 min-w-0 flex-1">
                {entry.success ? (
                  <CheckCircle className="w-3.5 h-3.5 text-success flex-shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-error flex-shrink-0" />
                )}
                <span className="text-text-secondary truncate">{entry.serverName}</span>
                <span className="text-text-dim truncate hidden sm:inline">{entry.clientIp}</span>
              </div>
              <div className="flex items-center space-x-3 flex-shrink-0">
                <span className={`${
                  entry.responseTime > 200 ? 'text-warning' : 
                  entry.responseTime > 500 ? 'text-error' : 'text-text-tertiary'
                }`}>
                  {entry.responseTime}ms
                </span>
                {entry.error && (
                  <span className="text-error truncate max-w-[80px]" title={entry.error}>
                    {entry.error}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
