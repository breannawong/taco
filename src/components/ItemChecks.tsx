import { useState } from 'react'
import { IconCheck } from './Icons'
import type { Check, Item, Person, PersonId, Who } from '../store'
import { isDone, togglePersonCheck, toggleSharedCheck } from '../store'

type Props = {
  item: Item
  checks: Check[]
  /** Travelers (or household on templates). */
  people: Person[]
  me: PersonId
  /** When false (template), shapes are static previews. */
  interactive: boolean
  /** Mine to pack: only show the signed-in person's circle on Each items. */
  mineOnly?: boolean
  /**
   * Solo trip: one uniform checkbox for every item; stored who is unchanged.
   */
  solo?: boolean
}

function whoDescription(who: Who, people: Person[]): string {
  if (who === 'shared') return 'shared, one check for the household'
  if (who === 'each') return 'each person packs their own'
  const person = people.find((p) => p.id === who)
  return person ? `${person.name} only` : 'one person'
}

export function ItemChecks({
  item,
  checks,
  people,
  me,
  interactive,
  mineOnly = false,
  solo = false,
}: Props) {
  const [pop, setPop] = useState(false)

  const itemChecks = checks.filter(
    (c) => c.listId === item.listId && c.itemId === item.id,
  )
  const checked = (personId: PersonId) =>
    itemChecks.some((c) => c.personId === personId)

  const bump = () => {
    setPop(true)
    window.setTimeout(() => setPop(false), 220)
  }

  // Solo trip: one square for every item (Shared / Each / person stored as-is).
  if (solo && people.length === 1) {
    const traveler = people[0]!
    const on = interactive && isDone(item, checks, people)
    const label = on ? 'packed' : 'not packed'
    if (!interactive) {
      return (
        <span
          className="box static"
          aria-label={`${item.text}, preview`}
        >
          <i />
        </span>
      )
    }
    return (
      <button
        type="button"
        className={`box ${on ? 'on' : ''} ${pop ? 'pop' : ''}`}
        aria-pressed={on}
        aria-label={`${item.text}, ${label}`}
        onClick={() => {
          if (item.who === 'shared') {
            toggleSharedCheck(item.listId, item.id, me)
          } else if (item.who === 'each' || item.who === traveler.id) {
            togglePersonCheck(item.listId, item.id, traveler.id, me)
          } else {
            // Someone else's item — fill their slot (help-pack).
            togglePersonCheck(item.listId, item.id, item.who, me)
          }
          bump()
        }}
      >
        <i>
          <IconCheck />
        </i>
      </button>
    )
  }

  if (item.who === 'shared') {
    const on = interactive && itemChecks.length > 0
    const packers = people.filter((p) => checked(p.id))
    const packedBy =
      packers.length > 0
        ? `packed by ${packers.map((p) => p.name).join(' and ')}`
        : 'not packed'
    if (!interactive) {
      return (
        <span
          className="box static"
          aria-label={`${item.text}, ${whoDescription(item.who, people)}, preview`}
        >
          <i />
        </span>
      )
    }
    return (
      <button
        type="button"
        className={`box ${on ? 'on' : ''} ${pop ? 'pop' : ''}`}
        aria-pressed={on}
        aria-label={`${item.text}, ${whoDescription(item.who, people)}, ${packedBy}`}
        onClick={() => {
          toggleSharedCheck(item.listId, item.id, me)
          bump()
        }}
      >
        <i>
          <IconCheck />
        </i>
      </button>
    )
  }

  const packers =
    item.who === 'each'
      ? mineOnly
        ? people.filter((p) => p.id === me)
        : people
      : people.filter((p) => p.id === item.who)

  return (
    <>
      {packers.map((person) => {
        const on = interactive && checked(person.id)
        const state = on ? 'packed' : 'not packed'
        const role =
          item.who === 'each'
            ? mineOnly
              ? 'your pack'
              : `${person.name}'s own pack`
            : `${person.name} only`
        if (!interactive) {
          return (
            <span
              key={person.id}
              className={`chip static p-${person.id}`}
              aria-label={`${item.text}, ${role}, preview`}
            >
              <i>{person.initial}</i>
            </span>
          )
        }
        return (
          <button
            type="button"
            key={person.id}
            className={`chip p-${person.id} ${on ? 'on' : ''} ${person.id !== me ? 'theirs' : ''} ${pop ? 'pop' : ''}`}
            aria-pressed={on}
            aria-label={`${item.text}, ${role}, ${state}`}
            onClick={() => {
              togglePersonCheck(item.listId, item.id, person.id, me)
              bump()
            }}
          >
            <i>{on ? <IconCheck /> : person.initial}</i>
          </button>
        )
      })}
    </>
  )
}
