import { createSeedData } from './seed'
import type { Item, Person, PersonId, StoreData, Who } from './types'
import { newId, nextPosition, renumberPositions } from './who'

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
export { WHO_OPTIONS, getLastWho, setLastWho, newId } from './who'

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

export function addItem(
  listId: string,
  sectionId: string,
  text: string,
  who: Who,
): Item {
  const list = state.lists.find((l) => l.id === listId)
  const siblings = state.items.filter(
    (i) => i.listId === listId && i.sectionId === sectionId,
  )
  const item: Item = {
    id: newId(),
    listId,
    sectionId,
    text,
    who,
    position: nextPosition(siblings),
    ...(list?.kind === 'trip' ? { tripOnly: true } : {}),
  }
  setState({ ...state, items: [...state.items, item] })
  return item
}

export function updateItem(
  itemId: string,
  patch: { text?: string; who?: Who; sectionId?: string },
): void {
  const item = state.items.find((i) => i.id === itemId)
  if (!item) return

  let next = { ...item, ...patch }
  if (patch.sectionId && patch.sectionId !== item.sectionId) {
    const siblings = state.items.filter(
      (i) =>
        i.listId === item.listId &&
        i.sectionId === patch.sectionId &&
        i.id !== itemId,
    )
    next = { ...next, position: nextPosition(siblings) }
  }

  setState({
    ...state,
    items: state.items.map((i) => (i.id === itemId ? next : i)),
  })
}

export function deleteItem(itemId: string): void {
  const item = state.items.find((i) => i.id === itemId)
  if (!item) return
  setState({
    ...state,
    items: state.items.filter((i) => i.id !== itemId),
    checks: state.checks.filter((c) => c.itemId !== itemId),
  })
}

/** Move item within its section. dir: -1 up, +1 down. Returns false if blocked. */
export function moveItem(itemId: string, dir: -1 | 1): boolean {
  const item = state.items.find((i) => i.id === itemId)
  if (!item) return false
  const sibs = state.items
    .filter((i) => i.listId === item.listId && i.sectionId === item.sectionId)
    .sort((a, b) => a.position - b.position)
  const i = sibs.findIndex((s) => s.id === itemId)
  const j = i + dir
  if (j < 0 || j >= sibs.length) return false
  const swapped = [...sibs]
  ;[swapped[i], swapped[j]] = [swapped[j]!, swapped[i]!]
  const renumbered = renumberPositions(swapped)
  const byId = new Map(renumbered.map((r) => [r.id, r.position]))
  setState({
    ...state,
    items: state.items.map((it) =>
      byId.has(it.id) ? { ...it, position: byId.get(it.id)! } : it,
    ),
  })
  return true
}

export function addSection(listId: string, name: string): void {
  const siblings = state.sections.filter((s) => s.listId === listId)
  setState({
    ...state,
    sections: [
      ...state.sections,
      {
        id: newId(),
        listId,
        name,
        position: nextPosition(siblings),
      },
    ],
  })
}

export function updateSection(sectionId: string, name: string): void {
  setState({
    ...state,
    sections: state.sections.map((s) =>
      s.id === sectionId ? { ...s, name } : s,
    ),
  })
}

export function deleteSection(sectionId: string): void {
  const section = state.sections.find((s) => s.id === sectionId)
  if (!section) return
  const itemIds = new Set(
    state.items.filter((i) => i.sectionId === sectionId).map((i) => i.id),
  )
  setState({
    ...state,
    sections: state.sections.filter((s) => s.id !== sectionId),
    items: state.items.filter((i) => i.sectionId !== sectionId),
    checks: state.checks.filter((c) => !itemIds.has(c.itemId)),
  })
}

export function moveSection(sectionId: string, dir: -1 | 1): boolean {
  const section = state.sections.find((s) => s.id === sectionId)
  if (!section) return false
  const sibs = state.sections
    .filter((s) => s.listId === section.listId)
    .sort((a, b) => a.position - b.position)
  const i = sibs.findIndex((s) => s.id === sectionId)
  const j = i + dir
  if (j < 0 || j >= sibs.length) return false
  const swapped = [...sibs]
  ;[swapped[i], swapped[j]] = [swapped[j]!, swapped[i]!]
  const renumbered = renumberPositions(swapped)
  const byId = new Map(renumbered.map((r) => [r.id, r.position]))
  setState({
    ...state,
    sections: state.sections.map((s) =>
      byId.has(s.id) ? { ...s, position: byId.get(s.id)! } : s,
    ),
  })
  return true
}

export function renameList(listId: string, name: string): void {
  setState({
    ...state,
    lists: state.lists.map((l) => (l.id === listId ? { ...l, name } : l)),
  })
}

export function deleteList(listId: string): void {
  setState({
    ...state,
    lists: state.lists.filter((l) => l.id !== listId),
    sections: state.sections.filter((s) => s.listId !== listId),
    items: state.items.filter((i) => i.listId !== listId),
    checks: state.checks.filter((c) => c.listId !== listId),
  })
}

export function clearChecks(listId: string): void {
  setState({
    ...state,
    checks: state.checks.filter((c) => c.listId !== listId),
  })
}

/**
 * Copy trip-only items onto the template (matching section via sourceSectionId),
 * then clear tripOnly on the trip items.
 */
export function promoteItems(listId: string, itemIds: string[]): string | null {
  const list = state.lists.find((l) => l.id === listId)
  if (!list?.templateId) return null
  const templateId = list.templateId
  const template = state.lists.find((l) => l.id === templateId)
  if (!template) return null

  let sections = [...state.sections]
  let items = [...state.items]

  for (const itemId of itemIds) {
    const tripItem = items.find((i) => i.id === itemId && i.listId === listId)
    if (!tripItem) continue

    const tripSection = sections.find((s) => s.id === tripItem.sectionId)
    let templateSectionId = tripSection?.sourceSectionId
    let templateSection = templateSectionId
      ? sections.find((s) => s.id === templateSectionId)
      : undefined

    if (!templateSection && tripSection) {
      templateSection = sections.find(
        (s) => s.listId === templateId && s.name === tripSection.name,
      )
      templateSectionId = templateSection?.id
    }

    if (!templateSection) {
      const newSec = {
        id: newId(),
        listId: templateId,
        name: tripSection?.name ?? 'General',
        position: nextPosition(sections.filter((s) => s.listId === templateId)),
      }
      sections = [...sections, newSec]
      templateSectionId = newSec.id
      if (tripSection) {
        sections = sections.map((s) =>
          s.id === tripSection.id ? { ...s, sourceSectionId: newSec.id } : s,
        )
      }
    }

    const tplSiblings = items.filter(
      (i) => i.listId === templateId && i.sectionId === templateSectionId,
    )
    items = [
      ...items,
      {
        id: newId(),
        listId: templateId,
        sectionId: templateSectionId!,
        text: tripItem.text,
        who: tripItem.who,
        position: nextPosition(tplSiblings),
      },
    ]
    items = items.map((i) =>
      i.id === itemId ? { ...i, tripOnly: false } : i,
    )
  }

  setState({ ...state, sections, items })
  return template.name
}
