import type { Check, Item, List, Person, Section, StoreData } from './types'

export const PEOPLE: Person[] = [
  { id: 'dustin', name: 'Dustin', initial: 'D', color: '#17767D' },
  { id: 'brea', name: 'Brea', initial: 'B', color: '#A8406F' },
]

const HIKING_ID = 'hiking'
const UTAH_ID = 'utah26'

type SeedItem = {
  key: string
  text: string
  who: Item['who']
  sectionKey: string
  position: number
  tripOnly?: boolean
}

const SECTION_DEFS: { key: string; name: string; position: number }[] = [
  { key: 'clo', name: 'Clothing', position: 1000 },
  { key: 'trail', name: 'On the trail', position: 2000 },
  { key: 'camp', name: 'Camp & kitchen', position: 3000 },
  { key: 'elec', name: 'Electronics', position: 4000 },
  { key: 'pers', name: 'Personal', position: 5000 },
]

const TEMPLATE_ITEMS: SeedItem[] = [
  { key: 'boots', text: 'Hiking boots', who: 'each', sectionKey: 'clo', position: 1000 },
  { key: 'socks', text: 'Wool socks (4 pairs)', who: 'each', sectionKey: 'clo', position: 2000 },
  { key: 'hoodie', text: 'Sun hoodie', who: 'each', sectionKey: 'clo', position: 3000 },
  { key: 'shell', text: 'Rain shell', who: 'each', sectionKey: 'clo', position: 4000 },
  { key: 'puffy', text: 'Puffy jacket', who: 'each', sectionKey: 'clo', position: 5000 },
  { key: 'hat', text: 'Sun hat', who: 'each', sectionKey: 'clo', position: 6000 },
  { key: 'sandals', text: 'Camp sandals', who: 'each', sectionKey: 'clo', position: 7000 },
  { key: 'daypack', text: 'Daypack', who: 'each', sectionKey: 'trail', position: 1000 },
  { key: 'bladder', text: 'Water bladder (3 L)', who: 'each', sectionKey: 'trail', position: 2000 },
  { key: 'headlamp', text: 'Headlamp', who: 'each', sectionKey: 'trail', position: 3000 },
  { key: 'poles', text: 'Trekking poles', who: 'brea', sectionKey: 'trail', position: 4000 },
  { key: 'sunnies', text: 'Sunglasses', who: 'each', sectionKey: 'trail', position: 5000 },
  { key: 'maps', text: 'Offline maps downloaded', who: 'shared', sectionKey: 'trail', position: 6000 },
  { key: 'firstaid', text: 'First aid kit', who: 'shared', sectionKey: 'trail', position: 7000 },
  { key: 'sunscreen', text: 'Sunscreen', who: 'shared', sectionKey: 'trail', position: 8000 },
  { key: 'lytes', text: 'Electrolyte packets', who: 'shared', sectionKey: 'trail', position: 9000 },
  { key: 'tent', text: 'Tent', who: 'shared', sectionKey: 'camp', position: 1000 },
  { key: 'bag', text: 'Sleeping bag', who: 'each', sectionKey: 'camp', position: 2000 },
  { key: 'pad', text: 'Sleeping pad', who: 'each', sectionKey: 'camp', position: 3000 },
  { key: 'stove', text: 'Stove + fuel canister', who: 'shared', sectionKey: 'camp', position: 4000 },
  { key: 'pot', text: 'Cook pot & sporks', who: 'shared', sectionKey: 'camp', position: 5000 },
  { key: 'cooler', text: 'Cooler', who: 'shared', sectionKey: 'camp', position: 6000 },
  { key: 'coffee', text: 'Coffee setup', who: 'shared', sectionKey: 'camp', position: 7000 },
  { key: 'charger', text: 'Phone charger', who: 'each', sectionKey: 'elec', position: 1000 },
  { key: 'bank', text: 'Power bank', who: 'shared', sectionKey: 'elec', position: 2000 },
  { key: 'camera', text: 'Camera + spare batteries', who: 'dustin', sectionKey: 'elec', position: 3000 },
  { key: 'kindle', text: 'Kindle', who: 'brea', sectionKey: 'elec', position: 4000 },
  { key: 'toiletries', text: 'Toiletry kit', who: 'each', sectionKey: 'pers', position: 1000 },
  { key: 'parkpass', text: 'National parks pass', who: 'shared', sectionKey: 'pers', position: 2000 },
]

