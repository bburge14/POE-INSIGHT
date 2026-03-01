/**
 * RateLimiter: Ensures compliance with PoE2 API rate limits.
 *
 * Respects `retry-after` headers and implements exponential backoff.
 * GGG will IP-ban aggressive scrapers — this is the #1 reason trade tools fail.
 */
export class RateLimiter {
  private nextAllowedTime: number = 0;
  private consecutiveErrors: number = 0;
  private readonly maxBackoffMs: number;
  private readonly baseIntervalMs: number;

  constructor(baseIntervalMs: number = 1500, maxBackoffMs: number = 60_000) {
    this.baseIntervalMs = baseIntervalMs;
    this.maxBackoffMs = maxBackoffMs;
  }

  /**
   * Returns the number of milliseconds to wait before the next request.
   */
  getDelay(): number {
    const now = Date.now();
    if (this.nextAllowedTime > now) {
      return this.nextAllowedTime - now;
    }
    return 0;
  }

  /**
   * Wait until we're allowed to make the next request.
   */
  async waitForSlot(): Promise<void> {
    const delay = this.getDelay();
    if (delay > 0) {
      await this.sleep(delay);
    }
  }

  /**
   * Record a successful response. Resets backoff and schedules next allowed time.
   */
  recordSuccess(): void {
    this.consecutiveErrors = 0;
    this.nextAllowedTime = Date.now() + this.baseIntervalMs;
  }

  /**
   * Record an error response. If a retry-after header is present, use it.
   * Otherwise, apply exponential backoff.
   */
  recordError(retryAfterSeconds?: number): void {
    this.consecutiveErrors++;

    if (retryAfterSeconds !== undefined && retryAfterSeconds > 0) {
      // API told us exactly when to retry — respect it
      this.nextAllowedTime = Date.now() + retryAfterSeconds * 1000;
    } else {
      // Exponential backoff: 2s, 4s, 8s, 16s, ... capped at maxBackoffMs
      const backoff = Math.min(
        Math.pow(2, this.consecutiveErrors) * 1000,
        this.maxBackoffMs
      );
      this.nextAllowedTime = Date.now() + backoff;
    }
  }

  /**
   * Parse retry-after from HTTP response headers.
   */
  static parseRetryAfter(headers: Record<string, string | undefined>): number | undefined {
    const value = headers['retry-after'] || headers['Retry-After'];
    if (value === undefined) return undefined;

    const seconds = parseInt(value, 10);
    if (!isNaN(seconds) && seconds > 0) {
      return seconds;
    }

    // Could be an HTTP date
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      const delta = Math.ceil((date.getTime() - Date.now()) / 1000);
      return delta > 0 ? delta : 1;
    }

    return undefined;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
