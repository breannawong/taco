import type { Who } from './types'

export const WHO_OPTIONS: { id: Who; label: string; hint: string }[] = [
  {
    id: 'shared',
    label: 'Shared',
    hint: 'One check covers the household. Tent, stove, first aid.',
  },
  {
    id: 'each',
    label: 'Each',
    hint: 'Everyone packs their own. Done when both of you check it.',
  },
  { id: 'dustin', label: 'Dustin only', hint: 'Only Dustin packs this.' },
  { id: 'brea', label: 'Brea only', hint: 'Only Brea packs this.' },
]

const LAST_WHO_KEY = 'taco.lastWho'

export function getLastWho(): Who {
  try {
    const raw = localStorage.getItem(LAST_WHO_KEY)
    if (raw && WHO_OPTIONS.some((w) => w.id === raw)) return raw as Who
  } catch {
    // ignore
  }
  return 'shared'
}

export function setLastWho(who: Who): void {
  try {
    localStorage.setItem(LAST_WHO_KEY, who)
  } catch {
    // ignore
  }
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2, 11)
}

export function nextPosition(rows: { position: number }[]): number {
  if (rows.length === 0) return 1000
  return Math.max(...rows.map((r) => r.position)) + 1000
}

/** Re-number siblings 1000, 2000, … after a swap. */
export function renumberPositions<T extends { id: string; position: number }>(
  ordered: T[],
): T[] {
  return ordered.map((row, i) => ({ ...row, position: (i + 1) * 1000 }))
}
