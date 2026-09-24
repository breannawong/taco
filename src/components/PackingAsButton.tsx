import { Avatar } from './Avatar'
import { cycleMe, personById } from '../store/session'
import { signOut } from '../auth/authStore'
import { useAuth } from '../auth/useAuth'
import type { PersonId } from '../store'
import { toast } from '../toast'

type Props = {
  personId: PersonId
  solo?: boolean
}

export function PackingAsButton({ personId, solo = false }: Props) {
  const auth = useAuth()
  const person = personById(personId)
  if (!person) return null

  const signedIn = Boolean(auth.session && auth.profile)

  return (
    <button
      type="button"
      className={`me ${solo ? 'solo' : ''}`}
      aria-label={
        signedIn
          ? `Signed in as ${person.name}. Sign out`
          : `Packing as ${person.name}. Switch person`
      }
      onClick={() => {
        if (signedIn) {
          void signOut().then(() => toast('Signed out'))
          return
        }
        const next = cycleMe()
        const p = personById(next)
        if (p) toast(`Now packing as ${p.name}`)
      }}
    >
      <Avatar person={person} />
      {solo ? null : (
        <span>{signedIn ? person.name : `Packing as ${person.name}`}</span>
      )}
    </button>
  )
}
