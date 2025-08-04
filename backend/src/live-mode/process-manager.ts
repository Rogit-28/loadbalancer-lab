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
