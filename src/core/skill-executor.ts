// Coût en énergie d'un skill, dérivé de sa puissance (multiplicateur).
// Borné à [10, 45] pour rester lançable avec 100 d'énergie max.
export function energyCostOf(skill: { multiplier: number }): number {
  return Math.round(Math.min(45, Math.max(10, skill.multiplier * 12)))
}

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
