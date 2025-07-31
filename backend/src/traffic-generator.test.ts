import { describe, it, expect, vi, afterEach } from 'vitest';
import { TrafficGenerator } from './traffic-generator';

describe('TrafficGenerator', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize in stopped state', () => {
    const gen = new TrafficGenerator();
    const status = gen.getStatus();
    expect(status.isRunning).toBe(false);
    expect(status.rate).toBe(100);
    expect(status.pattern).toBe('steady');
    expect(status.speed).toBe(1);
  });

  it('should start and stop', () => {
    const gen = new TrafficGenerator();
    gen.start();
    expect(gen.getStatus().isRunning).toBe(true);
    gen.stop();
    expect(gen.getStatus().isRunning).toBe(false);
  });

  it('should not start twice', () => {
    const gen = new TrafficGenerator();
    gen.start();
    gen.start(); // should be a no-op
    expect(gen.getStatus().isRunning).toBe(true);
    gen.stop();
  });

  it('should clamp rate between 1 and 10000', () => {
    const gen = new TrafficGenerator();
    gen.setRate(-5);
    expect(gen.getStatus().rate).toBe(1);
    gen.setRate(99999);
    expect(gen.getStatus().rate).toBe(10000);
    gen.setRate(500);
    expect(gen.getStatus().rate).toBe(500);
  });

  it('should clamp speed between 0.1 and 10', () => {
    const gen = new TrafficGenerator();
    gen.setSpeed(0);
    expect(gen.getStatus().speed).toBe(0.1);
    gen.setSpeed(100);
    expect(gen.getStatus().speed).toBe(10);
    gen.setSpeed(2.5);
    expect(gen.getStatus().speed).toBe(2.5);
  });

  it('should accept valid patterns', () => {
    const gen = new TrafficGenerator();
    gen.setPattern('burst');
    expect(gen.getStatus().pattern).toBe('burst');
    gen.setPattern('spike');
    expect(gen.getStatus().pattern).toBe('spike');
    gen.setPattern('steady');
    expect(gen.getStatus().pattern).toBe('steady');
  });

  it('should emit requests when running', async () => {
    const gen = new TrafficGenerator();
    gen.setRate(1000); // high rate to ensure we get requests quickly

    const requests: any[] = [];
    gen.on('request', (req) => {
      requests.push(req);
    });

    gen.start();
    await new Promise(resolve => setTimeout(resolve, 100));
    gen.stop();

    expect(requests.length).toBeGreaterThan(0);
    expect(requests[0]).toHaveProperty('requestId');
    expect(requests[0]).toHaveProperty('clientIp');
    expect(requests[0]).toHaveProperty('timestamp');
  });
});
