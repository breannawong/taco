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
}

export interface Check {
  listId: string
  itemId: string
  personId: PersonId
  checkedAt: number
}

export interface StoreData {
  people: Person[]
  lists: List[]
  sections: Section[]
  items: Item[]
  checks: Check[]
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
