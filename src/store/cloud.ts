import { supabase } from '../lib/supabase'
import type { Check, Item, List, Person, Section, StoreData, Who } from './types'

function throwIfError(error: { message: string } | null, label: string) {
  if (error) throw new Error(`${label}: ${error.message}`)
}

function listRow(householdId: string, list: List) {
  return {
    id: list.id,
    household_id: householdId,
    name: list.name,
    kind: list.kind,
    template_id: list.templateId ?? null,
    created_at: new Date(list.createdAt).toISOString(),
  }
}

function sectionRow(householdId: string, section: Section) {
  return {
    id: section.id,
    household_id: householdId,
    list_id: section.listId,
    name: section.name,
    position: section.position,
    source_section_id: section.sourceSectionId ?? null,
  }
}

function itemRow(householdId: string, item: Item) {
  return {
    id: item.id,
    household_id: householdId,
    list_id: item.listId,
    section_id: item.sectionId,
    text: item.text,
    who: item.who,
    position: item.position,
    trip_only: Boolean(item.tripOnly),
  }
}

function checkRow(householdId: string, check: Check) {
  return {
    household_id: householdId,
    list_id: check.listId,
    item_id: check.itemId,
    person_id: check.personId,
    checked_at: new Date(check.checkedAt).toISOString(),
  }
}

/** Household members from profiles → store people. */
export async function fetchHouseholdPeople(householdId: string): Promise<Person[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('person_key, display_name, initial, color')
    .eq('household_id', householdId)

  throwIfError(error, 'load profiles')

  const people = (data ?? []).map((row) => ({
    id: row.person_key as string,
    name: row.display_name as string,
    initial: row.initial as string,
    color: row.color as string,
  }))

  people.sort((a, b) => a.id.localeCompare(b.id))
  return people
}

/** Load lists/sections/items/checks for a household. */
export async function fetchHouseholdStore(householdId: string): Promise<StoreData> {
  const people = await fetchHouseholdPeople(householdId)

  const [listsRes, sectionsRes, itemsRes, checksRes] = await Promise.all([
    supabase.from('lists').select('*').eq('household_id', householdId),
    supabase.from('sections').select('*').eq('household_id', householdId),
    supabase.from('items').select('*').eq('household_id', householdId),
    supabase.from('checks').select('*').eq('household_id', householdId),
  ])

  throwIfError(listsRes.error, 'load lists')
  throwIfError(sectionsRes.error, 'load sections')
  throwIfError(itemsRes.error, 'load items')
  throwIfError(checksRes.error, 'load checks')

  const lists: List[] = (listsRes.data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    kind: row.kind as List['kind'],
    ...(row.template_id ? { templateId: row.template_id as string } : {}),
    createdAt: new Date(row.created_at as string).getTime(),
  }))

  const sections: Section[] = (sectionsRes.data ?? []).map((row) => ({
    id: row.id as string,
    listId: row.list_id as string,
    name: row.name as string,
    position: row.position as number,
    ...(row.source_section_id
      ? { sourceSectionId: row.source_section_id as string }
      : {}),
  }))

  const items: Item[] = (itemsRes.data ?? []).map((row) => ({
    id: row.id as string,
    listId: row.list_id as string,
    sectionId: row.section_id as string,
    text: row.text as string,
    who: row.who as Who,
    position: row.position as number,
    ...(row.trip_only ? { tripOnly: true } : {}),
  }))

  const checks: Check[] = (checksRes.data ?? []).map((row) => ({
    listId: row.list_id as string,
    itemId: row.item_id as string,
    personId: row.person_id as string,
    checkedAt: new Date(row.checked_at as string).getTime(),
  }))

  return { people, lists, sections, items, checks }
}

/** Wipe packing rows for a household and insert a full StoreData snapshot. */
export async function replaceHouseholdStore(
  householdId: string,
  data: StoreData,
): Promise<void> {
  const { error: delError } = await supabase
    .from('lists')
    .delete()
    .eq('household_id', householdId)
  throwIfError(delError, 'clear lists')

  if (data.lists.length > 0) {
    // Templates before trips (trips may reference template_id).
    const templates = data.lists.filter((l) => l.kind === 'template')
    const trips = data.lists.filter((l) => l.kind === 'trip')
    for (const batch of [templates, trips]) {
      if (batch.length === 0) continue
      const { error } = await supabase
        .from('lists')
        .insert(batch.map((l) => listRow(householdId, l)))
      throwIfError(error, 'insert lists')
    }
  }
  if (data.sections.length > 0) {
    // Sections without source first (template sections), then trip copies.
    const roots = data.sections.filter((s) => !s.sourceSectionId)
    const linked = data.sections.filter((s) => s.sourceSectionId)
    for (const batch of [roots, linked]) {
      if (batch.length === 0) continue
      const { error } = await supabase
        .from('sections')
        .insert(batch.map((s) => sectionRow(householdId, s)))
      throwIfError(error, 'insert sections')
    }
  }
  if (data.items.length > 0) {
    const { error } = await supabase
      .from('items')
      .insert(data.items.map((i) => itemRow(householdId, i)))
    throwIfError(error, 'insert items')
  }
  if (data.checks.length > 0) {
    const { error } = await supabase
      .from('checks')
      .insert(data.checks.map((c) => checkRow(householdId, c)))
    throwIfError(error, 'insert checks')
  }
}

