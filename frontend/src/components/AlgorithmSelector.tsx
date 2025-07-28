import { useSimulator } from '../hooks/useSimulator';
import type { SimulationConfig } from '../hooks/useSimulator';

type Algorithm = SimulationConfig['algorithm'];

const algorithms: { value: Algorithm; label: string; description: string }[] = [
  { value: 'round-robin', label: 'Round Robin', description: 'Distributes requests sequentially across servers' },
  { value: 'weighted-round-robin', label: 'Weighted Round Robin', description: 'Distributes based on server capacity weights' },
  { value: 'least-connections', label: 'Least Connections', description: 'Routes to server with fewest active connections' },
  { value: 'ip-hash', label: 'IP Hash', description: 'Routes based on client IP address hashing' },
  { value: 'random', label: 'Random', description: 'Random server selection' }
];

export function AlgorithmSelector() {
  const { algorithm, updateAlgorithm } = useSimulator();

  const handleAlgorithmChange = (alg: Algorithm) => {
    updateAlgorithm(alg);
  };

  const selectedInfo = algorithms.find(a => a.value === algorithm)!;

  return (
    <div className="lg:col-span-2 card p-6">
      <h2 className="text-xl font-semibold mb-4 text-text-primary">Load Balancing Algorithm</h2>
      
      <div className="space-y-3">
        {algorithms.map(({ value, label }) => (
          <label key={value} className="flex items-center space-x-3 cursor-pointer">
            <input
              type="radio"
              name="algorithm"
              value={value}
              checked={algorithm === value}
              onChange={(e) => handleAlgorithmChange(e.target.value as Algorithm)}
              className="h-4 w-4 text-[hsl(var(--primary-600))] focus:ring-[hsl(var(--primary-500))] border-border-light"
            />
            <span className="font-medium text-text-secondary">{label}</span>
          </label>
        ))}
      </div>

      <div className="mt-4 p-3 bg-surface-200 rounded-lg">
        <p className="text-sm text-text-tertiary">{selectedInfo.description}</p>
      </div>
    </div>
  );
}
