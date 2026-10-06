import { toast } from '../toast'
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
  cloudReplaceTripTravelers,
  cloudUpdateItem,
  cloudUpdateItemPositions,
  cloudUpdateList,
  cloudUpdateSection,
  cloudUpdateSectionPositions,
  cloudUpsertCheck,
  cloudUpsertListView,
  fetchHouseholdStore,
  replaceHouseholdStore,
} from './cloud'
import { startChecksRealtime, stopChecksRealtime } from './realtime'
import { createSeedData, PEOPLE } from './seed'
import { getMe } from './session'
import type {
  Check,
  Item,
  Person,
  PersonId,
  StoreData,
  Who,
} from './types'
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
  TripTraveler,
  Who,
} from './types'
export {
  doneFor,
  isDone,
  owes,
  progress,
  isItemNewFor,
  countNewItems,
} from './helpers'
export {
  itemMemoryMap,
  memoryForText,
  suggestItemMemories,
  whoForListMemory,
  type ItemMemory,
} from './itemMemory'
export { PEOPLE } from './seed'
export { WHO_OPTIONS, whoOptionsForTravelers, getLastWho, setLastWho, newId } from './who'

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
    listViews: [],
    tripTravelers: [],
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

/** Memory + local cache only (no cloud write). Used for realtime inbound events. */
function applyLocal(next: StoreData) {
  state = next
  persistLocal(state)
  emit()
}

const SAVE_FAIL_MSG =
  "Couldn't save. Check your connection and try again."

/**
 * Write to Supabase first (when cloud is provided), then update local state.
 * On failure: toast, leave local state unchanged, return false.
 */
async function commit(
  next: StoreData,
  cloud?: CloudWrite,
): Promise<boolean> {
  if (cloud) {
    const hh = status.householdId
    if (!hh) {
      toast(SAVE_FAIL_MSG)
      return false
    }
    try {
      await cloud(hh)
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : String(err)
      console.error('Taco cloud sync failed:', detail)
      toast(SAVE_FAIL_MSG)
      return false
    }
  }
  state = next
  persistLocal(state)
  emit()
  return true
}

function applyRemoteCheckInsert(check: Check) {
  const exists = state.checks.some(
    (c) => c.itemId === check.itemId && c.personId === check.personId,
  )
  if (exists) {
    applyLocal({
      ...state,
      checks: state.checks.map((c) =>
        c.itemId === check.itemId && c.personId === check.personId ? check : c,
      ),
    })
    return
  }
  applyLocal({ ...state, checks: [...state.checks, check] })
}

function applyRemoteCheckDelete(itemId: string, personId: string) {
  const exists = state.checks.some(
    (c) => c.itemId === itemId && c.personId === personId,
  )
  if (!exists) return
  applyLocal({
    ...state,
    checks: state.checks.filter(
      (c) => !(c.itemId === itemId && c.personId === personId),
    ),
  })
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

  stopChecksRealtime()
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
    startChecksRealtime(householdId, {
      onInsert: applyRemoteCheckInsert,
      onDelete: applyRemoteCheckDelete,
    })
    setStatus({ ready: true, error: null, householdId })
  } catch (err: unknown) {
    stopChecksRealtime()
    const message = err instanceof Error ? err.message : 'Could not load lists'
    console.error(message)
    setStatus({ ready: true, error: message, householdId })
  }
}

/** Clear cloud binding on sign-out. */
export function disconnectHousehold(): void {
  stopChecksRealtime()
  status = { ready: false, error: null, householdId: null }
  state = emptyStore()
  emit()
}

/** Wipe household packing data and reload the Hiking + Utah sample. */
export async function resetSampleData(): Promise<void> {
  const seed = createSeedData()
  seed.people =
    state.people.length > 0 ? state.people.map((p) => ({ ...p })) : seed.people
  await commit(seed, (hh) => replaceHouseholdStore(hh, seed))
}

