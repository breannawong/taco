import { createSeedData } from './seed'
import type { Item, Person, PersonId, StoreData } from './types'

export type { StoreData } from './types'
export type {
  Check,
  Item,
  List,
  ListProgress,
  Person,
  PersonId,
  PersonProgress,
  Section,
  Who,
} from './types'
export { doneFor, isDone, owes, progress } from './helpers'
export { PEOPLE } from './seed'

/** Label for the who-packs-it meta line. */
export function whoLabel(item: Item, people: Person[]): string {
  if (item.who === 'shared') return 'Shared'
  if (item.who === 'each') return 'Each'
  const person = people.find((p) => p.id === item.who)
  return person ? `${person.name}'s` : '?'
}

const STORAGE_KEY = 'taco.v1'

type Listener = () => void

let state: StoreData = loadInitial()
const listeners = new Set<Listener>()

function loadInitial(): StoreData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as StoreData
      if (isValidStore(parsed)) return parsed
    }
  } catch {
    // Corrupt or unavailable — fall through to seed.
  }
  const seed = createSeedData()
  persist(seed)
  return seed
}

function isValidStore(data: unknown): data is StoreData {
  if (!data || typeof data !== 'object') return false
  const d = data as StoreData
  return (
    Array.isArray(d.people) &&
    Array.isArray(d.lists) &&
    Array.isArray(d.sections) &&
    Array.isArray(d.items) &&
    Array.isArray(d.checks)
  )
}

function persist(data: StoreData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Quota or private mode — app still works in memory.
  }
}

function emit() {
  for (const listener of listeners) listener()
}

function setState(next: StoreData) {
  state = next
  persist(state)
  emit()
}

/** Current store snapshot. Prefer useStore() in React components. */
export function getStore(): StoreData {
  return state
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Wipe local data and reload the Hiking + Utah sample. */
export function resetSampleData(): void {
  setState(createSeedData())
}

/** Toggle one person's check on an item (each / person who). */
export function togglePersonCheck(
  listId: string,
  itemId: string,
  personId: PersonId,
): void {
  const existing = state.checks.some(
    (c) => c.listId === listId && c.itemId === itemId && c.personId === personId,
  )
  if (existing) {
    setState({
      ...state,
      checks: state.checks.filter(
        (c) =>
          !(c.listId === listId && c.itemId === itemId && c.personId === personId),
      ),
    })
  } else {
    setState({
      ...state,
      checks: [
        ...state.checks,
        { listId, itemId, personId, checkedAt: Date.now() },
      ],
    })
  }
}

/**
 * Shared item: if anyone checked it, clear all checks;
 * otherwise check it as the current person.
 */
export function toggleSharedCheck(
  listId: string,
  itemId: string,
  personId: PersonId,
): void {
  const anyChecked = state.checks.some(
    (c) => c.listId === listId && c.itemId === itemId,
  )
  if (anyChecked) {
    setState({
      ...state,
      checks: state.checks.filter(
        (c) => !(c.listId === listId && c.itemId === itemId),
      ),
    })
  } else {
    setState({
      ...state,
      checks: [
        ...state.checks,
        { listId, itemId, personId, checkedAt: Date.now() },
      ],
    })
  }
}
