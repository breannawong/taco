import { Avatar } from './Avatar'
import type { ListProgress, Person } from '../store'

type Props = {
  progress: ListProgress
  people: Person[]
}

export function ProgressRows({ progress, people }: Props) {
  return (
    <div className="progs">
      {people.map((person) => {
        const s = progress.perPerson[person.id] ?? { owed: 0, done: 0 }
        const pct = s.owed ? Math.round((s.done / s.owed) * 100) : 0
        return (
          <div className="prog" key={person.id}>
            <Avatar person={person} size="sm" />
            <div
              className="bar"
              role="img"
              aria-label={`${person.name}: ${s.done} of ${s.owed} packed`}
            >
              <i className={`bg-${person.id}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="num">
              {s.done}/{s.owed}
            </span>
          </div>
        )
      })}
    </div>
  )
}