export async function cloudInsertList(householdId: string, list: List) {
  const { error } = await supabase.from('lists').insert(listRow(householdId, list))
  throwIfError(error, 'insert list')
}

export async function cloudUpdateList(
  householdId: string,
  listId: string,
  patch: { name?: string },
) {
  const { error } = await supabase
    .from('lists')
    .update(patch)
    .eq('id', listId)
    .eq('household_id', householdId)
  throwIfError(error, 'update list')
}

export async function cloudDeleteList(householdId: string, listId: string) {
  const { error } = await supabase
    .from('lists')
    .delete()
    .eq('id', listId)
    .eq('household_id', householdId)
  throwIfError(error, 'delete list')
}

export async function cloudInsertSections(householdId: string, sections: Section[]) {
  if (sections.length === 0) return
  const { error } = await supabase
    .from('sections')
    .insert(sections.map((s) => sectionRow(householdId, s)))
  throwIfError(error, 'insert sections')
}

export async function cloudUpdateSection(
  householdId: string,
  section: Pick<Section, 'id' | 'name' | 'position' | 'sourceSectionId'>,
) {
  const { error } = await supabase
    .from('sections')
    .update({
      name: section.name,
      position: section.position,
      source_section_id: section.sourceSectionId ?? null,
    })
    .eq('id', section.id)
    .eq('household_id', householdId)
  throwIfError(error, 'update section')
}

export async function cloudUpdateSectionPositions(
  householdId: string,
  sections: Section[],
) {
  await Promise.all(
    sections.map((s) =>
      supabase
        .from('sections')
        .update({ position: s.position })
        .eq('id', s.id)
        .eq('household_id', householdId)
        .then(({ error }) => throwIfError(error, 'update section position')),
    ),
  )
}

export async function cloudDeleteSection(householdId: string, sectionId: string) {
  const { error } = await supabase
    .from('sections')
    .delete()
    .eq('id', sectionId)
    .eq('household_id', householdId)
  throwIfError(error, 'delete section')
}

export async function cloudInsertItems(householdId: string, items: Item[]) {
  if (items.length === 0) return
  const { error } = await supabase
    .from('items')
    .insert(items.map((i) => itemRow(householdId, i)))
  throwIfError(error, 'insert items')
}

export async function cloudUpdateItem(householdId: string, item: Item) {
  const { error } = await supabase
    .from('items')
    .update({
      text: item.text,
      who: item.who,
      section_id: item.sectionId,
      position: item.position,
      trip_only: Boolean(item.tripOnly),
    })
    .eq('id', item.id)
    .eq('household_id', householdId)
  throwIfError(error, 'update item')
}

export async function cloudUpdateItemPositions(householdId: string, items: Item[]) {
  await Promise.all(
    items.map((item) =>
      supabase
        .from('items')
        .update({
          section_id: item.sectionId,
          position: item.position,
        })
        .eq('id', item.id)
        .eq('household_id', householdId)
        .then(({ error }) => throwIfError(error, 'update item position')),
    ),
  )
}

export async function cloudDeleteItem(householdId: string, itemId: string) {
  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', itemId)
    .eq('household_id', householdId)
  throwIfError(error, 'delete item')
}

export async function cloudUpsertCheck(householdId: string, check: Check) {
  const { error } = await supabase
    .from('checks')
    .upsert(checkRow(householdId, check), { onConflict: 'item_id,person_id' })
  throwIfError(error, 'upsert check')
}

export async function cloudDeleteCheck(
  householdId: string,
  itemId: string,
  personId: string,
) {
  const { error } = await supabase
    .from('checks')
    .delete()
    .eq('household_id', householdId)
    .eq('item_id', itemId)
    .eq('person_id', personId)
  throwIfError(error, 'delete check')
}

export async function cloudDeleteChecksForItem(householdId: string, itemId: string) {
  const { error } = await supabase
    .from('checks')
    .delete()
    .eq('household_id', householdId)
    .eq('item_id', itemId)
  throwIfError(error, 'delete checks for item')
}

export async function cloudClearChecksForList(householdId: string, listId: string) {
  const { error } = await supabase
    .from('checks')
    .delete()
    .eq('household_id', householdId)
    .eq('list_id', listId)
  throwIfError(error, 'clear checks')
}
