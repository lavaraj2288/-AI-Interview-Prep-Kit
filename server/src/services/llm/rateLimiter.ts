export class RateLimiter {
  private minIntervalMs: number;
  private lastCallTime: number = 0;

  constructor(requestsPerMinute: number = 15) {
    this.minIntervalMs = Math.ceil(60000 / requestsPerMinute);
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastCallTime;
    if (elapsed < this.minIntervalMs) {
      const waitTime = this.minIntervalMs - elapsed;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    this.lastCallTime = Date.now();
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 4,
    initialBackoffMs: number = 1500
  ): Promise<T> {
    let attempt = 0;
    let delay = initialBackoffMs;

    while (attempt <= maxRetries) {
      try {
        await this.acquire();
        return await operation();
      } catch (err: any) {
        attempt++;
        const isRateLimit = err?.status === 429 ||
          err?.message?.includes('429') ||
          err?.message?.toLowerCase().includes('quota') ||
          err?.message?.toLowerCase().includes('rate limit') ||
          err?.message?.toLowerCase().includes('slow down');

        if (attempt > maxRetries || !isRateLimit) {
          throw err;
        }

        // Exponential backoff with random jitter
        const jitter = Math.floor(Math.random() * 500);
        const totalWait = delay + jitter;
        console.warn(`[RateLimiter] Rate limit (429) hit. Backing off for ${totalWait}ms (Attempt ${attempt}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, totalWait));
        delay *= 2;
      }
    }

    throw new Error('Max retries exceeded in rate limiter');
  }
}

export const globalLlmRateLimiter = new RateLimiter(12);
