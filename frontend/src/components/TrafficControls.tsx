import { useState } from 'react';
import { useSimulator } from '../hooks/useSimulator';
import { Plus, Minus } from 'lucide-react';

export function TrafficControls() {
  const { traffic, updateTraffic } = useSimulator();
  const [rate, setRate] = useState(traffic.rate);
  const [speed, setSpeed] = useState(traffic.speed);
  const [pattern, setPattern] = useState<'steady' | 'burst' | 'spike'>(traffic.pattern);

  const handleRateChange = (value: number) => {
    const newRate = Math.max(1, Math.min(10000, value));
    setRate(newRate);
    updateTraffic({ rate: newRate });
  };

  const handleSpeedChange = (value: number) => {
    const newSpeed = Math.max(0.1, Math.min(10, value));
    setSpeed(newSpeed);
    updateTraffic({ speed: newSpeed });
  };

  const handlePatternChange = (newPattern: 'steady' | 'burst' | 'spike') => {
    setPattern(newPattern);
    updateTraffic({ pattern: newPattern });
  };

  return (
    <div className="lg:col-span-2 card p-6">
      <h2 className="text-xl font-semibold mb-4 text-text-primary">Traffic Configuration</h2>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Request Rate: {rate} req/s
          </label>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => handleRateChange(rate - 50)}
              className="p-2 bg-surface-300 rounded-lg hover:bg-surface-400"
            >
              <Minus className="w-4 h-4" />
            </button>
            <input
              type="range"
              min="1"
              max="10000"
              value={rate}
              onChange={(e) => handleRateChange(Number(e.target.value))}
              className="flex-1 h-2 bg-surface-400 rounded-lg appearance-none cursor-pointer"
            />
            <button
              onClick={() => handleRateChange(rate + 50)}
              className="p-2 bg-surface-300 rounded-lg hover:bg-surface-400"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Simulation Speed: {speed}x
          </label>
          <input
            type="range"
            min="0.1"
            max="10"
            step="0.1"
            value={speed}
            onChange={(e) => handleSpeedChange(Number(e.target.value))}
            className="w-full h-2 bg-surface-400 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">Traffic Pattern</label>
          <div className="grid grid-cols-3 gap-2">
            {(['steady', 'burst', 'spike'] as const).map((p) => (
              <button
                key={p}
                onClick={() => handlePatternChange(p)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pattern === p
                    ? 'bg-[hsl(var(--primary-600))] text-white'
                    : 'bg-surface-300 text-text-secondary hover:bg-surface-400'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
