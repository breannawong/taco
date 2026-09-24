import { Avatar } from './Avatar'
import { cycleMe, personById } from '../store/session'
import type { PersonId } from '../store'
import { toast } from '../toast'

type Props = {
  personId: PersonId
  solo?: boolean
}

export function PackingAsButton({ personId, solo = false }: Props) {
  const person = personById(personId)
  if (!person) return null

  return (
    <button
      type="button"
      className={`me ${solo ? 'solo' : ''}`}
      aria-label={`Packing as ${person.name}. Switch person`}
      onClick={() => {
        const next = cycleMe()
        const p = personById(next)
        if (p) toast(`Now packing as ${p.name}`)
      }}
    >
      <Avatar person={person} />
      {solo ? null : <span>Packing as {person.name}</span>}
    </button>
  )
}
