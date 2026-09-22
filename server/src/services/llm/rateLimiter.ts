export interface RateLimiterOptions {
  minIntervalMs?: number; // Minimum time between consecutive calls
  maxRetries?: number;
  baseDelayMs?: number;
}

export class LLMRateLimiter {
  private lastCallTime: number = 0;
  private minIntervalMs: number;
  private maxRetries: number;
  private baseDelayMs: number;
  private queue: Promise<void> = Promise.resolve();

  constructor(options: RateLimiterOptions = {}) {
    this.minIntervalMs = options.minIntervalMs ?? 1500;
    this.maxRetries = options.maxRetries ?? 5;
    this.baseDelayMs = options.baseDelayMs ?? 2000;
  }

  private async waitTurn(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;
    const waitTime = Math.max(0, this.minIntervalMs - timeSinceLastCall);

    if (waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    this.lastCallTime = Date.now();
  }

  /**
   * Schedules a task through the rate-limited queue with exponential backoff and jitter.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Chain onto queue to serialize requests
    return new Promise<T>((resolve, reject) => {
      this.queue = this.queue.then(async () => {
        let attempt = 0;

        while (true) {
          try {
            await this.waitTurn();
            const result = await fn();
            resolve(result);
            return;
          } catch (err: unknown) {
            attempt++;
            const errorMessage = err instanceof Error ? err.message : String(err);
            const isRateLimit =
              errorMessage.includes('429') ||
              errorMessage.includes('RESOURCE_EXHAUSTED') ||
              errorMessage.includes('rate limit') ||
              errorMessage.includes('quota') ||
              errorMessage.includes('slow down');

            const isTransient =
              isRateLimit ||
              errorMessage.includes('503') ||
              errorMessage.includes('500') ||
              errorMessage.includes('ETIMEDOUT') ||
              errorMessage.includes('ECONNRESET');

            if (attempt <= this.maxRetries && isTransient) {
              // Exponential backoff with random jitter: (2^attempt * base) + [0..1000]ms
              const jitter = Math.floor(Math.random() * 1000);
              const backoffMs =
                this.baseDelayMs * Math.pow(2, attempt - 1) + jitter;

              console.warn(
                `[LLMRateLimiter] Rate limit or transient error detected (attempt ${attempt}/${this.maxRetries}). Backing off for ${backoffMs}ms... Error: ${errorMessage.slice(0, 100)}`
              );

              await new Promise((res) => setTimeout(res, backoffMs));
            } else {
              reject(err);
              return;
            }
          }
        }
      });
    });
  }
}

export const defaultRateLimiter = new LLMRateLimiter({
  minIntervalMs: 1500,
  maxRetries: 5,
  baseDelayMs: 2500,
});
