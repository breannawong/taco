import {
  cloudClearChecksForList,
  cloudDeleteCheck,
  cloudDeleteChecksForItem,
  cloudDeleteItem,
  cloudDeleteList,
  cloudDeleteSection,
  cloudInsertItems,
  cloudInsertList,
  cloudInsertSections,
  cloudUpdateItem,
  cloudUpdateItemPositions,
  cloudUpdateList,
  cloudUpdateSection,
  cloudUpdateSectionPositions,
  cloudUpsertCheck,
  fetchHouseholdStore,
  replaceHouseholdStore,
} from './cloud'
import { createSeedData, PEOPLE } from './seed'
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
type CloudWrite = (householdId: string) => Promise<void>

type StoreStatus = {
  /** False until connectHousehold finishes (or disconnect). */
  ready: boolean
  error: string | null
  householdId: string | null
}

function emptyStore(people: Person[] = PEOPLE): StoreData {
  return {
    people: people.map((p) => ({ ...p })),
    lists: [],
    sections: [],
    items: [],
    checks: [],
  }
}

let state: StoreData = emptyStore()
let status: StoreStatus = { ready: false, error: null, householdId: null }
const listeners = new Set<Listener>()

function persistLocal(data: StoreData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Quota or private mode — app still works in memory.
  }
}

function emit() {
  for (const listener of listeners) listener()
}

function setStatus(patch: Partial<StoreStatus>) {
  status = { ...status, ...patch }
  emit()
}

function setState(next: StoreData, cloud?: CloudWrite) {
  state = next
  persistLocal(state)
  emit()
  const hh = status.householdId
  if (hh && cloud) {
    void cloud(hh).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Sync failed'
      console.error('Taco cloud sync failed:', message)
    })
  }
}

/** Current store snapshot. Prefer useStore() in React components. */
export function getStore(): StoreData {
  return state
}

