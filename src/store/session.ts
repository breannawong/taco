import type { PersonId } from './types'
import { PEOPLE } from './seed'

const ME_KEY = 'taco.me'

type Listener = () => void

let me: PersonId | null = loadMe()
const listeners = new Set<Listener>()

function loadMe(): PersonId | null {
  try {
    const raw = localStorage.getItem(ME_KEY)
    if (raw && PEOPLE.some((p) => p.id === raw)) return raw
  } catch {
    // ignore
  }
  return null
}

function persistMe(id: PersonId | null) {
  try {
    if (id == null) localStorage.removeItem(ME_KEY)
    else localStorage.setItem(ME_KEY, id)
  } catch {
    // ignore
  }
}

function emit() {
  for (const listener of listeners) listener()
}

export function getMe(): PersonId | null {
  return me
}

export function subscribeMe(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function setMe(id: PersonId): void {
  if (!PEOPLE.some((p) => p.id === id)) return
  me = id
  persistMe(me)
  emit()
}

/** Flip between Dustin and Brea. */
export function cycleMe(): PersonId {
  const i = PEOPLE.findIndex((p) => p.id === me)
  const next = PEOPLE[(i + 1) % PEOPLE.length]!.id
  setMe(next)
  return next
}

export function personById(id: PersonId) {
  return PEOPLE.find((p) => p.id === id)
}
