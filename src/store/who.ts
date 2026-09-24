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

/** UUID suitable for Supabase. Works on HTTP LAN (phones) where randomUUID is blocked. */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID()
    } catch {
      // Not a secure context (common on http://192.168.x.x) — fall through.
    }
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    // RFC 4122 version 4
    bytes[6] = (bytes[6]! & 0x0f) | 0x40
    bytes[8] = (bytes[8]! & 0x3f) | 0x80
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
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
