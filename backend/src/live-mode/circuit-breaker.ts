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

    if (this.state === 'half-open') {
      // Any failure in half-open trips back to open
      logger.warn('Failure in half-open state, tripping to open', {
        workerId: this.workerId,
      });
      this.transitionTo('open');
      return;
    }

    if (this.state === 'closed' && this.failureCount >= this.failureThreshold) {
      logger.warn('Failure threshold exceeded, tripping circuit', {
        workerId: this.workerId,
        failureCount: String(this.failureCount),
        threshold: String(this.failureThreshold),
      });
      this.transitionTo('open');
    }
  }

  getState(): CircuitBreakerState {
    return {
      workerId: this.workerId,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.lastStateChange,
      nextRetryTime: this.nextRetryTime,
    };
  }

  reset(): void {
    logger.info('Circuit breaker reset', { workerId: this.workerId });
    this.transitionTo('closed');
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();

    if (newState === 'closed') {
      this.failureCount = 0;
      this.successCount = 0;
      this.nextRetryTime = null;
      logger.info('Circuit closed', { workerId: this.workerId });
    } else if (newState === 'open') {
      this.successCount = 0;
      this.nextRetryTime = Date.now() + this.resetTimeout;
      logger.warn('Circuit opened', {
        workerId: this.workerId,
        nextRetryTime: String(this.nextRetryTime),
      });
    } else if (newState === 'half-open') {
      this.successCount = 0;
      this.nextRetryTime = null;
      logger.info('Circuit half-open', { workerId: this.workerId });
    }

    logger.debug('State transition', {
      workerId: this.workerId,
      from: oldState,
      to: newState,
    });
  }
}

export { CircuitBreaker };