export function getStoreStatus(): StoreStatus {
  return status
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Load this household from Supabase (source of truth).
 * Empty household → upload Hiking + Utah sample once.
 */
export async function connectHousehold(householdId: string): Promise<void> {
  if (status.householdId === householdId && status.ready && !status.error) {
    return
  }

  setStatus({ ready: false, error: null, householdId })

  try {
    let data = await fetchHouseholdStore(householdId)
    if (data.lists.length === 0) {
      const seed = createSeedData()
      seed.people = data.people.length > 0 ? data.people : seed.people
      await replaceHouseholdStore(householdId, seed)
      data = seed
    }
    state = data
    persistLocal(state)
    setStatus({ ready: true, error: null, householdId })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Could not load lists'
    console.error(message)
    setStatus({ ready: true, error: message, householdId })
  }
}

/** Clear cloud binding on sign-out. */
export function disconnectHousehold(): void {
  status = { ready: false, error: null, householdId: null }
  state = emptyStore()
  emit()
}

/** Wipe household packing data and reload the Hiking + Utah sample. */
export function resetSampleData(): void {
  const seed = createSeedData()
  seed.people =
    state.people.length > 0 ? state.people.map((p) => ({ ...p })) : seed.people
  setState(seed, (hh) => replaceHouseholdStore(hh, seed))
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
    setState(
      {
        ...state,
        checks: state.checks.filter(
          (c) =>
            !(c.listId === listId && c.itemId === itemId && c.personId === personId),
        ),
      },
      (hh) => cloudDeleteCheck(hh, itemId, personId),
    )
  } else {
    const check = { listId, itemId, personId, checkedAt: Date.now() }
    setState(
      { ...state, checks: [...state.checks, check] },
      (hh) => cloudUpsertCheck(hh, check),
    )
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
    setState(
      {
        ...state,
        checks: state.checks.filter(
          (c) => !(c.listId === listId && c.itemId === itemId),
        ),
      },
      (hh) => cloudDeleteChecksForItem(hh, itemId),
    )
  } else {
    const check = { listId, itemId, personId, checkedAt: Date.now() }
    setState(
      { ...state, checks: [...state.checks, check] },
      (hh) => cloudUpsertCheck(hh, check),
    )
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
  setState({ ...state, items: [...state.items, item] }, (hh) =>
    cloudInsertItems(hh, [item]),
  )
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

  setState(
    {
      ...state,
      items: state.items.map((i) => (i.id === itemId ? next : i)),
    },
    (hh) => cloudUpdateItem(hh, next),
  )
}

export function deleteItem(itemId: string): void {
  const item = state.items.find((i) => i.id === itemId)
  if (!item) return
  setState(
    {
      ...state,
      items: state.items.filter((i) => i.id !== itemId),
      checks: state.checks.filter((c) => c.itemId !== itemId),
    },
    (hh) => cloudDeleteItem(hh, itemId),
  )
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
  const nextItems = state.items.map((it) =>
    byId.has(it.id) ? { ...it, position: byId.get(it.id)! } : it,
  )
  setState({ ...state, items: nextItems }, (hh) =>
    cloudUpdateItemPositions(
      hh,
      nextItems.filter((it) => byId.has(it.id)),
    ),
  )
  return true
}

export function addSection(listId: string, name: string): void {
  const siblings = state.sections.filter((s) => s.listId === listId)
  const section = {
    id: newId(),
    listId,
    name,
    position: nextPosition(siblings),
  }
  setState({ ...state, sections: [...state.sections, section] }, (hh) =>
    cloudInsertSections(hh, [section]),
  )
}

export function updateSection(sectionId: string, name: string): void {
  const section = state.sections.find((s) => s.id === sectionId)
  if (!section) return
  const next = { ...section, name }
  setState(
    {
      ...state,
      sections: state.sections.map((s) => (s.id === sectionId ? next : s)),
    },
    (hh) => cloudUpdateSection(hh, next),
  )
}

export function deleteSection(sectionId: string): void {
  const section = state.sections.find((s) => s.id === sectionId)
  if (!section) return
  const itemIds = new Set(
    state.items.filter((i) => i.sectionId === sectionId).map((i) => i.id),
  )
  setState(
    {
      ...state,
      sections: state.sections.filter((s) => s.id !== sectionId),
      items: state.items.filter((i) => i.sectionId !== sectionId),
      checks: state.checks.filter((c) => !itemIds.has(c.itemId)),
    },
    (hh) => cloudDeleteSection(hh, sectionId),
  )
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
  const nextSections = state.sections.map((s) =>
    byId.has(s.id) ? { ...s, position: byId.get(s.id)! } : s,
  )
  setState({ ...state, sections: nextSections }, (hh) =>
    cloudUpdateSectionPositions(
      hh,
      nextSections.filter((s) => byId.has(s.id)),
    ),
  )
  return true
}

export function renameList(listId: string, name: string): void {
  setState(
    {
      ...state,
      lists: state.lists.map((l) => (l.id === listId ? { ...l, name } : l)),
    },
    (hh) => cloudUpdateList(hh, listId, { name }),
  )
}

export function deleteList(listId: string): void {
  setState(
    {
      ...state,
      lists: state.lists.filter((l) => l.id !== listId),
      sections: state.sections.filter((s) => s.listId !== listId),
      items: state.items.filter((i) => i.listId !== listId),
      checks: state.checks.filter((c) => c.listId !== listId),
    },
    (hh) => cloudDeleteList(hh, listId),
  )
}

export function clearChecks(listId: string): void {
  setState(
    {
      ...state,
      checks: state.checks.filter((c) => c.listId !== listId),
    },
    (hh) => cloudClearChecksForList(hh, listId),
  )
}

/** Persist a new section order for a list (ids top → bottom). */
export function setSectionOrder(listId: string, orderedIds: string[]): void {
  const byId = new Map(orderedIds.map((id, i) => [id, (i + 1) * 1000]))
  const nextSections = state.sections.map((s) =>
    s.listId === listId && byId.has(s.id)
      ? { ...s, position: byId.get(s.id)! }
      : s,
  )
  setState({ ...state, sections: nextSections }, (hh) =>
    cloudUpdateSectionPositions(
      hh,
      nextSections.filter((s) => s.listId === listId && byId.has(s.id)),
    ),
  )
}

/**
 * Move an item within or across sections.
 * `orderedIdsInTarget` is the full item-id order for the destination section
 * after the move (including the active item).
 */
export function setItemOrderInSection(
  sectionId: string,
  orderedIds: string[],
): void {
  const byId = new Map(orderedIds.map((id, i) => [id, (i + 1) * 1000]))
  const nextItems = state.items.map((item) => {
    if (!byId.has(item.id)) return item
    return {
      ...item,
      sectionId,
      position: byId.get(item.id)!,
    }
  })
  setState({ ...state, items: nextItems }, (hh) =>
    cloudUpdateItemPositions(
      hh,
      nextItems.filter((item) => byId.has(item.id)),
    ),
  )
}

/**
 * After dragging an item out of a section, renumber the remaining items there.
 */
export function setItemOrderOnly(
  sectionId: string,
  orderedIds: string[],
): void {
  const byId = new Map(orderedIds.map((id, i) => [id, (i + 1) * 1000]))
  const nextItems = state.items.map((item) => {
    if (item.sectionId !== sectionId || !byId.has(item.id)) return item
    return { ...item, position: byId.get(item.id)! }
  })
  setState({ ...state, items: nextItems }, (hh) =>
    cloudUpdateItemPositions(
      hh,
      nextItems.filter(
        (item) => item.sectionId === sectionId && byId.has(item.id),
      ),
    ),
  )
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
  const newSections: typeof sections = []
  const newItems: typeof items = []
  const updatedTripItems: typeof items = []
  const updatedTripSections: typeof sections = []

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
      newSections.push(newSec)
      templateSectionId = newSec.id
      if (tripSection) {
        sections = sections.map((s) =>
          s.id === tripSection.id ? { ...s, sourceSectionId: newSec.id } : s,
        )
        const linked = sections.find((s) => s.id === tripSection.id)
        if (linked) updatedTripSections.push(linked)
      }
    }

    const tplSiblings = items.filter(
      (i) => i.listId === templateId && i.sectionId === templateSectionId,
    )
    const added = {
      id: newId(),
      listId: templateId,
      sectionId: templateSectionId!,
      text: tripItem.text,
      who: tripItem.who,
      position: nextPosition(tplSiblings),
    }
    items = [...items, added]
    newItems.push(added)
    items = items.map((i) =>
      i.id === itemId ? { ...i, tripOnly: false } : i,
    )
    const cleared = items.find((i) => i.id === itemId)
    if (cleared) updatedTripItems.push(cleared)
  }

  setState({ ...state, sections, items }, async (hh) => {
    await cloudInsertSections(hh, newSections)
    await cloudInsertItems(hh, newItems)
    for (const s of updatedTripSections) await cloudUpdateSection(hh, s)
    for (const i of updatedTripItems) await cloudUpdateItem(hh, i)
  })
  return template.name
}

