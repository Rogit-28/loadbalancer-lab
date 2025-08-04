import { CircuitState, CircuitBreakerState } from '../types';
import { createLogger } from '../logger';

const logger = createLogger('circuit-breaker');

class CircuitBreaker {
  private workerId: string;
  private state: CircuitState = 'closed';
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number | null = null;
  private lastStateChange: number = Date.now();
  private nextRetryTime: number | null = null;

  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly halfOpenMaxRequests: number;

  constructor(
    workerId: string,
    config: {
      failureThreshold: number;
      resetTimeout: number;
      halfOpenMaxRequests: number;
    }
  ) {
    this.workerId = workerId;
    this.failureThreshold = config.failureThreshold;
    this.resetTimeout = config.resetTimeout;
    this.halfOpenMaxRequests = config.halfOpenMaxRequests;
    logger.info('Circuit breaker created', { workerId });
  }

  canRequest(): boolean {
    if (this.state === 'closed') {
      return true;
    }

    if (this.state === 'open') {
      // Check if enough time has passed to transition to half-open
      if (this.nextRetryTime !== null && Date.now() >= this.nextRetryTime) {
        this.transitionTo('half-open');
        return true;
      }
      return false;
    }

    // half-open: allow limited requests
    return true;
  }

  recordSuccess(): void {
    if (this.state === 'half-open') {
      this.successCount++;
      logger.debug('Success recorded in half-open state', {
        workerId: this.workerId,
        successCount: String(this.successCount),
        threshold: String(this.halfOpenMaxRequests),
      });
      if (this.successCount >= this.halfOpenMaxRequests) {
        this.transitionTo('closed');
      }
    } else if (this.state === 'closed') {
      // Reset failure count on success in closed state
      this.failureCount = 0;
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
