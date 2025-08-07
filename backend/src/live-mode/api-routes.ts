import express, { Request, Response, Router } from 'express';
import { LiveOrchestrator } from './orchestrator';
import { createLogger } from '../logger';

const logger = createLogger('api-routes');

function createLiveApiRoutes(orchestrator: LiveOrchestrator): Router {
  const router = express.Router();

  // GET /api/live/status — current live mode status
  router.get('/status', (_req: Request, res: Response) => {
    try {
      res.json({
        active: orchestrator.isActive(),
        workers: orchestrator.getWorkers().length,
        metrics: orchestrator.isActive() ? orchestrator.getMetrics() : null,
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to get status', { error: error.message });
      res.status(500).json({ error: 'Failed to get status' });
    }
  });

  // GET /api/live/workers — all workers with health
  router.get('/workers', (_req: Request, res: Response) => {
    try {
      const workers = orchestrator.getWorkers();
      res.json({ workers });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to get workers', { error: error.message });
      res.status(500).json({ error: 'Failed to get workers' });
    }
  });

  // POST /api/live/workers — add a new worker
  router.post('/workers', async (req: Request, res: Response) => {
    try {
      const { name, weight, capacity } = req.body as {
        name?: string;
        weight?: number;
        capacity?: number;
      };

      if (!name || typeof name !== 'string') {
        res.status(400).json({ error: 'name is required and must be a string' });
        return;
      }

      const worker = await orchestrator.addWorker(
        name,
        typeof weight === 'number' ? weight : undefined,
        typeof capacity === 'number' ? capacity : undefined
      );
      res.status(201).json({ worker });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to add worker', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/live/workers/:id — remove a worker
  router.delete('/workers/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Worker ID is required' });
        return;
      }
      await orchestrator.removeWorker(id);
      res.json({ success: true, workerId: id });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to remove worker', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/live/metrics — current metrics
  router.get('/metrics', (_req: Request, res: Response) => {
    try {
      const metrics = orchestrator.getMetrics();
      res.json(metrics);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to get metrics', { error: error.message });
      res.status(500).json({ error: 'Failed to get metrics' });
    }
  });

  // GET /api/live/circuit-breakers — all circuit breaker states
  router.get('/circuit-breakers', (_req: Request, res: Response) => {
    try {
      const breakers = orchestrator.getCircuitBreakers();
      res.json({ circuitBreakers: breakers });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to get circuit breakers', { error: error.message });
      res.status(500).json({ error: 'Failed to get circuit breakers' });
    }
  });

  // POST /api/live/start — start live mode
  router.post('/start', async (_req: Request, res: Response) => {
    try {
      if (orchestrator.isActive()) {
        res.status(400).json({ error: 'Live mode is already active' });
        return;
      }
      await orchestrator.start();
      res.json({ success: true, message: 'Live mode started' });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to start live mode', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/live/stop — stop live mode
  router.post('/stop', async (_req: Request, res: Response) => {
    try {
      if (!orchestrator.isActive()) {
        res.status(400).json({ error: 'Live mode is not active' });
        return;
      }
      await orchestrator.stop();
      res.json({ success: true, message: 'Live mode stopped' });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to stop live mode', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

export { createLiveApiRoutes };
