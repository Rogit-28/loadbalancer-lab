import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock socket.io-client to prevent real connections
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    removeAllListeners: vi.fn(),
    connected: false,
  })),
}));

// Mock recharts to avoid rendering issues in jsdom
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => children,
  AreaChart: () => null,
  LineChart: () => null,
  BarChart: () => null,
  Area: () => null,
  Line: () => null,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Cell: () => null,
  PieChart: () => null,
  Pie: () => null,
}));

describe('App', () => {
  it('should render the main heading', () => {
    render(<App />);
    expect(screen.getByText('LoadBalancer')).toBeInTheDocument();
    expect(screen.getByText('Sim')).toBeInTheDocument();
  });

  it('should render the algorithm selector section', () => {
    render(<App />);
    expect(screen.getByText('Load Balancing Algorithm')).toBeInTheDocument();
  });

  it('should render the algorithm comparison section', () => {
    render(<App />);
    expect(screen.getByText('Algorithm Comparison')).toBeInTheDocument();
  });

  it('should render the connection indicator', () => {
    render(<App />);
    // The connection status text appears in both the indicator and the SimulationStatus component
    const elements = screen.getAllByText(/connecting|disconnected|connected/i);
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('should render the footer', () => {
    render(<App />);
    expect(screen.getByText(/LoadBalancerSim v1.0.0/)).toBeInTheDocument();
  });
});
