import { createSeedData } from './seed'
import type { StoreData } from './types'

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