export function monthLabel(date = new Date()): string {
  return date.toLocaleString('en-US', { month: 'short' }) + ' ' + date.getFullYear()
}

/** Default trip name from a template, e.g. "Hiking · Sep 2026". */
export function defaultTripName(templateId: string): string {
  const tpl = state.lists.find((l) => l.id === templateId)
  if (!tpl) return `Trip · ${monthLabel()}`
  const base =
    tpl.name.replace(/\s*packing list\s*/i, '').trim() || tpl.name
  return `${base} · ${monthLabel()}`
}

/**
 * Copy a template into a fresh trip (new section/item ids, sourceSectionId links,
 * no checks, no tripOnly). Returns the new trip id.
 */
export function startTripFromTemplate(
  templateId: string,
  name: string,
): string | null {
  const template = state.lists.find(
    (l) => l.id === templateId && l.kind === 'template',
  )
  if (!template) return null

  const tripId = newId()
  const tplSections = state.sections
    .filter((s) => s.listId === templateId)
    .sort((a, b) => a.position - b.position)
  const sectionIdMap = new Map<string, string>()

  const newSections = tplSections.map((s) => {
    const id = newId()
    sectionIdMap.set(s.id, id)
    return {
      id,
      listId: tripId,
      name: s.name,
      position: s.position,
      sourceSectionId: s.id,
    }
  })

  const newItems = state.items
    .filter((i) => i.listId === templateId)
    .map((i) => ({
      id: newId(),
      listId: tripId,
      sectionId: sectionIdMap.get(i.sectionId)!,
      text: i.text,
      who: i.who,
      position: i.position,
    }))
    .filter((i) => i.sectionId)

  const newList = {
    id: tripId,
    name: name.trim() || defaultTripName(templateId),
    kind: 'trip' as const,
    templateId,
    createdAt: Date.now(),
  }

  setState(
    {
      ...state,
      lists: [...state.lists, newList],
      sections: [...state.sections, ...newSections],
      items: [...state.items, ...newItems],
    },
    async (hh) => {
      await cloudInsertList(hh, newList)
      await cloudInsertSections(hh, newSections)
      await cloudInsertItems(hh, newItems)
    },
  )
  return tripId
}

/** Create an empty template with a General section. Returns the new list id. */
export function createTemplate(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return null
  const listId = newId()
  const sectionId = newId()
  const newList = {
    id: listId,
    name: trimmed,
    kind: 'template' as const,
    createdAt: Date.now(),
  }
  const newSection = {
    id: sectionId,
    listId,
    name: 'General',
    position: 1000,
  }
  setState(
    {
      ...state,
      lists: [...state.lists, newList],
      sections: [...state.sections, newSection],
    },
    async (hh) => {
      await cloudInsertList(hh, newList)
      await cloudInsertSections(hh, [newSection])
    },
  )
  return listId
}
