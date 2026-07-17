export class CooldownTracker {
  private until: number[] = [0, 0, 0, 0]

  canUse(slot: number, now: number): boolean {
    return now >= (this.until[slot] ?? 0)
  }

  use(slot: number, now: number, cooldownMs: number): void {
    this.until[slot] = now + cooldownMs
  }

  remainingMs(slot: number, now: number): number {
    return Math.max(0, (this.until[slot] ?? 0) - now)
  }
}
