export type PersonId = string // 'dustin' | 'brea' for now
export type Who = 'shared' | 'each' | PersonId

export interface Person {
  id: PersonId
  name: string
  initial: string
  color: string
}

export interface List {
  id: string
  name: string
  kind: 'template' | 'trip'
  templateId?: string
  createdAt: number
  /** Trips only: when set, shown under Past trips (read-only until restored). */
  archivedAt?: number
}

export interface Section {
  id: string
  listId: string
  name: string
  position: number
  /** On trips: the template section this was copied from (for promote). */
  sourceSectionId?: string
}

export interface Item {
  id: string
  listId: string
  sectionId: string
  text: string
  who: Who
  position: number
  tripOnly?: boolean
  createdAt: number
  /** person_key of who added it */
  createdBy?: PersonId
}

export interface Check {
  listId: string
  itemId: string
  /** Whose pack slot this check fills (circle / shared). */
  personId: PersonId
  checkedAt: number
  /** Who tapped the control (may differ when helping on someone else's circle). */
  checkedBy?: PersonId
}

/** When this person last left a list (for "New" from others). */
export interface ListView {
  listId: string
  personId: PersonId
  lastViewedAt: number
}

export interface StoreData {
  people: Person[]
  lists: List[]
  sections: Section[]
  items: Item[]
  checks: Check[]
  listViews: ListView[]
}

export interface PersonProgress {
  owed: number
  done: number
}

export interface ListProgress {
  total: number
  done: number
  perPerson: Record<PersonId, PersonProgress>
}
