import { useState } from 'react'
import { IconCheck } from './Icons'
import type { Check, Item, Person, PersonId } from '../store'
import { togglePersonCheck, toggleSharedCheck } from '../store'

type Props = {
  item: Item
  checks: Check[]
  people: Person[]
  me: PersonId
  /** When false (template), shapes are static previews. */
  interactive: boolean
}

export function ItemChecks({ item, checks, people, me, interactive }: Props) {
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

  if (item.who === 'shared') {
    const on = interactive && itemChecks.length > 0
    if (!interactive) {
      return (
        <span className="box static" aria-hidden="true">
          <i />
        </span>
      )
    }
    return (
      <button
        type="button"
        className={`box ${on ? 'on' : ''} ${pop ? 'pop' : ''}`}
        aria-pressed={on}
        aria-label={`${item.text}, shared`}
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
    item.who === 'each' ? people : people.filter((p) => p.id === item.who)

  return (
    <>
      {packers.map((person) => {
        const on = interactive && checked(person.id)
        if (!interactive) {
          return (
            <span
              key={person.id}
              className={`chip static p-${person.id}`}
              aria-hidden="true"
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
            aria-label={`${item.text}, ${person.name}`}
            onClick={() => {
              togglePersonCheck(item.listId, item.id, person.id)
              bump()
            }}
          >
            <i>{person.initial}</i>
          </button>
        )
      })}
    </>
  )
}
