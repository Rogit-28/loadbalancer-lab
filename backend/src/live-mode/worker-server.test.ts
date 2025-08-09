import { describe, it, expect, afterEach } from 'vitest';
import * as http from 'http';
import { createWorkerApp, startWorkerServer } from './worker-server';

/** Make a GET request and return parsed JSON + status code */
function httpGet(port: number, path: string): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${port}${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
        } catch {
          reject(new Error(`Failed to parse JSON: ${data}`));
        }
      });
    });
    req.on('error', reject);
  });
}

/** Get a random high port to avoid collisions */
function randomPort(): number {
  return 19000 + Math.floor(Math.random() * 5000);
}

describe('worker-server', () => {
  let server: http.Server | null = null;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((err) => (err ? reject(err) : resolve()));
      });
      server = null;
    }
  });

  describe('createWorkerApp', () => {
    it('GET /health returns 200 with healthy status', async () => {
      const port = randomPort();
      const app = createWorkerApp('test-worker');

      server = await new Promise<http.Server>((resolve) => {
        const s = app.listen(port, () => resolve(s));
      });

      const { status, body } = await httpGet(port, '/health');
      expect(status).toBe(200);
      expect(body.status).toBe('healthy');
      expect(body.workerId).toBe('test-worker');
      expect(typeof body.uptime).toBe('number');
      expect(typeof body.requestCount).toBe('number');
    });

    it('GET /metrics returns 200 with metrics object', async () => {
      const port = randomPort();
      const app = createWorkerApp('test-worker');

      server = await new Promise<http.Server>((resolve) => {
        const s = app.listen(port, () => resolve(s));
      });

      const { status, body } = await httpGet(port, '/metrics');
      expect(status).toBe(200);
      expect(body.workerId).toBe('test-worker');
      expect(typeof body.requestCount).toBe('number');
      expect(typeof body.errorCount).toBe('number');
      expect(typeof body.avgResponseTime).toBe('number');
      expect(typeof body.p50ResponseTime).toBe('number');
      expect(typeof body.p95ResponseTime).toBe('number');
      expect(typeof body.p99ResponseTime).toBe('number');
    });

    it('catch-all route returns 200 with workerId', async () => {
      const port = randomPort();
      const app = createWorkerApp('test-worker');

      server = await new Promise<http.Server>((resolve) => {
        const s = app.listen(port, () => resolve(s));
      });

      const { status, body } = await httpGet(port, '/some/random/path');
      expect(status).toBe(200);
      expect(body.workerId).toBe('test-worker');
      expect(body.message).toBe('OK');
      expect(body.path).toBe('/some/random/path');
    }, 10000); // Allow extra time for simulated latency
  });

  describe('startWorkerServer', () => {
    it('starts and returns http.Server', async () => {
      const port = randomPort();
      server = await startWorkerServer(port, 'start-test-worker');

      expect(server).toBeDefined();
      expect(server.listening).toBe(true);

      // Verify it's actually responding
      const { status } = await httpGet(port, '/health');
      expect(status).toBe(200);
    });

    it('server can be closed gracefully', async () => {
      const port = randomPort();
      server = await startWorkerServer(port, 'close-test-worker');
      expect(server.listening).toBe(true);

      await new Promise<void>((resolve, reject) => {
        server!.close((err) => (err ? reject(err) : resolve()));
      });
      expect(server.listening).toBe(false);
      server = null; // Prevent afterEach from double-closing
    });
  });
});
