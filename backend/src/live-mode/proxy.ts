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

    if (!this.algorithm) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No algorithm configured' }));
      return;
    }

    const targetServer = this.algorithm.getNextServer(clientIp);

    if (!targetServer) {
      const proxyRequest: ProxyRequest = {
        id: requestId,
        method: req.method || 'GET',
        url: req.url || '/',
        clientIp,
        targetWorkerId: '',
        targetHost: '',
        targetPort: 0,
        startTime,
        endTime: Date.now(),
        responseTime: Date.now() - startTime,
        statusCode: 503,
        success: false,
        error: 'No healthy servers available',
      };
      this.emit('request-completed', proxyRequest);

      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No healthy servers available' }));
      return;
    }

    // Check circuit breaker
    const breaker = this.circuitBreakers.get(targetServer.id);
    if (breaker && !breaker.canRequest()) {
      const proxyRequest: ProxyRequest = {
        id: requestId,
        method: req.method || 'GET',
        url: req.url || '/',
        clientIp,
        targetWorkerId: targetServer.id,
        targetHost: targetServer.host,
        targetPort: targetServer.port,
        startTime,
        endTime: Date.now(),
        responseTime: Date.now() - startTime,
        statusCode: 503,
        success: false,
        error: 'Circuit breaker open',
      };
      this.emit('request-completed', proxyRequest);

      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Service temporarily unavailable' }));
      return;
    }

    this.forwardRequest(
      req,
      res,
      targetServer,
      requestId,
      clientIp,
      startTime,
      breaker
    );
  }

  private forwardRequest(
    clientReq: http.IncomingMessage,
    clientRes: http.ServerResponse,
    target: Server,
    requestId: string,
    clientIp: string,
    startTime: number,
    breaker: CircuitBreaker | undefined
  ): void {
    const options: http.RequestOptions = {
      hostname: target.host,
      port: target.port,
      path: clientReq.url || '/',
      method: clientReq.method || 'GET',
      headers: {
        ...clientReq.headers,
        host: `${target.host}:${target.port}`,
        'x-forwarded-for': clientIp,
        'x-request-id': requestId,
      },
      timeout: CONNECTION_TIMEOUT,
    };

    const proxyReq = http.request(options, (proxyRes: http.IncomingMessage) => {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      const statusCode = proxyRes.statusCode || 500;
      const success = statusCode >= 200 && statusCode < 500;

      if (success) {
        breaker?.recordSuccess();
      } else {
        breaker?.recordFailure();
      }