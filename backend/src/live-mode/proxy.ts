import * as http from 'http';
import { EventEmitter } from 'events';
import { Server, ProxyRequest } from '../types';
import { LoadBalancingAlgorithm } from '../algorithms';
import { CircuitBreaker } from './circuit-breaker';
import { createLogger } from '../logger';

const logger = createLogger('proxy');

const CONNECTION_TIMEOUT = 5000;

function generateRequestId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `req-${timestamp}-${random}`;
}

class LoadBalancerProxy extends EventEmitter {
  private port: number;
  private server: http.Server | null = null;
  private algorithm: LoadBalancingAlgorithm | null = null;
  private servers: Server[] = [];
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  constructor(port: number) {
    super();
    this.port = port;
    logger.info('Proxy created', { port: String(port) });
  }

  start(
    algorithm: LoadBalancingAlgorithm,
    servers: Server[]
  ): Promise<void> {
    this.algorithm = algorithm;
    this.servers = servers;

    return new Promise((resolve, reject) => {
      this.server = http.createServer(
        (req: http.IncomingMessage, res: http.ServerResponse) => {
          this.handleRequest(req, res);
        }
      );

      this.server.on('error', (err: Error) => {
        logger.error('Proxy server error', { error: err.message });
        this.emit('proxy-error', err);
      });

      this.server.listen(this.port, () => {
        logger.info('Proxy server started', { port: String(this.port) });
        resolve();
      });

      this.server.once('error', reject);
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close(() => {
        logger.info('Proxy server stopped');
        this.server = null;
        resolve();
      });
    });
  }

  updateAlgorithm(algorithm: LoadBalancingAlgorithm): void {
    this.algorithm = algorithm;
    logger.info('Algorithm updated');
  }

  updateServers(servers: Server[]): void {
    this.servers = servers;
    if (this.algorithm) {
      this.algorithm.updateServers(servers);
    }
    logger.debug('Servers updated', { count: String(servers.length) });
  }

  setCircuitBreakers(breakers: Map<string, CircuitBreaker>): void {
    this.circuitBreakers = breakers;
  }

  getPort(): number {
    return this.port;
  }

  private handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): void {
    const requestId = generateRequestId();
    const startTime = Date.now();
    const clientIp =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      '0.0.0.0';
