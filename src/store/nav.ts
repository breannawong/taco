export type View = { name: 'home' } | { name: 'list'; id: string }

export type FilterId = 'all' | 'left' | 'mine'

const VIEW_KEY = 'taco.view'
const FILTER_KEY = 'taco.filter'
const COLLAPSED_KEY = 'taco.collapsed'

type Listener = () => void

let view: View = loadView()
let filter: FilterId = loadFilter()
let collapsed = new Set<string>(loadCollapsed())
const listeners = new Set<Listener>()

function loadView(): View {
  try {
    const raw = localStorage.getItem(VIEW_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as View
      if (parsed?.name === 'home') return { name: 'home' }
      if (parsed?.name === 'list' && typeof parsed.id === 'string') return parsed
    }
  } catch {
    // ignore
  }
  return { name: 'home' }
}

function loadFilter(): FilterId {
  try {
    const raw = localStorage.getItem(FILTER_KEY)
    if (raw === 'all' || raw === 'left' || raw === 'mine') return raw
  } catch {
    // ignore
  }
  return 'all'
}

function loadCollapsed(): string[] {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === 'string')
    }
  } catch {
    // ignore
  }
  return []
}

function persist(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore
  }
}

function emit() {
  for (const listener of listeners) listener()
}

export function getView(): View {
  return view
}

export function getFilter(): FilterId {
  return filter
}

export function getCollapsed(): Set<string> {
  return collapsed
}

export function subscribeNav(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function goHome(): void {
  view = { name: 'home' }
  persist(VIEW_KEY, view)
  emit()
  window.scrollTo(0, 0)
}

export function openList(id: string): void {
  view = { name: 'list', id }
  persist(VIEW_KEY, view)
  emit()
  window.scrollTo(0, 0)
}

export function setFilter(next: FilterId): void {
  filter = next
  persist(FILTER_KEY, filter)
  emit()
}

export function toggleCollapsed(listId: string, sectionId: string): void {
  const key = `${listId}:${sectionId}`
  const next = new Set(collapsed)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  collapsed = next
  persist(COLLAPSED_KEY, [...collapsed])
  emit()
}

export function isCollapsed(listId: string, sectionId: string): boolean {
  return collapsed.has(`${listId}:${sectionId}`)
}
