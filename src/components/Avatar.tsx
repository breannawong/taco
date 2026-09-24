import type { Person } from '../store'

type Props = {
  person: Person
  size?: 'sm' | 'md' | 'lg'
}

export function Avatar({ person, size = 'md' }: Props) {
  return (
    <span className={`av av-${size} bg-${person.id}`} aria-hidden="true">
      {person.initial}
    </span>
  )
}
