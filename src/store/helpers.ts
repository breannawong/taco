import type { Check, Item, ListProgress, Person, PersonId } from './types'

/** True if this person is responsible for packing the item. */
export function owes(item: Item, personId: PersonId): boolean {
  return item.who === 'shared' || item.who === 'each' || item.who === personId
}

function checksForItem(checks: Check[], listId: string, itemId: string): Check[] {
  return checks.filter((c) => c.listId === listId && c.itemId === itemId)
}

/** Item is fully packed (shared: anyone; each: everyone; person: that person). */
export function isDone(item: Item, checks: Check[], people: Person[]): boolean {
  const itemChecks = checksForItem(checks, item.listId, item.id)
  if (item.who === 'shared') return itemChecks.length > 0
  if (item.who === 'each') {
    return people.every((p) => itemChecks.some((c) => c.personId === p.id))
  }
  return itemChecks.some((c) => c.personId === item.who)
}

/** Whether this person's share of the item is done. */
export function doneFor(
  item: Item,
  checks: Check[],
  personId: PersonId,
  people: Person[],
): boolean {
  if (item.who === 'shared') return isDone(item, checks, people)
  return checks.some(
    (c) => c.listId === item.listId && c.itemId === item.id && c.personId === personId,
  )
}

/** Overall and per-person packing progress for a list. */
export function progress(
  listId: string,
  items: Item[],
  checks: Check[],
  people: Person[],
): ListProgress {
  const listItems = items.filter((i) => i.listId === listId)
  const listChecks = checks.filter((c) => c.listId === listId)

  const perPerson: ListProgress['perPerson'] = {}
  for (const person of people) {
    let owed = 0
    let done = 0
    for (const item of listItems) {
      if (!owes(item, person.id)) continue
      owed++
      if (doneFor(item, listChecks, person.id, people)) done++
    }
    perPerson[person.id] = { owed, done }
  }

  return {
    total: listItems.length,
    done: listItems.filter((item) => isDone(item, listChecks, people)).length,
    perPerson,
  }
}
