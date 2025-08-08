import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreaker } from './circuit-breaker';

const defaultConfig = {
  failureThreshold: 5,
  resetTimeout: 1000, // 1 second for fast tests
  halfOpenMaxRequests: 3,
};

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker('worker-1', defaultConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should start in closed state', () => {
    const state = cb.getState();
    expect(state.state).toBe('closed');
    expect(state.workerId).toBe('worker-1');
    expect(state.failureCount).toBe(0);
    expect(state.successCount).toBe(0);
  });

  it('should allow requests when closed (canRequest returns true)', () => {
    expect(cb.canRequest()).toBe(true);
  });

  it('should reset failure count on success in closed state', () => {
    // Record some failures (but not enough to trip)
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState().failureCount).toBe(2);

    // Success resets the failure count
    cb.recordSuccess();
    expect(cb.getState().failureCount).toBe(0);
  });

  it('should trip to open state after reaching failure threshold', () => {
    for (let i = 0; i < 5; i++) {
      cb.recordFailure();
    }
    expect(cb.getState().state).toBe('open');
    expect(cb.getState().failureCount).toBe(5);
  });

  it('should deny requests when open (canRequest returns false)', () => {
    // Trip the circuit
    for (let i = 0; i < 5; i++) {
      cb.recordFailure();
    }
    expect(cb.getState().state).toBe('open');
    expect(cb.canRequest()).toBe(false);
  });

  it('should auto-transition to half-open after resetTimeout', () => {
    // Trip the circuit
    for (let i = 0; i < 5; i++) {
      cb.recordFailure();
    }
    expect(cb.getState().state).toBe('open');

    // Advance time past the resetTimeout
    const nextRetryTime = cb.getState().nextRetryTime;
    expect(nextRetryTime).not.toBeNull();

    vi.spyOn(Date, 'now').mockReturnValue(nextRetryTime! + 1);

    // canRequest should trigger transition to half-open
    expect(cb.canRequest()).toBe(true);
    expect(cb.getState().state).toBe('half-open');
  });

  it('should close circuit after enough successes in half-open state', () => {
    // Trip the circuit
    for (let i = 0; i < 5; i++) {
      cb.recordFailure();
    }
    expect(cb.getState().state).toBe('open');

    // Advance time past resetTimeout to get to half-open
    const nextRetryTime = cb.getState().nextRetryTime;
    vi.spyOn(Date, 'now').mockReturnValue(nextRetryTime! + 1);
    cb.canRequest(); // triggers transition to half-open
    expect(cb.getState().state).toBe('half-open');

    vi.restoreAllMocks();

    // Record halfOpenMaxRequests successes (3)
    cb.recordSuccess();
    cb.recordSuccess();
    expect(cb.getState().state).toBe('half-open');
    cb.recordSuccess(); // 3rd success should close
    expect(cb.getState().state).toBe('closed');
    expect(cb.getState().failureCount).toBe(0);
    expect(cb.getState().successCount).toBe(0);
  });

  it('should trip back to open on failure in half-open state', () => {
    // Trip the circuit
    for (let i = 0; i < 5; i++) {
      cb.recordFailure();
    }

    // Advance time to get to half-open
    const nextRetryTime = cb.getState().nextRetryTime;
    vi.spyOn(Date, 'now').mockReturnValue(nextRetryTime! + 1);
    cb.canRequest();
    expect(cb.getState().state).toBe('half-open');

    vi.restoreAllMocks();

    // Any failure in half-open trips back to open
    cb.recordFailure();
    expect(cb.getState().state).toBe('open');
  });

  it('should return to closed state on reset()', () => {
    // Trip the circuit
    for (let i = 0; i < 5; i++) {
      cb.recordFailure();
    }
    expect(cb.getState().state).toBe('open');

    cb.reset();
    expect(cb.getState().state).toBe('closed');
    expect(cb.getState().failureCount).toBe(0);
    expect(cb.getState().successCount).toBe(0);
    expect(cb.getState().nextRetryTime).toBeNull();
  });

  it('should return correct CircuitBreakerState from getState()', () => {
    const state = cb.getState();
    expect(state).toEqual(
      expect.objectContaining({
        workerId: 'worker-1',
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        lastFailureTime: null,
        nextRetryTime: null,
      })
    );
    expect(typeof state.lastStateChange).toBe('number');
  });
});
