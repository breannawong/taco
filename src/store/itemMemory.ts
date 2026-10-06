import type { PersonId, StoreData, Who } from './types'

/** One remembered item name → last section + who (from newest matching item). */
export type ItemMemory = {
  /** Display casing from the most recent use. */
  text: string
  sectionName: string
  who: Who
  createdAt: number
}

function norm(text: string): string {
  return text.trim().toLowerCase()
}

/**
 * Latest use of each item name across the household (templates + trips).
 * Keyed by lowercased text; most recent `createdAt` wins.
 * Moving an item updates its section; if that item is still the newest of
 * that name, the remembered section follows.
 */
export function itemMemoryMap(data: StoreData): Map<string, ItemMemory> {
  const map = new Map<string, ItemMemory>()
  for (const item of data.items) {
    const key = norm(item.text)
    if (!key) continue
    const section = data.sections.find((s) => s.id === item.sectionId)
    if (!section) continue
    const prev = map.get(key)
    if (prev && item.createdAt < prev.createdAt) continue
    if (prev && item.createdAt === prev.createdAt) continue
    map.set(key, {
      text: item.text.trim(),
      sectionName: section.name,
      who: item.who,
      createdAt: item.createdAt,
    })
  }
  return map
}

export function memoryForText(
  text: string,
  data: StoreData,
): ItemMemory | null {
  const key = norm(text)
  if (!key) return null
  return itemMemoryMap(data).get(key) ?? null
}

/** Matching names while typing, most recent use first. */
export function suggestItemMemories(
  query: string,
  data: StoreData,
  limit = 8,
): ItemMemory[] {
  const q = norm(query)
  if (!q) return []
  const all = [...itemMemoryMap(data).values()]
  return all
    .filter((m) => norm(m.text).includes(q))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
}

/**
 * Shared/Each stay; a person who stays if they're packing on this list;
 * otherwise fall back to Each.
 */
export function whoForListMemory(
  who: Who,
  travelerIds: PersonId[],
): Who {
  if (who === 'shared' || who === 'each') return who
  if (travelerIds.includes(who)) return who
  return 'each'
}