/** Toggle one person's check on an item (each / person who). */
export async function togglePersonCheck(
  listId: string,
  itemId: string,
  personId: PersonId,
  checkedBy: PersonId,
): Promise<void> {
  const existing = state.checks.some(
    (c) => c.listId === listId && c.itemId === itemId && c.personId === personId,
  )
  if (existing) {
    await commit(
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
    const check = {
      listId,
      itemId,
      personId,
      checkedBy,
      checkedAt: Date.now(),
    }
    await commit(
      { ...state, checks: [...state.checks, check] },
      (hh) => cloudUpsertCheck(hh, check),
    )
  }
}

/**
 * Shared item: if anyone checked it, clear all checks;
 * otherwise check it as the current person.
 */
export async function toggleSharedCheck(
  listId: string,
  itemId: string,
  personId: PersonId,
): Promise<void> {
  const anyChecked = state.checks.some(
    (c) => c.listId === listId && c.itemId === itemId,
  )
  if (anyChecked) {
    await commit(
      {
        ...state,
        checks: state.checks.filter(
          (c) => !(c.listId === listId && c.itemId === itemId),
        ),
      },
      (hh) => cloudDeleteChecksForItem(hh, itemId),
    )
  } else {
    const check = {
      listId,
      itemId,
      personId,
      checkedBy: personId,
      checkedAt: Date.now(),
    }
    await commit(
      { ...state, checks: [...state.checks, check] },
      (hh) => cloudUpsertCheck(hh, check),
    )
  }
}

export async function addItem(
  listId: string,
  sectionId: string,
  text: string,
  who: Who,
): Promise<Item | null> {
  const list = state.lists.find((l) => l.id === listId)
  const siblings = state.items.filter(
    (i) => i.listId === listId && i.sectionId === sectionId,
  )
  const me = getMe()
  const item: Item = {
    id: newId(),
    listId,
    sectionId,
    text,
    who,
    position: nextPosition(siblings),
    createdAt: Date.now(),
    ...(me ? { createdBy: me } : {}),
    ...(list?.kind === 'trip' ? { tripOnly: true } : {}),
  }
  const ok = await commit({ ...state, items: [...state.items, item] }, (hh) =>
    cloudInsertItems(hh, [item]),
  )
  return ok ? item : null
}

export async function updateItem(
  itemId: string,
  patch: { text?: string; who?: Who; sectionId?: string },
): Promise<boolean> {
  const item = state.items.find((i) => i.id === itemId)
  if (!item) return false

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

  return await commit(
    {
      ...state,
      items: state.items.map((i) => (i.id === itemId ? next : i)),
    },
    (hh) => cloudUpdateItem(hh, next),
  )
}

export async function deleteItem(itemId: string): Promise<boolean> {
  const item = state.items.find((i) => i.id === itemId)
  if (!item) return false
  return await commit(
    {
      ...state,
      items: state.items.filter((i) => i.id !== itemId),
      checks: state.checks.filter((c) => c.itemId !== itemId),
    },
    (hh) => cloudDeleteItem(hh, itemId),
  )
}

/** Move item within its section. dir: -1 up, +1 down. Returns false if blocked. */
export async function moveItem(itemId: string, dir: -1 | 1): Promise<boolean> {
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
  return await commit({ ...state, items: nextItems }, (hh) =>
    cloudUpdateItemPositions(
      hh,
      nextItems.filter((it) => byId.has(it.id)),
    ),
  )
}

export async function addSection(listId: string, name: string): Promise<string | null> {
  const siblings = state.sections.filter((s) => s.listId === listId)
  const section = {
    id: newId(),
    listId,
    name,
    position: nextPosition(siblings),
  }
  const ok = await commit({ ...state, sections: [...state.sections, section] }, (hh) =>
    cloudInsertSections(hh, [section]),
  )
  return ok ? section.id : null
}

export async function updateSection(sectionId: string, name: string): Promise<boolean> {
  const section = state.sections.find((s) => s.id === sectionId)
  if (!section) return false
  const next = { ...section, name }
  return await commit(
    {
      ...state,
      sections: state.sections.map((s) => (s.id === sectionId ? next : s)),
    },
    (hh) => cloudUpdateSection(hh, next),
  )
}

export async function deleteSection(sectionId: string): Promise<boolean> {
  const section = state.sections.find((s) => s.id === sectionId)
  if (!section) return false
  const itemIds = new Set(
    state.items.filter((i) => i.sectionId === sectionId).map((i) => i.id),
  )
  return await commit(
    {
      ...state,
      sections: state.sections.filter((s) => s.id !== sectionId),
      items: state.items.filter((i) => i.sectionId !== sectionId),
      checks: state.checks.filter((c) => !itemIds.has(c.itemId)),
    },
    (hh) => cloudDeleteSection(hh, sectionId),
  )
}

export async function moveSection(sectionId: string, dir: -1 | 1): Promise<boolean> {
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
  return await commit({ ...state, sections: nextSections }, (hh) =>
    cloudUpdateSectionPositions(
      hh,
      nextSections.filter((s) => byId.has(s.id)),
    ),
  )
}

export async function renameList(listId: string, name: string): Promise<boolean> {
  return await commit(
    {
      ...state,
      lists: state.lists.map((l) => (l.id === listId ? { ...l, name } : l)),
    },
    (hh) => cloudUpdateList(hh, listId, { name }),
  )
}

/** Mark a trip as finished (Past trips). */
export async function archiveTrip(listId: string): Promise<boolean> {
  const list = state.lists.find((l) => l.id === listId)
  if (!list || list.kind !== 'trip') return false
  const archivedAt = Date.now()
  return await commit(
    {
      ...state,
      lists: state.lists.map((l) =>
        l.id === listId ? { ...l, archivedAt } : l,
      ),
    },
    (hh) =>
      cloudUpdateList(hh, listId, {
        archived_at: new Date(archivedAt).toISOString(),
      }),
  )
}

/** Bring an archived trip back to Packing now. */
export async function restoreTrip(listId: string): Promise<boolean> {
  const list = state.lists.find((l) => l.id === listId)
  if (!list || list.kind !== 'trip') return false
  return await commit(
    {
      ...state,
      lists: state.lists.map((l) => {
        if (l.id !== listId) return l
        return {
          id: l.id,
          name: l.name,
          kind: l.kind,
          createdAt: l.createdAt,
          ...(l.templateId ? { templateId: l.templateId } : {}),
        }
      }),
    },
    (hh) => cloudUpdateList(hh, listId, { archived_at: null }),
  )
}

export async function deleteList(listId: string): Promise<boolean> {
  return await commit(
    {
      ...state,
      lists: state.lists.filter((l) => l.id !== listId),
      sections: state.sections.filter((s) => s.listId !== listId),
      items: state.items.filter((i) => i.listId !== listId),
      checks: state.checks.filter((c) => c.listId !== listId),
      listViews: state.listViews.filter((v) => v.listId !== listId),
      tripTravelers: state.tripTravelers.filter((t) => t.tripId !== listId),
    },
    (hh) => cloudDeleteList(hh, listId),
  )
}

/** Record that this person left the list (drives "New" for next visit). */
export async function markListViewed(listId: string, personId: PersonId): Promise<void> {
  const lastViewedAt = Date.now()
  const row = { listId, personId, lastViewedAt }
  const listViews = [
    ...state.listViews.filter(
      (v) => !(v.listId === listId && v.personId === personId),
    ),
    row,
  ]
  await commit({ ...state, listViews }, (hh) => cloudUpsertListView(hh, row))
}

export function getLastViewedAt(
  listId: string,
  personId: PersonId,
): number | null {
  return (
    state.listViews.find(
      (v) => v.listId === listId && v.personId === personId,
    )?.lastViewedAt ?? null
  )
}

export async function clearChecks(listId: string): Promise<boolean> {
  return await commit(
    {
      ...state,
      checks: state.checks.filter((c) => c.listId !== listId),
    },
    (hh) => cloudClearChecksForList(hh, listId),
  )
}

/** Replace who’s going on a trip. At least one traveler required. */
export async function setTripTravelers(
  tripId: string,
  travelerIds: PersonId[],
): Promise<boolean> {
  const list = state.lists.find((l) => l.id === tripId)
  if (!list || list.kind !== 'trip') return false
  const unique = [...new Set(travelerIds)].filter((id) =>
    state.people.some((p) => p.id === id),
  )
  if (unique.length === 0) return false

  const tripTravelers = [
    ...state.tripTravelers.filter((t) => t.tripId !== tripId),
    ...unique.map((personId) => ({ tripId, personId })),
  ]
  // Drop checks for people no longer on the trip (their pack slots are gone).
  const keep = new Set(unique)
  const checks = state.checks.filter(
    (c) => c.listId !== tripId || keep.has(c.personId),
  )

  return await commit({ ...state, tripTravelers, checks }, async (hh) => {
    await cloudReplaceTripTravelers(hh, tripId, unique)
    // Checks for removed people: delete via clearing then… cloud has no
    // bulk-by-person helper; remove orphaned checks one-by-one.
    const removed = state.checks.filter(
      (c) => c.listId === tripId && !keep.has(c.personId),
    )
    for (const c of removed) {
      await cloudDeleteCheck(hh, c.itemId, c.personId)
    }
  })
}

/** Persist a new section order for a list (ids top → bottom). */
export async function setSectionOrder(listId: string, orderedIds: string[]): Promise<void> {
  const byId = new Map(orderedIds.map((id, i) => [id, (i + 1) * 1000]))
  const nextSections = state.sections.map((s) =>
    s.listId === listId && byId.has(s.id)
      ? { ...s, position: byId.get(s.id)! }
      : s,
  )
  await commit({ ...state, sections: nextSections }, (hh) =>
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
export async function setItemOrderInSection(
  sectionId: string,
  orderedIds: string[],
): Promise<void> {
  const byId = new Map(orderedIds.map((id, i) => [id, (i + 1) * 1000]))
  const nextItems = state.items.map((item) => {
    if (!byId.has(item.id)) return item
    return {
      ...item,
      sectionId,
      position: byId.get(item.id)!,
    }
  })
  await commit({ ...state, items: nextItems }, (hh) =>
    cloudUpdateItemPositions(
      hh,
      nextItems.filter((item) => byId.has(item.id)),
    ),
  )
}

/**
 * After dragging an item out of a section, renumber the remaining items there.
 */
export async function setItemOrderOnly(
  sectionId: string,
  orderedIds: string[],
): Promise<void> {
  const byId = new Map(orderedIds.map((id, i) => [id, (i + 1) * 1000]))
  const nextItems = state.items.map((item) => {
    if (item.sectionId !== sectionId || !byId.has(item.id)) return item
    return { ...item, position: byId.get(item.id)! }
  })
  await commit({ ...state, items: nextItems }, (hh) =>
    cloudUpdateItemPositions(
      hh,
      nextItems.filter(
        (item) => item.sectionId === sectionId && byId.has(item.id),
      ),
    ),
  )
}

/**
 * Copy trip-only items onto the right template for each item's section
 * (via sourceSectionId → template), then clear tripOnly on the trip items.
 * Returns a short label of templates updated, or null if nothing could be saved.
 */
export async function promoteItems(listId: string, itemIds: string[]): Promise<string | null> {
  const list = state.lists.find((l) => l.id === listId)
  if (!list || list.kind !== 'trip') return null

  let sections = [...state.sections]
  let items = [...state.items]
  const newSections: typeof sections = []
  const newItems: typeof items = []
  const updatedTripItems: typeof items = []
  const updatedTripSections: typeof sections = []
  const templateNames = new Set<string>()

  for (const itemId of itemIds) {
    const tripItem = items.find((i) => i.id === itemId && i.listId === listId)
    if (!tripItem) continue

    const tripSection = sections.find((s) => s.id === tripItem.sectionId)
    const templateId = resolveTemplateIdForTripSection(
      tripSection,
      sections,
      list.templateId,
    )
    if (!templateId) continue
    const template = state.lists.find(
      (l) => l.id === templateId && l.kind === 'template',
    )
    if (!template) continue
    templateNames.add(template.name)

    let templateSectionId = tripSection?.sourceSectionId
    let templateSection = templateSectionId
      ? sections.find((s) => s.id === templateSectionId && s.listId === templateId)
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
    const me = getMe()
    const added = {
      id: newId(),
      listId: templateId,
      sectionId: templateSectionId!,
      text: tripItem.text,
      who: tripItem.who,
      position: nextPosition(tplSiblings),
      createdAt: Date.now(),
      ...(tripItem.createdBy
        ? { createdBy: tripItem.createdBy }
        : me
          ? { createdBy: me }
          : {}),
    }
    items = [...items, added]
    newItems.push(added)
    items = items.map((i) =>
      i.id === itemId ? { ...i, tripOnly: false } : i,
    )
    const cleared = items.find((i) => i.id === itemId)
    if (cleared) updatedTripItems.push(cleared)
  }

  if (newItems.length === 0 && updatedTripItems.length === 0) return null

  const ok = await commit({ ...state, sections, items }, async (hh) => {
    await cloudInsertSections(hh, newSections)
    await cloudInsertItems(hh, newItems)
    for (const s of updatedTripSections) await cloudUpdateSection(hh, s)
    for (const i of updatedTripItems) await cloudUpdateItem(hh, i)
  })
  return ok ? [...templateNames].join(', ') : null
}

/** Template list id this trip section should save back to. */
export function resolveTemplateIdForTripSection(
  tripSection: { sourceSectionId?: string; name: string } | undefined,
  sections = state.sections,
  fallbackTemplateId?: string,
): string | null {
  if (tripSection?.sourceSectionId) {
    const src = sections.find((s) => s.id === tripSection.sourceSectionId)
    if (src) {
      const tpl = state.lists.find(
        (l) => l.id === src.listId && l.kind === 'template',
      )
      if (tpl) return tpl.id
    }
  }
  if (fallbackTemplateId) {
    const tpl = state.lists.find(
      (l) => l.id === fallbackTemplateId && l.kind === 'template',
    )
    if (tpl) return tpl.id
  }
  return null
}

/** People who pack on this list (trip travelers when set; else whole household). */
export function peopleForList(
  listId: string,
  data: StoreData = state,
): Person[] {
  const list = data.lists.find((l) => l.id === listId)
  if (!list || list.kind !== 'trip') return data.people
  const ids = data.tripTravelers
    .filter((t) => t.tripId === listId)
    .map((t) => t.personId)
  if (ids.length === 0) return data.people
  const set = new Set(ids)
  return data.people.filter((p) => set.has(p.id))
}

/** Template names this trip's sections came from (for eyebrow / cards). */
export function tripSourceTemplateNames(
  listId: string,
  data: StoreData = state,
): string[] {
  const names = new Set<string>()
  for (const sec of data.sections.filter((s) => s.listId === listId)) {
    const tplId = resolveTemplateIdForTripSection(sec, data.sections)
    if (!tplId) continue
    const tpl = data.lists.find((l) => l.id === tplId)
    if (tpl) names.add(tpl.name)
  }
  return [...names].sort((a, b) => a.localeCompare(b))
}

export function monthLabel(date = new Date()): string {
  return date.toLocaleString('en-US', { month: 'short' }) + ' ' + date.getFullYear()
}

/** Default trip name from template(s), e.g. "Hiking · Sep 2026". */
export function defaultTripName(templateId: string): string {
  const tpl = state.lists.find((l) => l.id === templateId)
  if (!tpl) return `Trip · ${monthLabel()}`
  const base =
    tpl.name.replace(/\s*packing list\s*/i, '').trim() || tpl.name
  return `${base} · ${monthLabel()}`
}

export function defaultTripNameFromTemplates(templateIds: string[]): string {
  const unique = [...new Set(templateIds)]
  if (unique.length === 1) return defaultTripName(unique[0]!)
  return `Trip · ${monthLabel()}`
}

export type StartTripInput = {
  name: string
  /** Template section ids to copy. */
  sectionIds: string[]
  /** person_keys going on the trip. */
  travelerIds: PersonId[]
}

/**
 * Start a trip from chosen template sections (can mix templates).
 * Fresh section/item ids, sourceSectionId links, no checks, no tripOnly.
 */
export async function startTrip(input: StartTripInput): Promise<string | null> {
  const sectionIds = [...new Set(input.sectionIds)]
  if (sectionIds.length === 0) return null

  const tplSections = sectionIds
    .map((id) => state.sections.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => {
      if (!s) return false
      const list = state.lists.find((l) => l.id === s.listId)
      return list?.kind === 'template'
    })
    .sort((a, b) => a.position - b.position)

  if (tplSections.length === 0) return null

  const templateIds = [...new Set(tplSections.map((s) => s.listId))]
  const travelers =
    input.travelerIds.length > 0
      ? [...new Set(input.travelerIds)]
      : state.people.map((p) => p.id)

  const tripId = newId()
  const sectionIdMap = new Map<string, string>()
  let pos = 0
  const newSections = tplSections.map((s) => {
    const id = newId()
    sectionIdMap.set(s.id, id)
    pos += 1000
    return {
      id,
      listId: tripId,
      name: s.name,
      position: pos,
      sourceSectionId: s.id,
    }
  })

  const now = Date.now()
  const sourceSectionSet = new Set(tplSections.map((s) => s.id))
  const newItems = state.items
    .filter((i) => sourceSectionSet.has(i.sectionId))
    .map((i) => ({
      id: newId(),
      listId: tripId,
      sectionId: sectionIdMap.get(i.sectionId)!,
      text: i.text,
      who: i.who,
      position: i.position,
      createdAt: now,
    }))
    .filter((i) => i.sectionId)

  const newList = {
    id: tripId,
    name: input.name.trim() || defaultTripNameFromTemplates(templateIds),
    kind: 'trip' as const,
    ...(templateIds.length === 1 ? { templateId: templateIds[0] } : {}),
    createdAt: Date.now(),
  }

  const tripTravelers = travelers.map((personId) => ({
    tripId,
    personId,
  }))

  const ok = await commit(
    {
      ...state,
      lists: [...state.lists, newList],
      sections: [...state.sections, ...newSections],
      items: [...state.items, ...newItems],
      tripTravelers: [
        ...state.tripTravelers.filter((t) => t.tripId !== tripId),
        ...tripTravelers,
      ],
    },
    async (hh) => {
      try {
        await cloudInsertList(hh, newList, { skipDefaultTravelers: true })
        await cloudInsertSections(hh, newSections)
        await cloudInsertItems(hh, newItems)
        await cloudReplaceTripTravelers(hh, tripId, travelers)
      } catch (err) {
        // Avoid orphan list/sections if a later step fails.
        await cloudDeleteList(hh, tripId).catch(() => {})
        throw err
      }
    },
  )
  return ok ? tripId : null
}

/** @deprecated Prefer startTrip — kept for any leftover callers. */
export async function startTripFromTemplate(
  templateId: string,
  name: string,
): Promise<string | null> {
  const sectionIds = state.sections
    .filter((s) => s.listId === templateId)
    .map((s) => s.id)
  return startTrip({
    name,
    sectionIds,
    travelerIds: state.people.map((p) => p.id),
  })
}

/**
 * Copy one or more template sections (and their items) onto a list.
 * On a trip, sets sourceSectionId so promote saves to the right template.
 */
export async function copySectionsFromTemplate(
  listId: string,
  templateSectionIds: string[],
): Promise<number> {
  const list = state.lists.find((l) => l.id === listId)
  if (!list) return 0

  const ids = [...new Set(templateSectionIds)]
  const tplSections = ids
    .map((id) => state.sections.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => {
      if (!s) return false
      return state.lists.find((l) => l.id === s.listId)?.kind === 'template'
    })
  if (tplSections.length === 0) return 0

  const sectionIdMap = new Map<string, string>()
  let nextPos = nextPosition(state.sections.filter((s) => s.listId === listId))
  const newSections = tplSections.map((s) => {
    const id = newId()
    sectionIdMap.set(s.id, id)
    const row = {
      id,
      listId,
      name: s.name,
      position: nextPos,
      ...(list.kind === 'trip' ? { sourceSectionId: s.id } : {}),
    }
    nextPos += 1000
    return row
  })

  const now = Date.now()
  const srcSet = new Set(tplSections.map((s) => s.id))
  const newItems = state.items
    .filter((i) => srcSet.has(i.sectionId))
    .map((i) => ({
      id: newId(),
      listId,
      sectionId: sectionIdMap.get(i.sectionId)!,
      text: i.text,
      who: i.who,
      position: i.position,
      createdAt: now,
    }))
    .filter((i) => i.sectionId)

  const ok = await commit(
    {
      ...state,
      sections: [...state.sections, ...newSections],
      items: [...state.items, ...newItems],
    },
    async (hh) => {
      await cloudInsertSections(hh, newSections)
      await cloudInsertItems(hh, newItems)
    },
  )
  return ok ? newSections.length : 0
}

/**
 * Snapshot a trip into a brand-new template (sections + items, no checks).
 * Returns the new template id.
 */
export async function saveTripAsNewTemplate(
  tripId: string,
  name: string,
): Promise<string | null> {
  const trip = state.lists.find((l) => l.id === tripId && l.kind === 'trip')
  if (!trip) return null
  const trimmed = name.trim()
  if (!trimmed) return null

  const templateId = newId()
  const tripSections = state.sections
    .filter((s) => s.listId === tripId)
    .sort((a, b) => a.position - b.position)
  const sectionIdMap = new Map<string, string>()
  const newSections = tripSections.map((s) => {
    const id = newId()
    sectionIdMap.set(s.id, id)
    return {
      id,
      listId: templateId,
      name: s.name,
      position: s.position,
    }
  })
  const now = Date.now()
  const me = getMe()
  const newItems = state.items
    .filter((i) => i.listId === tripId)
    .map((i) => ({
      id: newId(),
      listId: templateId,
      sectionId: sectionIdMap.get(i.sectionId)!,
      text: i.text,
      who: i.who,
      position: i.position,
      createdAt: now,
      ...(me ? { createdBy: me } : {}),
    }))
    .filter((i) => i.sectionId)

  const newList = {
    id: templateId,
    name: trimmed,
    kind: 'template' as const,
    createdAt: now,
  }

  const ok = await commit(
    {
      ...state,
      lists: [...state.lists, newList],
      sections: [...state.sections, ...newSections],
      items: [...state.items, ...newItems],
    },
    async (hh) => {
      try {
        await cloudInsertList(hh, newList)
        await cloudInsertSections(hh, newSections)
        await cloudInsertItems(hh, newItems)
      } catch (err) {
        await cloudDeleteList(hh, templateId).catch(() => {})
        throw err
      }
    },
  )
  return ok ? templateId : null
}

/** Create an empty template with a General section. Returns the new list id. */
export async function createTemplate(name: string): Promise<string | null> {
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
  const ok = await commit(
    {
      ...state,
      lists: [...state.lists, newList],
      sections: [...state.sections, newSection],
    },
    async (hh) => {
      try {
        await cloudInsertList(hh, newList)
        await cloudInsertSections(hh, [newSection])
      } catch (err) {
        await cloudDeleteList(hh, listId).catch(() => {})
        throw err
      }
    },
  )
  return ok ? listId : null
}
