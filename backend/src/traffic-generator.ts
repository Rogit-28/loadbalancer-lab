import { EventEmitter } from 'events';
import { generateServerId } from './server';

class TrafficGenerator extends EventEmitter {
  private rate: number = 100;
  private pattern: 'steady' | 'burst' | 'spike' = 'steady';
  private speed: number = 1;
  private isRunning: boolean = false;
  private interval: NodeJS.Timeout | null = null;
  private patternStartTime: number = 0;

  constructor() {
    super();
  }

  setRate(rate: number): void {
    this.rate = Math.max(1, Math.min(10000, rate));
    if (this.isRunning) {
      this.restart();
    }
  }

  setPattern(pattern: 'steady' | 'burst' | 'spike'): void {
    this.pattern = pattern;
    this.patternStartTime = Date.now();
    if (this.isRunning) {
      this.restart();
    }
  }

  setSpeed(speed: number): void {
    this.speed = Math.max(0.1, Math.min(10, speed));
    if (this.isRunning) {
      this.restart();
    }
  }

  private restart(): void {
    this.stop();
    setTimeout(() => this.start(), 50);
  }

  /**
   * Compute the effective rate multiplier based on the current traffic pattern.
   * - steady: always 1x
   * - burst: alternating 3s at 5x and 3s at 0.3x
   * - spike: mostly 1x, with random 0.5s spikes at 8x every 5-10s
   */
  private getPatternMultiplier(): number {
    const elapsed = Date.now() - this.patternStartTime;

    switch (this.pattern) {
      case 'steady':
        return 1;

      case 'burst': {
        // 6-second cycle: 3s high (5x), 3s low (0.3x)
        const cyclePosition = elapsed % 6000;
        return cyclePosition < 3000 ? 5 : 0.3;
      }

      case 'spike': {
        // Use a deterministic spike schedule:
        // every 7 seconds, spike for 500ms at 8x rate
        const cyclePosition = elapsed % 7000;
        return cyclePosition < 500 ? 8 : 1;
      }

      default:
        return 1;
    }
  }

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.patternStartTime = Date.now();

    // Use a fast tick (every 10ms) and probabilistically emit requests
    // This allows smooth pattern transitions without restarting intervals
    const TICK_MS = 10;

    this.interval = setInterval(() => {
      const multiplier = this.getPatternMultiplier();
      const effectiveRate = this.rate * multiplier * this.speed;

      // Expected requests per tick
      const requestsPerTick = effectiveRate * (TICK_MS / 1000);

      // Emit whole requests, use fractional part as probability for one more
      const wholeRequests = Math.floor(requestsPerTick);
      const fractional = requestsPerTick - wholeRequests;

      const totalRequests = wholeRequests + (Math.random() < fractional ? 1 : 0);

      for (let i = 0; i < totalRequests; i++) {
        const clientIps = [
          `192.168.1.${Math.floor(Math.random() * 255)}`,
          `10.0.0.${Math.floor(Math.random() * 255)}`,
          `172.16.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
        ];

        const clientIp = clientIps[Math.floor(Math.random() * clientIps.length)];

        this.emit('request', {
          requestId: generateServerId(),
          clientIp,
          timestamp: Date.now()
        });
      }
    }, TICK_MS);
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      rate: this.rate,
      pattern: this.pattern,
      speed: this.speed
    };
  }
}

export { TrafficGenerator };
