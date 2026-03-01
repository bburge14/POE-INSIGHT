import { PoE2Item } from '../models/types';

/**
 * StreamBuffer: Collects items from the PoE2 API firehose and emits them
 * in batches at a fixed interval (default: every 10 seconds).
 *
 * This prevents the UI from refreshing 100 times a second. Instead,
 * we accumulate items and let the evaluator score them in bulk.
 */
export class StreamBuffer {
  private buffer: PoE2Item[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly windowMs: number;
  private readonly onFlush: (items: PoE2Item[]) => void;

  constructor(windowMs: number, onFlush: (items: PoE2Item[]) => void) {
    this.windowMs = windowMs;
    this.onFlush = onFlush;
  }

  /**
   * Add items to the buffer. They will be flushed on the next cycle.
   */
  push(items: PoE2Item[]): void {
    this.buffer.push(...items);
  }

  /**
   * Start the periodic flush timer.
   */
  start(): void {
    if (this.timer) return;

    this.timer = setInterval(() => {
      this.flush();
    }, this.windowMs);
  }

  /**
   * Stop the timer and flush any remaining items.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.flush();
  }

  /**
   * Manually flush the buffer, sending all accumulated items to the callback.
   */
  flush(): void {
    if (this.buffer.length === 0) return;

    const items = this.buffer.splice(0);
    this.onFlush(items);
  }

  /**
   * Current number of buffered items.
   */
  get size(): number {
    return this.buffer.length;
  }
}
