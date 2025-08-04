import * as http from 'http';
import { EventEmitter } from 'events';
import { WorkerProcess } from '../types';
import { config } from '../config';
import { createLogger } from '../logger';
import { startWorkerServer } from './worker-server';

const logger = createLogger('process-manager');

interface ManagedWorker {
  server: http.Server;
  port: number;
  workerId: string;
}

/**
 * Manages in-process HTTP worker servers.
 * Spawns workers as local HTTP servers (no child_process), tracks them,
 * and provides graceful shutdown.
 */
class ProcessManager extends EventEmitter {
  private workers: Map<string, ManagedWorker> = new Map();
  /** Parallel map storing the WorkerProcess metadata for each managed worker */
  private workerProcesses: Map<string, WorkerProcess> = new Map();

  private generateId(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return `worker-${timestamp}-${random}`;
  }

  async spawnWorker(
    port: number,
    name: string,
    weight?: number,
    capacity?: number,
  ): Promise<WorkerProcess> {
    const id = this.generateId();
    logger.info('Spawning worker', { id, name, port });

    try {
      const server = await startWorkerServer(port, id);

      const managed: ManagedWorker = { server, port, workerId: id };
      this.workers.set(id, managed);

      const workerProcess: WorkerProcess = {
        id,
        name,
        host: 'localhost',
        port,
        pid: process.pid,
        status: 'running',
        weight: weight ?? config.worker.defaultWeight,
        capacity: capacity ?? config.worker.defaultCapacity,
        startedAt: Date.now(),
        uptime: 0,
      };

      this.workerProcesses.set(id, workerProcess);
      logger.info('Worker spawned successfully', { id, name, port });
      this.emit('worker-started', workerProcess);
      return workerProcess;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to spawn worker', { id, name, port, error: error.message });
      this.emit('worker-error', { id, error });
      throw error;
    }
  }

  async killWorker(workerId: string): Promise<void> {
    const managed = this.workers.get(workerId);
    if (!managed) {
      logger.warn('Worker not found for kill', { workerId });
      return;
    }

    const wp = this.workerProcesses.get(workerId);
    if (wp) {
      wp.status = 'stopping';
    }

    logger.info('Killing worker', { workerId });

    await new Promise<void>((resolve) => {
      managed.server.close(() => {
        resolve();
      });

      // Force-close after the configured shutdown timeout
      setTimeout(() => {
        resolve();
      }, config.worker.shutdownTimeout);
    });

    this.workers.delete(workerId);

    if (wp) {
      wp.status = 'stopped';
      if (wp.startedAt !== null) {
        wp.uptime += Date.now() - wp.startedAt;
      }
    }
    this.workerProcesses.delete(workerId);

    logger.info('Worker killed', { workerId });
    this.emit('worker-stopped', { workerId });
  }

  async killAll(): Promise<void> {
    logger.info('Killing all workers', { count: this.workers.size });
    const ids = Array.from(this.workers.keys());
    await Promise.all(ids.map((id) => this.killWorker(id)));
    logger.info('All workers killed');
  }

  getWorkers(): WorkerProcess[] {
    return Array.from(this.workerProcesses.values()).map((wp) => {
      // Update uptime to reflect current elapsed time
      if (wp.status === 'running' && wp.startedAt !== null) {
        return { ...wp, uptime: wp.uptime + (Date.now() - wp.startedAt) };
      }
      return { ...wp };
    });
  }

  getWorker(workerId: string): WorkerProcess | undefined {
    const wp = this.workerProcesses.get(workerId);
    if (!wp) return undefined;

    if (wp.status === 'running' && wp.startedAt !== null) {
      return { ...wp, uptime: wp.uptime + (Date.now() - wp.startedAt) };
    }
    return { ...wp };
  }
}

export { ProcessManager };