const TRIP_ONLY_ITEM: SeedItem = {
  key: 'resv',
  text: 'Park entry reservations (screenshots)',
  who: 'shared',
  sectionKey: 'trail',
  position: 10000,
  tripOnly: true,
}

/** Prototype sample checks on the Utah trip. */
const UTAH_CHECKS: { itemKey: string; personId: string }[] = [
  { itemKey: 'boots', personId: 'dustin' },
  { itemKey: 'socks', personId: 'dustin' },
  { itemKey: 'socks', personId: 'brea' },
  { itemKey: 'hoodie', personId: 'brea' },
  { itemKey: 'daypack', personId: 'dustin' },
  { itemKey: 'daypack', personId: 'brea' },
  { itemKey: 'tent', personId: 'brea' },
  { itemKey: 'stove', personId: 'dustin' },
  { itemKey: 'bag', personId: 'dustin' },
  { itemKey: 'camera', personId: 'dustin' },
  { itemKey: 'charger', personId: 'brea' },
  { itemKey: 'firstaid', personId: 'dustin' },
]

function buildSampleData(): StoreData {
  const lists: List[] = [
    {
      id: HIKING_ID,
      name: 'Hiking Packing List',
      kind: 'template',
      createdAt: 1758000000000,
    },
    {
      id: UTAH_ID,
      name: 'Utah · Sep 2026',
      kind: 'trip',
      templateId: HIKING_ID,
      createdAt: 1790000000000,
    },
  ]

  const sections: Section[] = []
  const sectionIdByListAndKey = new Map<string, string>()

  for (const listId of [HIKING_ID, UTAH_ID]) {
    for (const def of SECTION_DEFS) {
      const id = `${listId}-${def.key}`
      const section: Section = {
        id,
        listId,
        name: def.name,
        position: def.position,
      }
      if (listId === UTAH_ID) {
        section.sourceSectionId = `${HIKING_ID}-${def.key}`
      }
      sections.push(section)
      sectionIdByListAndKey.set(`${listId}:${def.key}`, id)
    }
  }

  const items: Item[] = []

  for (const def of TEMPLATE_ITEMS) {
    items.push({
      id: `${HIKING_ID}-${def.key}`,
      listId: HIKING_ID,
      sectionId: sectionIdByListAndKey.get(`${HIKING_ID}:${def.sectionKey}`)!,
      text: def.text,
      who: def.who,
      position: def.position,
    })
  }

  for (const def of [...TEMPLATE_ITEMS, TRIP_ONLY_ITEM]) {
    items.push({
      id: `${UTAH_ID}-${def.key}`,
      listId: UTAH_ID,
      sectionId: sectionIdByListAndKey.get(`${UTAH_ID}:${def.sectionKey}`)!,
      text: def.text,
      who: def.who,
      position: def.position,
      ...(def.tripOnly ? { tripOnly: true } : {}),
    })
  }

  const checkedAt = 1790000001000
  const checks: Check[] = UTAH_CHECKS.map(({ itemKey, personId }) => ({
    listId: UTAH_ID,
    itemId: `${UTAH_ID}-${itemKey}`,
    personId,
    checkedAt,
  }))

  return {
    people: PEOPLE.map((p) => ({ ...p })),
    lists,
    sections,
    items,
    checks,
  }
}

export function createSeedData(): StoreData {
  return structuredClone(buildSampleData())
}
