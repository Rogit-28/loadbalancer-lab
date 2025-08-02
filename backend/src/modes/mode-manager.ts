import { EventEmitter } from 'events';
import { SystemMode, ModeStatus } from '../types';
import { ModeHandler } from './mode-handler';
import { createLogger } from '../logger';

const logger = createLogger('mode-manager');

/**
 * Manages switching between 'simulation' and 'live' system modes.
 * Does not import concrete mode implementations — relies on ModeHandler interface
 * set via setters so that wiring happens at the composition root.
 */
class ModeManager extends EventEmitter {
  private currentMode: SystemMode = 'simulation';
  private running: boolean = false;
  private simulationHandler: ModeHandler | null = null;
  private liveHandler: ModeHandler | null = null;

  getMode(): SystemMode {
    return this.currentMode;
  }

  get isRunning(): boolean {
    return this.running;
  }

  getStatus(): ModeStatus {
    return {
      currentMode: this.currentMode,
      isRunning: this.running,
      canSwitch: !this.running,
    };
  }

  setSimulationHandler(handler: ModeHandler): void {
    this.simulationHandler = handler;
  }

  setLiveHandler(handler: ModeHandler): void {
    this.liveHandler = handler;
  }

  /** Stops current mode, switches to the target mode, and emits 'mode-changed'. */
  async switchMode(mode: SystemMode): Promise<void> {
    if (mode === this.currentMode) {
      logger.info('Already in requested mode', { mode });
      return;
    }

    if (this.running) {
      logger.info('Stopping current mode before switching', { from: this.currentMode, to: mode });
      await this.stop();
    }

    const previousMode = this.currentMode;
    this.currentMode = mode;
    logger.info('Mode switched', { from: previousMode, to: mode });
    this.emit('mode-changed', { from: previousMode, to: mode });
  }

  /** Starts the handler for the current mode. */
  async start(): Promise<void> {
    if (this.running) {
      logger.warn('Already running');
      return;
    }

    const handler = this.getActiveHandler();
    if (!handler) {
      const msg = `No handler registered for mode: ${this.currentMode}`;
      logger.error(msg);
      this.emit('error', new Error(msg));
      return;
    }

    try {
      logger.info('Starting mode', { mode: this.currentMode });
      await handler.start();
      this.running = true;
      this.emit('started', { mode: this.currentMode });
      logger.info('Mode started', { mode: this.currentMode });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to start mode', { mode: this.currentMode, error: error.message });
      this.emit('error', error);
    }
  }

  /** Stops the handler for the current mode. */
  async stop(): Promise<void> {
    if (!this.running) {
      logger.warn('Not running');
      return;
    }

    const handler = this.getActiveHandler();
    if (!handler) {
      this.running = false;
      return;
    }

    try {
      logger.info('Stopping mode', { mode: this.currentMode });
      await handler.stop();
      this.running = false;
      this.emit('stopped', { mode: this.currentMode });
      logger.info('Mode stopped', { mode: this.currentMode });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to stop mode', { mode: this.currentMode, error: error.message });
      this.running = false;
      this.emit('error', error);
    }
  }

  private getActiveHandler(): ModeHandler | null {
    return this.currentMode === 'simulation'
      ? this.simulationHandler
      : this.liveHandler;
  }
}

export { ModeManager };
