/**
 * Counts failed attempts per key (an email address, a client IP) in a sliding
 * window, so guessing passwords or probing for accounts slows to a crawl.
 * Successful attempts are never counted.
 * ponytail: in memory, so one API process; a restart forgets the counts and
 * several API instances would each keep their own. Move the counts to
 * Postgres if the app ever runs more than one instance.
 */
export class FailureLimiter {
  private readonly failures = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Milliseconds until `key` may try again; 0 when it may try now. */
  retryAfterMs(key: string): number {
    const recent = this.recent(key);
    if (recent.length < this.max) return 0;
    return recent[recent.length - this.max]! + this.windowMs - this.now();
  }

  fail(key: string): void {
    const recent = this.recent(key);
    recent.push(this.now());
    this.failures.set(key, recent);
  }

  clear(key: string): void {
    this.failures.delete(key);
  }

  private recent(key: string): number[] {
    const since = this.now() - this.windowMs;
    const recent = (this.failures.get(key) ?? []).filter((t) => t > since);
    if (recent.length === 0) this.failures.delete(key);
    else this.failures.set(key, recent);
    return recent;
  }
}
