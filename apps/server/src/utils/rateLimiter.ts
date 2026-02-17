export class SlidingWindowRateLimiter {
  private readonly history = new Map<string, number[]>();

  allow(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const existing = this.history.get(key) ?? [];
    const recent = existing.filter((timestamp) => now - timestamp < windowMs);

    if (recent.length >= limit) {
      this.history.set(key, recent);
      return false;
    }

    recent.push(now);
    this.history.set(key, recent);
    return true;
  }

  cleanup(maxAgeMs: number): void {
    const now = Date.now();
    for (const [key, timestamps] of this.history.entries()) {
      const recent = timestamps.filter((timestamp) => now - timestamp < maxAgeMs);
      if (recent.length === 0) {
        this.history.delete(key);
      } else {
        this.history.set(key, recent);
      }
    }
  }
}
