import { useEffect } from 'react';
import { useLiveMode } from '../hooks/useLiveMode';
import { useSimulator } from '../hooks/useSimulator';

export function ModeToggle() {
  const { currentMode, canSwitch, switchMode } = useLiveMode();
  const socket = useSimulator((s) => s.socket);
  const setupLiveModeListeners = useLiveMode((s) => s.setupLiveModeListeners);

  // Setup live mode listeners on first render when socket is available
  useEffect(() => {
    if (socket && !useLiveMode.getState().socket) {
      setupLiveModeListeners(socket);
    }
  }, [socket, setupLiveModeListeners]);

  const handleModeChange = (mode: 'simulation' | 'live') => {
    if (currentMode !== mode && canSwitch) {
      switchMode(mode);
    }
  };

  const modes = [
    { value: 'simulation' as const, label: 'Simulation', desc: 'Simulated traffic & servers' },
    { value: 'live' as const, label: 'Live', desc: 'Real HTTP proxy & workers' }
  ];

  return (
    <div className="mb-6">
      <div className="inline-flex rounded-lg border border-border-light bg-surface-100 p-1">
        {modes.map((mode) => (
          <button
            key={mode.value}
            onClick={() => handleModeChange(mode.value)}
            disabled={!canSwitch}
            className={`px-6 py-2 rounded-md transition-all font-medium text-sm flex flex-col items-start gap-1 ${
              currentMode === mode.value
                ? 'bg-primary-500 text-white shadow-md'
                : 'text-text-secondary hover:text-text-primary'
            } ${!canSwitch ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span>{mode.label}</span>
            <span className="text-xs opacity-75">{mode.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
