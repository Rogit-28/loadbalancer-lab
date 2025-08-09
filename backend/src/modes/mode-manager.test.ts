import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModeManager } from './mode-manager';
import { ModeHandler } from './mode-handler';

function createMockHandler(): ModeHandler {
  return {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    getMetrics: vi.fn().mockReturnValue({}),
    isActive: vi.fn().mockReturnValue(false),
  };
}

describe('ModeManager', () => {
  let manager: ModeManager;
  let simHandler: ModeHandler;
  let liveHandler: ModeHandler;

  beforeEach(() => {
    manager = new ModeManager();
    simHandler = createMockHandler();
    liveHandler = createMockHandler();
    manager.setSimulationHandler(simHandler);
    manager.setLiveHandler(liveHandler);
  });

  it('should default to simulation mode', () => {
    expect(manager.getMode()).toBe('simulation');
  });

  it('should return correct initial status', () => {
    const status = manager.getStatus();
    expect(status).toEqual({
      currentMode: 'simulation',
      isRunning: false,
      canSwitch: true,
    });
  });

  it('should switch mode via switchMode()', async () => {
    await manager.switchMode('live');
    expect(manager.getMode()).toBe('live');
  });

  it('should emit mode-changed event on switchMode', async () => {
    const listener = vi.fn();
    manager.on('mode-changed', listener);

    await manager.switchMode('live');

    expect(listener).toHaveBeenCalledWith({ from: 'simulation', to: 'live' });
  });

  it('should not emit when switching to the same mode', async () => {
    const listener = vi.fn();
    manager.on('mode-changed', listener);

    await manager.switchMode('simulation');

    expect(listener).not.toHaveBeenCalled();
  });

  it('should stop the running handler before switching modes', async () => {
    await manager.start(); // start simulation handler
    expect(manager.isRunning).toBe(true);

    await manager.switchMode('live');

    expect(simHandler.stop).toHaveBeenCalled();
    expect(manager.isRunning).toBe(false);
    expect(manager.getMode()).toBe('live');
  });

  it('should call handler.start() and set running=true on start()', async () => {
    await manager.start();

    expect(simHandler.start).toHaveBeenCalled();
    expect(manager.isRunning).toBe(true);
  });

  it('should call handler.stop() and set running=false on stop()', async () => {
    await manager.start();
    expect(manager.isRunning).toBe(true);

    await manager.stop();

    expect(simHandler.stop).toHaveBeenCalled();
    expect(manager.isRunning).toBe(false);
  });

  it('should not start twice if already running', async () => {
    await manager.start();
    await manager.start(); // second call should be no-op

    expect(simHandler.start).toHaveBeenCalledTimes(1);
  });

  it('should not stop twice if already stopped', async () => {
    await manager.stop(); // not running, should be no-op

    expect(simHandler.stop).not.toHaveBeenCalled();
  });

  it('should emit error when no handler is registered for mode', async () => {
    const freshManager = new ModeManager();
    const errorListener = vi.fn();
    freshManager.on('error', errorListener);

    await freshManager.start();

    expect(errorListener).toHaveBeenCalledTimes(1);
    expect(errorListener.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(errorListener.mock.calls[0][0].message).toContain('No handler registered');
    expect(freshManager.isRunning).toBe(false);
  });

  it('should use live handler after switching to live mode', async () => {
    await manager.switchMode('live');
    await manager.start();

    expect(liveHandler.start).toHaveBeenCalled();
    expect(simHandler.start).not.toHaveBeenCalled();
  });

  it('should emit started event on successful start', async () => {
    const listener = vi.fn();
    manager.on('started', listener);

    await manager.start();

    expect(listener).toHaveBeenCalledWith({ mode: 'simulation' });
  });

  it('should emit stopped event on successful stop', async () => {
    const listener = vi.fn();
    manager.on('stopped', listener);

    await manager.start();
    await manager.stop();

    expect(listener).toHaveBeenCalledWith({ mode: 'simulation' });
  });
});
