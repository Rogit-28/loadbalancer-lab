/** Contract that both simulation and live mode handlers must implement */
interface ModeHandler {
  start(): Promise<void>;
  stop(): Promise<void>;
  getMetrics(): unknown;
  isActive(): boolean;
}

export { ModeHandler };
